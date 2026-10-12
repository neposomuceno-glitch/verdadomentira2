# Contrastar

Herramienta web gratuita, en español, para revisar en pocos minutos si una noticia o publicación muestra señales de desprestigio, blanqueo o desinformación. Se basa en el estudio «Desprestigio y blanqueo: métodos comúnmente usados».

Es un sitio estático (HTML, CSS y JavaScript, sin compilación), así que funciona en GitHub Pages, en WordPress o en cualquier alojamiento.

## Qué ofrece

1. **Revisión del enlace sin IA (siempre activa).** Al pegar un enlace, el sitio:
   - identifica el medio y, si está en su lista, quién lo posee o financia;
   - avisa si el dominio imita a un medio conocido (por ejemplo, `elpais.ltd` o `nytimes-news.com`), como en la operación Doppelganger;
   - avisa de extensiones de dominio poco habituales y de enlaces de redes sociales;
   - genera enlaces de lectura lateral: propietario del medio, Wikipedia, registro WHOIS, versiones archivadas, Google Noticias, verificadores en español y Google Fact Check Explorer.
2. **Guía de 13 preguntas sin IA.** Lista interactiva con consejos, basada en la Parte VII del estudio.
3. **Informe con IA.** Lee la noticia y devuelve un informe con: nivel de cautela, la fuente y sus posibles intereses, si hay un actor motivado, las técnicas detectadas (con el fragmento exacto), los indicios de campaña coordinada y lo que habría que comprobar fuera del texto, las afirmaciones clave y cómo verificarlas, lo que falta y búsquedas sugeridas.
4. **Glosario** de 18 técnicas, cada una con un caso real y la señal que la delata.

## Estructura

```
index.html          página principal
css/styles.css      estilos (modo claro y oscuro)
js/config.js        AJUSTES: servidor de IA, modelos, servicio de lectura
js/data.js          preguntas, técnicas, lista de medios y verificadores (editable)
js/prompt.js        instrucciones que recibe la IA
js/app.js           lógica del sitio
worker/             servidor intermedio opcional (Cloudflare Workers)
favicon.svg
```

## Opciones de IA gratuitas

| Opción | Costo | Clave | Notas |
|---|---|---|---|
| IA del navegador (Microsoft Edge: Phi-4-mini; Google Chrome: Gemini Nano) | Gratis | No | El texto no sale del equipo. Requiere Chrome 148 o posterior, o Edge Dev/Canary con «Prompt API for Phi mini» activado en `edge://flags`; computadora de escritorio con unos 20 GB libres y tarjeta gráfica de 4–5,5 GB (o 16 GB de RAM en Chrome). Descarga unos 4 GB la primera vez. Modelo pequeño: informe más breve. No funciona en móviles ni dentro de un iframe de otro dominio. |
| Google Gemini (`gemini-3.8-flash`) | Gratis (nivel gratuito) | Sí, gratuita en <https://aistudio.google.com/apikey> | La mejor calidad entre las gratuitas. En el nivel gratuito, Google puede usar los textos enviados para mejorar sus productos. |
| Groq (`openai/gpt-oss-120b`) | Gratis | Sí, en <https://console.groq.com/keys> | Unas 1000 consultas al día; acepta textos más cortos (12 000 caracteres). |
| OpenRouter (`openrouter/free`) | Gratis | Sí, en <https://openrouter.ai/keys> | 50 consultas al día sin compra; elige al azar un modelo gratuito. |
| DeepSeek (`deepseek-flash`) | De pago, muy barato | Sí | Su API no es gratuita (solo su chat lo es); requiere saldo prepagado. |
| OpenAI / Anthropic | De pago | Sí | |

Los nombres de modelo y los límites cambian con frecuencia: actualícelos en `js/config.js` (y en `worker/worker.js` si usa el servidor).

## Dos formas de usar las opciones con clave

