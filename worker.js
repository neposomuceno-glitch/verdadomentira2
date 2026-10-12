/*
 * Contrastar · servidor intermedio para Cloudflare Workers
 * ---------------------------------------------------------------
 * Guarda su clave de IA fuera del navegador para que los visitantes
 * puedan analizar enlaces sin clave propia.
 *
 * Variables (Settings → Variables and Secrets):
 *   PROVEEDOR        "gemini" (gratis), "groq" (gratis), "openrouter" (modelos gratuitos),
 *                    "deepseek" (de pago, muy barato), "openai" o "anthropic"
 *   API_KEY          su clave del proveedor            (secreto)
 *   MODELO           opcional; si lo deja vacío se usa el modelo indicado abajo
 *   ORIGEN_PERMITIDO p. ej. "https://usuario.github.io" (o * para pruebas)
 *   BUSQUEDA_WEB     "si" para que la IA busque en la web (Anthropic, o Gemini de pago; opcional)
 */
const PROMPT = `Eres un analista de verificación de información. Trabajas en español internacional.
Recibirás el texto de una noticia o publicación y su enlace. Tu tarea es ayudar a una persona común a decidir cuánta cautela merece, sin sustituir su juicio.

Método (basado en la investigación sobre desprestigio, manipulación de la imagen y blanqueo):
1. Identifica la fuente: medio, autor, fecha, quién es el propietario o financiador si lo sabes, y qué intereses podría tener. Si no estás seguro, dilo y marca el dato como "a verificar".
2. Detecta técnicas de manipulación presentes en el texto, citando el fragmento exacto: campaña de difamación, asesinato de reputación, ad hominem, culpa por asociación, etiqueta estigmatizante o deshumanizante, lawfare o mediafare (confundir denuncia, procesamiento y condena), giro mediático (certeza no justificada), cortina de humo, astroturfing, cherry picking (datos aislados, encuestas sin preguntas condicionales, periodos de tiempo elegidos a conveniencia), fabricación de duda, eufemismo, whataboutism, minimización, apelación emocional, fuentes anónimas o vagas ("se dice", "fuentes cercanas").
3. Evalúa si hay un actor motivado: quién se beneficia de que esta narrativa se crea. La pregunta "¿a quién beneficia?" orienta, pero no prueba nada.
4. Señales de campaña coordinada: con un solo texto NO puedes ver redes de cuentas. Solo puedes señalar indicios textuales (consignas o etiquetas recién acuñadas, formulaciones típicas de campañas conocidas, llamados a difundir, coincidencia con calendarios electorales) y explicar qué habría que comprobar fuera del texto. Nunca afirmes que existe una campaña coordinada sin pruebas de coordinación.
5. Afirmaciones clave: lista las afirmaciones centrales, qué respaldo tienen (documento citado, fuente con nombre, fuente anónima, sin respaldo) y cómo podría verificarlas una persona sin herramientas técnicas.
6. Omisiones: qué contexto, datos o voces faltan.
7. Propón entre 3 y 6 búsquedas concretas para "lectura lateral" (qué escribir en un buscador para saber más de la fuente, del autor o de los datos).

Reglas de equilibrio:
- La negación de un actor interesado no es prueba de que algo no ocurrió; tampoco la ausencia de pruebas públicas.
- Pero la falta de pruebas tampoco autoriza a dar una acusación por probada. "No determinable" es una respuesta válida.
- No juzgues por la orientación política del medio; juzga por el método: pruebas, fuentes, contexto y técnicas.
- Si el texto parece incompleto (muro de pago, solo titular), dilo y limita tus conclusiones.
- Sé breve y concreto. No inventes datos. No inventes citas.

Responde SOLO con un objeto JSON válido, sin texto antes ni después, con esta estructura exacta:
{
  "titulo": "string",
  "medio": "string",
  "autor": "string o vacío",
  "fecha": "string o vacío",
  "resumen": "2 o 3 frases sobre lo que afirma el texto",
  "nivel_cautela": "bajo | moderado | alto | indeterminado",
  "justificacion_nivel": "1 o 2 frases",
  "fuente": {
    "descripcion": "string",
    "propiedad_y_financiacion": "string (indica 'a verificar' si no es seguro)",
    "intereses_posibles": "string"
  },
  "actor_motivado": {
    "hay_indicios": true,
    "explicacion": "string",
    "beneficiarios_posibles": ["string"]
  },
  "tecnicas": [
    { "nombre": "string", "fragmento": "cita literal breve", "explicacion": "string", "gravedad": "baja | media | alta" }
  ],
  "campana_coordinada": {
    "indicios": ["string"],
    "que_comprobar": ["string"],
    "limites": "string"
  },
  "afirmaciones_clave": [
    { "afirmacion": "string", "respaldo": "documento | fuente con nombre | fuente anónima | sin respaldo", "como_verificar": "string" }
  ],
  "omisiones": ["string"],
  "consultas_sugeridas": ["string"],
  "advertencias": "string (limitaciones de este análisis)"
}`;
const READER = "https://r.jina.ai/";
const MAX_CHARS = 24000;

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ORIGEN_PERMITIDO || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(obj, status, env) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(env) } });
}
function urlSegura(v) {
  let u; try { u = new URL(v); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname;
  if (h === "localhost" || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h.endsWith(".local") || h.includes(":")) return null;
  return u;
}
function extraerJSON(s) {
  s = String(s || "").replace(/```json|```/g, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("La IA no devolvió un informe legible.");
  return JSON.parse(s.slice(a, b + 1));
}
async function leer(u) {
  const r = await fetch(READER + u.href, { headers: { Accept: "text/plain" } });
  if (!r.ok) throw new Error("No se pudo leer la página. Pegue el texto de la noticia.");
  const t = await r.text();
  if (t.length < 300) throw new Error("La página devolvió muy poco texto (¿muro de pago?). Pegue el texto de la noticia.");
  return t;
}
const PROVEEDORES = {
  gemini:     { tipo: "gemini", modelo: "gemini-3.8-flash" },
  groq:       { tipo: "openai", url: "https://api.groq.com/openai/v1/chat/completions", modelo: "openai/gpt-oss-120b", maxChars: 12000 },
  openrouter: { tipo: "openai", url: "https://openrouter.ai/api/v1/chat/completions", modelo: "openrouter/free" },
  deepseek:   { tipo: "openai", url: "https://api.deepseek.com/chat/completions", modelo: "deepseek-flash", json: true },
  openai:     { tipo: "openai", url: "https://api.openai.com/v1/chat/completions", modelo: "gpt-4.1-mini", json: true },
  anthropic:  { tipo: "anthropic", modelo: "claude-sonnet-4-5" },
};
async function leerJSON(r, nombre) {
  const t = await r.text(); let j;
  try { j = JSON.parse(t); } catch { throw new Error(nombre + ": respuesta no válida (código " + r.status + ")."); }
  if (r.status === 429) throw new Error("Se alcanzó el límite de consultas del servicio de IA. Inténtelo en unos minutos.");
  if (j.error) throw new Error(nombre + ": " + (j.error.message || j.error.code || "error"));
  return j;
}
async function ia(env, user) {
  const nombre = env.PROVEEDOR || "gemini";
  const p = PROVEEDORES[nombre];
  if (!p) throw new Error("PROVEEDOR desconocido: " + nombre);
  const modelo = env.MODELO || p.modelo;
  if (p.tipo === "gemini") {
    const body = { systemInstruction: { parts: [{ text: PROMPT }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { temperature: 0.2 } };
    if (env.BUSQUEDA_WEB === "si") body.tools = [{ google_search: {} }];   // solo en el nivel de pago
    else body.generationConfig.responseMimeType = "application/json";
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelo) + ":generateContent", {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.API_KEY }, body: JSON.stringify(body),
    });
    const j = await leerJSON(r, "Gemini");
    const c = j.candidates && j.candidates[0];
    if (!c || !c.content) throw new Error("Gemini no devolvió respuesta.");
    return extraerJSON(c.content.parts.map(x => x.text || "").join(""));
  }
  if (p.tipo === "anthropic") {
    const body = { model: modelo, max_tokens: 4000, system: PROMPT, messages: [{ role: "user", content: user }] };
    if (env.BUSQUEDA_WEB === "si") body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": env.API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body),
    });
    const j = await leerJSON(r, "Anthropic");
    return extraerJSON(j.content.filter(c => c.type === "text").map(c => c.text).join(""));
  }
  const cuerpo = { model: modelo, temperature: 0.2, messages: [{ role: "system", content: PROMPT }, { role: "user", content: user }] };
  if (p.json) cuerpo.response_format = { type: "json_object" };
  const r = await fetch(p.url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.API_KEY, "X-Title": "Contrastar" }, body: JSON.stringify(cuerpo) });
  const j = await leerJSON(r, nombre);
  return extraerJSON(j.choices[0].message.content);
}
function limite(env) { const p = PROVEEDORES[env.PROVEEDOR || "gemini"]; return (p && p.maxChars) || MAX_CHARS; }

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    if (request.method !== "POST") return json({ error: "Use POST." }, 405, env);
    if (!env.API_KEY) return json({ error: "Falta configurar API_KEY en el worker." }, 500, env);
    let datos; try { datos = await request.json(); } catch { return json({ error: "Solicitud no válida." }, 400, env); }
    const u = urlSegura(datos.url);
    if (!u) return json({ error: "Enlace no válido." }, 400, env);
    try {
      const texto = datos.texto && datos.texto.length > 200 ? datos.texto : await leer(u);
      const user = "Enlace: " + u.href + "\nFecha de hoy: " + new Date().toISOString().slice(0, 10) +
        "\n\nTexto de la publicación:\n" + texto.slice(0, limite(env));
      return json(await ia(env, user), 200, env);
    } catch (e) {
      return json({ error: e.message || "Error al analizar." }, 502, env);
    }
  },
};