**A. Sin servidor (lo más simple).** Deje `API_ENDPOINT` vacío en `js/config.js`. El sitio intenta primero la IA del navegador; si no está disponible, propone Gemini gratis y el visitante pega su propia clave gratuita. La clave queda solo en la memoria de la pestaña y se envía únicamente al proveedor elegido.

**B. Con servidor intermedio (recomendado para el público).** Usted guarda una sola clave en un Cloudflare Worker y los visitantes no necesitan nada: solo pegan el enlace. Con Gemini o Groq gratuitos, el costo puede ser cero; el límite diario de consultas gratuitas se reparte entre todos los visitantes.

1. Cree una cuenta en <https://dash.cloudflare.com> → Workers & Pages → Create → Worker.
2. Pegue el contenido de `worker/worker.js` y despliegue.
3. En Settings → Variables and Secrets añada:
   - `API_KEY` (tipo secreto): su clave del proveedor.
   - `PROVEEDOR`: `gemini`, `groq`, `openrouter`, `deepseek`, `openai` o `anthropic`.
   - `MODELO` (opcional): si lo deja vacío se usa el modelo predeterminado.
   - `ORIGEN_PERMITIDO`: la dirección de su sitio, por ejemplo `https://usuario.github.io`. Así nadie más puede usar su clave desde otro sitio.
4. Copie la dirección del worker y póngala en `js/config.js`:
   `API_ENDPOINT: "https://contrastar.SU-USUARIO.workers.dev"`

Si usa un proveedor de pago, fije un límite de gasto mensual en su panel. Si el sitio tiene mucho tráfico, active una regla de límite de solicitudes (Rate limiting) en Cloudflare.

## Publicar en GitHub Pages

1. Cree un repositorio público, por ejemplo `contrastar`.
2. Suba todos los archivos de esta carpeta (botón «Add file → Upload files»).
3. Settings → Pages → Source: «Deploy from a branch», rama `main`, carpeta `/ (root)`.
4. En uno o dos minutos el sitio estará en `https://SU-USUARIO.github.io/contrastar/`.

## Publicar en WordPress

**Opción 1, con incrustación (funciona en cualquier WordPress, incluso WordPress.com).** Nota: dentro de un iframe la IA del navegador no está disponible; las demás opciones sí funcionan. Publique primero en GitHub Pages y, en una página de WordPress, añada un bloque «HTML personalizado» con:

```html
<iframe src="https://SU-USUARIO.github.io/contrastar/" style="width:100%;height:1800px;border:0" title="Contrastar"></iframe>
```

**Opción 2, alojado en su propio servidor (WordPress autoalojado).** Suba la carpeta completa por FTP o por el administrador de archivos de su hosting a `public_html/contrastar/`. Quedará en `https://su-dominio.com/contrastar/` y podrá enlazarla desde el menú de WordPress.

## Personalizar

- **Medios:** la lista `MEDIOS` en `js/data.js` incluye 96 medios de América Latina y medios regionales en español, con la fuente de cada dato (ver `medios-america-latina.md`), además de 26 medios internacionales. Para añadir uno, copie una línea y cambie dominio (d), nombre (n), país (c), propietario (p), tipo (t) y fuente (f). Revise los datos de vez en cuando: la propiedad cambia.
- **Verificadores:** amplíe `VERIFICADORES` en `js/data.js`.
- **Instrucciones de la IA:** edite `js/prompt.js` y copie el mismo texto en `worker/worker.js`.

## Privacidad y límites

- El sitio no guarda consultas ni usa cookies.
- Para leer la noticia se usa el servicio público `r.jina.ai` (límite aproximado de 20 lecturas por minuto sin clave). Si la noticia tiene muro de pago, el visitante puede pegar el texto.
- Con un solo texto, la IA no puede probar una campaña coordinada: solo puede señalar indicios y decir qué comprobar. El informe es una ayuda para pensar, no un veredicto.
