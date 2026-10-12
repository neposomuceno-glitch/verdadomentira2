(function () {
  "use strict";
  var CFG = window.CONTRASTAR_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var enc = encodeURIComponent;

  /* ---------- Tema claro / oscuro ---------- */
  var root = document.documentElement;
  var tema = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  root.setAttribute("data-theme", tema);
  $("#tema").addEventListener("click", function () {
    tema = tema === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", tema);
  });

  /* ---------- Modo con su propia clave ---------- */
  var usaServidor = !!(CFG.API_ENDPOINT && CFG.API_ENDPOINT.trim());
  var PROV = CFG.PROVEEDORES || {};
  var prov = $("#proveedor"), modelo = $("#modelo");
  prov.innerHTML = Object.keys(PROV).map(function (k) { return '<option value="' + k + '">' + esc(PROV[k].nombre) + "</option>"; }).join("");
  if (PROV[CFG.PROVEEDOR_INICIAL]) prov.value = CFG.PROVEEDOR_INICIAL;
  function modeloPorDefecto() {
    var p = PROV[prov.value] || {};
    modelo.value = p.modelo || "";
    $("#prov-nota").innerHTML = esc(p.nota || "") + (p.clave ? ' <a href="' + esc(p.clave) + '" target="_blank" rel="noopener">Obtener una clave ↗</a>' : "");
  }
  prov.addEventListener("change", modeloPorDefecto); modeloPorDefecto();

  /* IA integrada en el navegador (Prompt API: Phi-4-mini en Edge, Gemini Nano en Chrome) */
  var hayLM = typeof self.LanguageModel !== "undefined";
  var opcionesLM = [
    { expectedInputs: [{ type: "text", languages: ["es", "en"] }], expectedOutputs: [{ type: "text", languages: ["es"] }] },
    {}
  ];
  function disponibilidadLM() {
    if (!hayLM) return Promise.resolve("unavailable");
    return LanguageModel.availability(opcionesLM[0]).catch(function () { return LanguageModel.availability(); }).catch(function () { return "unavailable"; });
  }
  var estadoLM = "unavailable";
  function marcarNavegador() {
    var op = prov.querySelector('option[value="navegador"]'); if (!op) return;
    if (estadoLM === "unavailable") {
      op.textContent = PROV.navegador.nombre + " (no disponible aquí)";
      if (prov.value === "navegador") { prov.value = PROV.gemini ? "gemini" : Object.keys(PROV)[1]; }
    }
    modeloPorDefecto(); campos();
  }
  function campos() {
    var nav = (PROV[prov.value] || {}).tipo === "navegador";
    $("#clave").closest("label").hidden = nav; modelo.closest("label").hidden = nav;
    $(".byok-grid").classList.toggle("solo", nav);
    if (nav && estadoLM === "unavailable") $("#prov-nota").innerHTML = "<b>Este navegador no ofrece IA integrada.</b> " + esc(PROV.navegador.nota);
  }
  prov.addEventListener("change", campos);
  disponibilidadLM().then(function (a) { estadoLM = a; marcarNavegador(); });
  function sesionLM(alProgresar) {
    var sys = window.CONTRASTAR_PROMPT_BREVE;
    function crear(op) {
      var o = Object.assign({}, op, {
        initialPrompts: [{ role: "system", content: sys }],
        monitor: function (m) { m.addEventListener("downloadprogress", function (e) { alProgresar(e.loaded); }); }
      });
      return LanguageModel.create(o);
    }
    return crear(opcionesLM[0]).catch(function () { return crear(opcionesLM[1]); });
  }
  function modoActual() { return document.querySelector('input[name="modo"]:checked').value; }
  function actualizarModo() {
    $("#byok").hidden = usaServidor || modoActual() !== "ia";
    $("#btn-analizar").textContent = modoActual() === "ia" ? "Analizar" : "Revisar enlace";
  }
  document.querySelectorAll('input[name="modo"]').forEach(function (r) { r.addEventListener("change", actualizarModo); });
  actualizarModo();

  /* ---------- Utilidades de dominio ---------- */
  function parseURL(v) {
    v = (v || "").trim(); if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    try { var u = new URL(v); return /\./.test(u.hostname) ? u : null; } catch (e) { return null; }
  }
  var SLD = ["com", "co", "org", "net", "gob", "gov", "edu", "ac"];
  function registrable(host) {
    var p = host.toLowerCase().replace(/^www\./, "").split(".");
    if (p.length >= 3 && SLD.indexOf(p[p.length - 2]) > -1 && p[p.length - 1].length === 2) return p.slice(-3).join(".");
    return p.slice(-2).join(".");
  }
  function base(dom) { return dom.split(".")[0]; }
  function lev(a, b) {
    var m = [], i, j;
    for (i = 0; i <= b.length; i++) m[i] = [i];
    for (j = 0; j <= a.length; j++) m[0][j] = j;
    for (i = 1; i <= b.length; i++) for (j = 1; j <= a.length; j++)
    {
      m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
      if (i > 1 && j > 1 && b[i - 1] === a[j - 2] && b[i - 2] === a[j - 1]) m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1);
    }
    return m[b.length][a.length];
  }
  function buscarMedio(host) {
    var h = host.toLowerCase().replace(/^www\./, "");
    for (var i = 0; i < MEDIOS.length; i++) {
      var d = MEDIOS[i].d;
      if (h === d || h.slice(-(d.length + 1)) === "." + d) return { medio: MEDIOS[i], exacto: true };
    }
    var reg = registrable(h), b = base(reg).replace(/-/g, "");
    for (i = 0; i < MEDIOS.length; i++) {
      var mb = base(MEDIOS[i].d).replace(/-/g, "");
      if (mb.length < 5 || GENERICOS.indexOf(mb) > -1) continue;
      if (b !== mb && GENERICOS.indexOf(b) > -1) continue;
      if (b === mb) return { medio: MEDIOS[i], exacto: false, tipo: "extension" };
      if (mb.length >= 6 && lev(b, mb) <= (mb.length > 7 ? 2 : 1)) return { medio: MEDIOS[i], exacto: false, tipo: "parecido" };
      if (b.indexOf(mb) > -1 && b !== mb) return { medio: MEDIOS[i], exacto: false, tipo: "contiene" };
    }
    return null;
  }
  /* Nombres demasiado comunes para detectar imitaciones sin falsas alarmas */
  var GENERICOS = ["prensa", "nacion", "globo", "perfil", "reforma", "proceso", "gestion", "expreso", "semana", "jornada", "ambito",
    "primicias", "cooperativa", "confidencial", "ultimahora", "laprensa", "lanacion", "larepublica", "elnacional", "lostiempos", "eldeber", "laprensagrafica"];
  var TLD_RIESGO = ["ltd", "pics", "fun", "click", "top", "xyz", "online", "site", "buzz", "icu", "info", "live", "store", "news"];

  function enlacesRapidos(u, consulta) {
    var host = u.hostname.replace(/^www\./, ""), reg = registrable(host), q = consulta || reg;
    var vf = VERIFICADORES.map(function (d) { return "site:" + d.split("/")[0]; }).join(" OR ");
    return [
      ["Quién está detrás del medio", "https://www.google.com/search?q=" + enc('"' + reg + '" propietario OR financiación OR fundador')],
      ["Wikipedia sobre la fuente", "https://es.wikipedia.org/w/index.php?search=" + enc(reg)],
      ["Registro del dominio (WHOIS)", "https://who.is/whois/" + enc(reg)],
      ["Versiones archivadas", "https://web.archive.org/web/*/" + u.href],
      ["Otros medios sobre el tema", "https://news.google.com/search?q=" + enc(q) + "&hl=es-419&gl=US&ceid=US:es-419"],
      ["Verificadores en español", "https://www.google.com/search?q=" + enc(q + " " + vf)],
      ["Google Fact Check Explorer", "https://toolbox.google.com/factcheck/explorer/search/" + enc(q) + ";hl=es"]
    ];
  }
  function htmlEnlaces(lista) {
    return '<ul class="links">' + lista.map(function (l) {
      return '<li><a href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + esc(l[0]) + " ↗</a></li>";
    }).join("") + "</ul>";
  }

  /* ---------- Diagnóstico instantáneo del enlace (sin IA) ---------- */
  function diagnostico(u) {
    var host = u.hostname.replace(/^www\./, ""), reg = registrable(host);
    var tld = reg.split(".").pop(), m = buscarMedio(host), avisos = [];
    if (u.protocol !== "https:") avisos.push(["warn", "Sin conexión segura (https)", "Los medios serios usan https. No es una prueba, pero suma cautela."]);
    if (m && !m.exacto && m.tipo === "extension") {
      avisos.push(["warn", "Mismo nombre que otro medio, con otra extensión", "Usa el nombre de <b>" + esc(m.medio.n) + "</b> (" + esc(m.medio.d) + ", " + esc(m.medio.c || "") + ") con otra extensión de dominio. Puede ser un medio legítimo de otro país o una imitación, como en la operación Doppelganger. Comprueba que el artículo aparezca también en el sitio oficial."]);
    } else if (m && !m.exacto) {
      var txt = m.tipo === "extension" ? "" :
        m.tipo === "contiene" ? "Contiene el nombre de <b>" + esc(m.medio.n) + "</b> dentro de un dominio distinto." :
        "Se parece mucho al dominio de <b>" + esc(m.medio.n) + "</b> (" + esc(m.medio.d) + ").";
      avisos.push(["bad", "Posible suplantación de un medio", txt + " Así funcionó la operación Doppelganger. Busca el mismo artículo en el sitio oficial."]);
    }
    if (TLD_RIESGO.indexOf(tld) > -1 && !(m && m.exacto)) avisos.push(["warn", "Extensión poco habitual para un medio", "La extensión «." + esc(tld) + "» es barata y frecuente en sitios efímeros. Revisa la fecha de registro del dominio."]);
    if (/(facebook|fb|instagram|tiktok|x|twitter|t|youtube|youtu|telegram|whatsapp|wa)\.(com|me|be)$/.test(reg) || reg === "t.me")
      avisos.push(["warn", "Es una red social, no un medio", "Mira quién publica: antigüedad de la cuenta, actividad, si otras cuentas repiten el mismo mensaje a la vez."]);
    if (m && m.exacto && avisos.length === 0) avisos.push(["ok", "Dominio oficial reconocido", "Que el medio sea real no garantiza que la noticia sea correcta: revisa igual sus fuentes y su contexto."]);

    var fuente = m && m.exacto ?
      '<div class="fact"><dt>Medio</dt><dd>' + esc(m.medio.n) + (m.medio.c && m.medio.c !== "Internacional" ? " · " + esc(m.medio.c) : "") + '</dd></div><div class="fact"><dt>Propiedad</dt><dd>' + esc(m.medio.p) +
      (m.medio.f ? ' <a class="src" href="' + esc(m.medio.f) + '" target="_blank" rel="noopener">fuente ↗</a>' : ' <span class="src">(dato orientativo)</span>') + '</dd></div><div class="fact"><dt>Tipo</dt><dd>' + esc(m.medio.t) + "</dd></div>" :
      '<div class="fact"><dt>Medio</dt><dd>No está en nuestra lista</dd></div><div class="fact"><dt>Qué hacer</dt><dd>Busca quién lo posee o financia</dd></div>';
    return '<div class="panel"><p class="kicker">Revisión del enlace · sin IA</p><h2>' + esc(host) + "</h2>" +
      '<dl class="diag-grid">' + fuente + "</dl>" +
      avisos.map(function (a) { return '<div class="alert ' + a[0] + '"><b>' + a[1] + "</b>" + a[2] + "</div>"; }).join("") +
      "<h3>Lectura lateral en un clic</h3><p class=\"meta\">Sal de la página y comprueba la fuente en otros sitios, como hacen los verificadores profesionales.</p>" +
      htmlEnlaces(enlacesRapidos(u)) +
      (modoActual() === "sinia" ? '<div class="actions"><a class="btn primary" href="#guia">Seguir con las 13 preguntas</a></div>' : "") +
      "</div>";
  }

  /* ---------- Obtener texto ---------- */
  function obtenerTexto(u) {
    var pegado = $("#texto").value.trim();
    if (pegado.length > 200) return Promise.resolve({ texto: pegado, origen: "pegado" });
    if (!CFG.READER) return Promise.reject(new Error("Pega el texto de la noticia en el recuadro: el servicio de lectura está desactivado."));
    return fetch(CFG.READER + u.href, { headers: { "Accept": "text/plain" } }).then(function (r) {
      if (!r.ok) throw new Error("No se pudo leer la página (código " + r.status + "). Pega el texto de la noticia en el recuadro.");
      return r.text();
    }).then(function (t) {
      if (!t || t.length < 300) throw new Error("La página devolvió muy poco texto (¿muro de pago?). Pega el texto de la noticia en el recuadro.");
      return { texto: t, origen: "leido" };
    });
  }

  /* ---------- Llamadas a la IA ---------- */
  function extraerJSON(s) {
    s = String(s || "").replace(/```json|```/g, "");
    var a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error("La IA no devolvió un informe legible. Inténtalo de nuevo.");
    return JSON.parse(s.slice(a, b + 1));
  }
  function mensajeUsuario(u, texto) {
    return "Enlace: " + u.href + "\nFecha de hoy: " + new Date().toISOString().slice(0, 10) +
      "\n\nTexto de la publicación:\n" + texto.slice(0, CFG.MAX_CHARS || 24000);
  }
  function llamarIA(u, texto) {
    if (usaServidor) {
      return fetch(CFG.API_ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u.href, texto: $("#texto").value.trim() || null })
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Error del servidor"); return j; }); });
    }
    if ((PROV[prov.value] || {}).tipo === "navegador") {
      var lim = PROV.navegador.maxChars || 6000;
      var msg = mensajeUsuario(u, texto.slice(0, lim));
      return sesionPendiente.then(function (ses) {
        return ses.prompt(msg, { responseConstraint: window.CONTRASTAR_ESQUEMA_BREVE }).catch(function (e) {
          if (e && e.name === "QuotaExceededError") return ses.prompt(mensajeUsuario(u, texto.slice(0, Math.floor(lim / 2))), { responseConstraint: window.CONTRASTAR_ESQUEMA_BREVE });
          throw e;
        }).then(function (r) { try { ses.destroy(); } catch (e) {} return extraerJSON(r); });
      }).then(function (r) {
        r.advertencias = "Informe generado por el modelo pequeño integrado en tu navegador, con los primeros " + lim + " caracteres del texto. Es menos preciso que un modelo en la nube: úsalo como orientación y comprueba lo importante.";
        return r;
      });
    }
    var clave = $("#clave").value.trim();
    if (!clave) return Promise.reject(new Error("Escribe tu clave de API, o usa el modo «Sin IA»."));
    var p = PROV[prov.value] || {}, m = modelo.value.trim(), sys = window.CONTRASTAR_PROMPT;
    var user = mensajeUsuario(u, texto.slice(0, p.maxChars || CFG.MAX_CHARS || 24000));
    function leerRespuesta(r) {
      return r.text().then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error(p.nombre + ": respuesta no válida (código " + r.status + ")."); }
        if (r.status === 429) throw new Error(p.nombre + ": se alcanzó el límite gratuito de consultas. Espera un minuto o prueba otro proveedor.");
        if (j.error) throw new Error(p.nombre + ": " + (j.error.message || j.error.code || "error"));
        return j;
      });
    }
    if (p.tipo === "gemini") {
      return fetch("https://generativelanguage.googleapis.com/v1beta/models/" + enc(m) + ":generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
      }).then(leerRespuesta).then(function (j) {
        var c = j.candidates && j.candidates[0];
        if (!c || !c.content) throw new Error("Gemini no devolvió respuesta" + (j.promptFeedback && j.promptFeedback.blockReason ? " (bloqueada: " + j.promptFeedback.blockReason + ")." : "."));
        return extraerJSON(c.content.parts.map(function (x) { return x.text || ""; }).join(""));
      });
    }
    if (p.tipo === "anthropic") {
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": clave, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: m, max_tokens: 4000, system: sys, messages: [{ role: "user", content: user }] })
      }).then(leerRespuesta).then(function (j) {
        return extraerJSON(j.content.filter(function (c) { return c.type === "text"; }).map(function (c) { return c.text; }).join(""));
      });
    }
    var cuerpo = { model: m, temperature: 0.2, messages: [{ role: "system", content: sys }, { role: "user", content: user }] };
    if (p.json) cuerpo.response_format = { type: "json_object" };
    var cab = { "Content-Type": "application/json", "Authorization": "Bearer " + clave };
    if (prov.value === "openrouter") { cab["X-Title"] = "Contrastar"; cab["HTTP-Referer"] = location.origin && location.origin !== "null" ? location.origin : "https://contrastar.local"; }
    return fetch(p.url, { method: "POST", headers: cab, body: JSON.stringify(cuerpo) }).then(leerRespuesta).then(function (j) {
      if (!j.choices || !j.choices[0]) throw new Error(p.nombre + ": respuesta vacía.");
      return extraerJSON(j.choices[0].message.content);
    });
  }

  /* ---------- Informe ---------- */
  var NIVEL = { bajo: "Cautela baja", moderado: "Cautela moderada", alto: "Cautela alta", indeterminado: "No determinable" };
  function lista(a) { a = a || []; return a.length ? '<ul class="plain">' + a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : '<p class="meta">Ninguno identificado.</p>'; }
  function informe(r, u, ejemplo) {
    var nv = (r.nivel_cautela || "indeterminado").toLowerCase(); if (!NIVEL[nv]) nv = "indeterminado";
    var f = r.fuente || {}, am = r.actor_motivado || {}, cc = r.campana_coordinada || {};
    var tecn = (r.tecnicas || []).map(function (t) {
      var g = (t.gravedad || "baja").toLowerCase();
      return '<div class="tech ' + esc(g) + '"><b>' + esc(t.nombre) + '</b><span class="tag">' + esc(g) + "</span>" +
        (t.fragmento ? "<q>" + esc(t.fragmento) + "</q>" : "") + '<span class="meta">' + esc(t.explicacion) + "</span></div>";
    }).join("") || '<p class="meta">No se detectaron técnicas claras en el texto.</p>';
    var claims = (r.afirmaciones_clave || []).map(function (c) {
      return "<tr><td>" + esc(c.afirmacion) + "</td><td>" + esc(c.respaldo) + "</td><td>" + esc(c.como_verificar) + "</td></tr>";
    }).join("");
    var busq = (r.consultas_sugeridas || []).map(function (q) { return [q, "https://www.google.com/search?q=" + enc(q)]; });
    var meta = [r.medio, r.autor, r.fecha].filter(Boolean).map(esc).join(" · ");
    return '<article class="panel" id="informe-ia">' +
      '<p class="kicker">' + (ejemplo ? "Informe de ejemplo · caso ficticio" : "Informe con IA") + "</p>" +
      "<h2>" + esc(r.titulo || "Publicación analizada") + "</h2>" + (meta ? '<p class="meta">' + meta + "</p>" : "") +
      '<div class="verdict v-' + nv + '"><span class="lvl">' + NIVEL[nv] + "</span><p>" + esc(r.justificacion_nivel) + "</p></div>" +
      "<h3>Qué afirma</h3><p>" + esc(r.resumen) + "</p>" +
      '<div class="two"><div><h3>La fuente</h3>' + (f.descripcion || f.propiedad_y_financiacion ? "<p>" + esc(f.descripcion) + "</p><p><b>Propiedad y financiación:</b> " + esc(f.propiedad_y_financiacion || "a verificar") + "</p><p><b>Intereses posibles:</b> " + esc(f.intereses_posibles || "a verificar") + "</p>" : '<p class="meta">Revisa la ficha del medio y los enlaces de lectura lateral de arriba.</p>') + "</div>" +
      "<div><h3>¿Actor motivado?</h3><p><b>" + (am.hay_indicios ? "Hay indicios." : "Sin indicios claros.") + "</b> " + esc(am.explicacion) + "</p>" +
      ((am.beneficiarios_posibles || []).length ? "<p><b>Podrían beneficiarse:</b> " + am.beneficiarios_posibles.map(esc).join("; ") + "</p>" : "") + "</div></div>" +
      "<h3>Técnicas detectadas</h3>" + tecn +
      "<h3>¿Campaña coordinada?</h3><div class=\"two\"><div><p><b>Indicios en el texto</b></p>" + lista(cc.indicios) + "</div><div><p><b>Qué comprobar fuera del texto</b></p>" + lista(cc.que_comprobar) + "</div></div>" +
      '<div class="alert warn"><b>Límite</b>' + esc(cc.limites || "Con un solo texto no es posible probar una coordinación entre cuentas.") + "</div>" +
      (claims ? '<h3>Afirmaciones clave</h3><table class="claims"><thead><tr><th>Afirmación</th><th>Respaldo</th><th>Cómo verificarla</th></tr></thead><tbody>' + claims + "</tbody></table>" : "") +
      "<h3>Lo que falta</h3>" + lista(r.omisiones) +
      (busq.length ? "<h3>Búsquedas sugeridas</h3>" + htmlEnlaces(busq) : "") +
      '<div class="alert warn"><b>Ten en cuenta</b>' + esc(r.advertencias || "Este análisis lo genera una IA y puede contener errores. Comprueba las afirmaciones importantes.") + "</div>" +
      '<div class="actions"><button class="btn ghost small" type="button" onclick="window.print()">Imprimir o guardar en PDF</button><a class="btn ghost small" href="#guia">Completar con las 13 preguntas</a></div>' +
      "</article>";
  }

  /* ---------- Flujo principal ---------- */
  var res = $("#resultados"), solicitud = 0, sesionPendiente = null;
  function cargando(msg) { $("#estado").innerHTML = '<div class="panel"><div class="loading"><span class="spin"></span><span>' + esc(msg) + '</span></div><div class="skel" style="width:70%"></div><div class="skel" style="width:90%"></div><div class="skel" style="width:55%"></div></div>'; }
  function error(msg) { $("#estado").innerHTML = '<div class="alert bad"><b>No se pudo completar el análisis</b>' + esc(msg) + "</div>"; }

  $("#form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var u = parseURL($("#url").value);
    solicitud++; res.hidden = false; $("#informe").innerHTML = ""; $("#estado").innerHTML = "";
    if (!u) { $("#diag").innerHTML = ""; error("Escribe un enlace válido, por ejemplo https://elpais.com/…"); return; }
    $("#diag").innerHTML = diagnostico(u);
    res.scrollIntoView({ behavior: "smooth", block: "start" });
    if (modoActual() !== "ia") return;
    var esNav = !usaServidor && (PROV[prov.value] || {}).tipo === "navegador";
    if (esNav && estadoLM === "unavailable") { error("Este navegador no tiene IA integrada disponible. Elige «Google Gemini · gratis» u otro proveedor, o usa el modo «Sin IA»."); return; }
    if (esNav) {
      sesionPendiente = sesionLM(function (f) { cargando("Descargando el modelo del navegador (solo la primera vez, unos 4 GB): " + Math.round(f * 100) + " %"); });
      sesionPendiente.catch(function () {});
    }
    if (!usaServidor && !esNav && !$("#clave").value.trim()) { error("Escribe tu clave de API en el recuadro de abajo, o elige el modo «Sin IA»: la revisión del enlace ya está lista."); return; }
    var turno = ++solicitud;
    var btn = $("#btn-analizar"); btn.disabled = true;
    cargando(usaServidor ? "Leyendo la noticia y preparando el informe…" : "Leyendo la noticia…");
    var p = usaServidor ? llamarIA(u, null) : obtenerTexto(u).then(function (t) { cargando(esNav ? "Analizando con la IA de tu navegador (puede tardar uno o dos minutos)…" : "Analizando con IA…"); return llamarIA(u, t.texto); });
    p.then(function (r) { if (turno !== solicitud) return; $("#estado").innerHTML = ""; $("#informe").innerHTML = informe(r, u, false); })
      .catch(function (e) { if (turno !== solicitud) return; error(e && e.message ? e.message : "Error desconocido."); })
      .then(function () { btn.disabled = false; });
  });

  /* ---------- Ejemplo ---------- */
  var EJEMPLO = {
    titulo: "«Fuentes revelan que la candidata recibió fondos del extranjero»",
    medio: "diarioverdad-noticias.info", autor: "Redacción", fecha: "sin fecha visible",
    resumen: "El texto afirma que una candidata a la alcaldía habría recibido dinero de una fundación extranjera para «desestabilizar» la ciudad. No presenta documentos y la acusación se publica tres días antes de la elección.",
    nivel_cautela: "alto",
    justificacion_nivel: "Acusación grave sin documentos ni fuentes con nombre, de un sitio sin información sobre sus dueños y publicada en vísperas de una votación.",
    fuente: { descripcion: "Sitio sin sección «Quiénes somos», sin dirección ni responsables editoriales.", propiedad_y_financiacion: "Desconocida (a verificar en el registro del dominio).", intereses_posibles: "La fecha y el enfoque benefician a la candidatura rival; no se sabe si existe vínculo." },
    actor_motivado: { hay_indicios: true, explicacion: "El momento de publicación y el lenguaje coinciden con mensajes difundidos por la campaña rival, aunque eso por sí solo no prueba autoría.", beneficiarios_posibles: ["Candidatura rival", "Grupos opuestos a la agenda de la candidata"] },
    tecnicas: [
      { nombre: "Fuente anónima", fragmento: "fuentes cercanas a la investigación aseguran", explicacion: "No hay forma de comprobar quién lo afirma ni si esa investigación existe.", gravedad: "alta" },
      { nombre: "Etiqueta estigmatizante", fragmento: "operadora de intereses extranjeros", explicacion: "La etiqueta sustituye a la prueba y sugiere traición.", gravedad: "alta" },
      { nombre: "Culpa por asociación", fragmento: "la misma fundación que financió protestas violentas", explicacion: "Transfiere a la candidata un rechazo asociado a terceros.", gravedad: "media" }
    ],
    campana_coordinada: {
      indicios: ["Usa la etiqueta #FueraAgentes, aparecida el mismo día", "Incluye un llamado a «compartir antes de que lo borren»"],
      que_comprobar: ["Si muchas cuentas nuevas difundieron el enlace a la misma hora", "Si el mismo texto aparece en otros sitios con ligeras variaciones", "Quién pagó anuncios con ese mensaje en la biblioteca de anuncios de Meta"],
      limites: "Con un solo texto no se puede probar coordinación; solo se señalan indicios que conviene revisar."
    },
    afirmaciones_clave: [
      { afirmacion: "La candidata recibió 200 000 dólares de una fundación extranjera.", respaldo: "fuente anónima", como_verificar: "Revisar la declaración de financiamiento de campaña ante el organismo electoral." },
      { afirmacion: "Existe una investigación fiscal en curso.", respaldo: "sin respaldo", como_verificar: "Consultar el comunicado o el portal de la fiscalía; preguntar a la fiscalía directamente." }
    ],
    omisiones: ["No hay respuesta de la candidata", "No se nombra a la fundación ni se enlaza ningún documento", "No hay fecha de publicación"],
    consultas_sugeridas: ["diarioverdad-noticias.info quién es el dueño", "fundación financiamiento candidata alcaldía declaración jurado electoral", "#FueraAgentes origen etiqueta"],
    advertencias: "Ejemplo ficticio con fines ilustrativos. Muestra el formato del informe; los nombres y datos no corresponden a ningún caso real."
  };
  $("#btn-ejemplo").addEventListener("click", function () {
    var u = new URL("https://diarioverdad-noticias.info/politica/candidata-fondos");
    res.hidden = false; $("#estado").innerHTML = "";
    $("#diag").innerHTML = diagnostico(u);
    $("#informe").innerHTML = informe(EJEMPLO, u, true);
    res.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------- Lista de 13 preguntas ---------- */
  var resp = {};
  $("#preguntas").innerHTML = CHECKLIST.map(function (c) {
    return '<li id="q-' + c.id + '"><div class="qhead"><div><div class="qgroup">' + esc(c.grupo) + '</div><p class="qtext">' + esc(c.q) + "</p></div></div>" +
      '<div class="opts" role="group" aria-label="Respuesta">' +
      '<button type="button" data-q="' + c.id + '" data-v="si" aria-pressed="false">Sí</button>' +
      '<button type="button" data-q="' + c.id + '" data-v="no" aria-pressed="false">No</button>' +
      '<button type="button" data-q="' + c.id + '" data-v="ns" aria-pressed="false">No sé</button></div>' +
      '<p class="qtip">' + esc(c.tip) + "</p></li>";
  }).join("");
  function recalcular() {
    var si = 0, ns = 0, total = 0;
    CHECKLIST.forEach(function (c) { var v = resp[c.id]; if (v) total++; if (v === "si") si++; if (v === "ns") ns++; });
    $("#n-alertas").textContent = si;
    $("#barra").style.width = (si / CHECKLIST.length * 100) + "%";
    var v = total === 0 ? "Responde las preguntas para ver el resultado." :
      si <= 2 ? "Pocas señales. Aun así, verifica las afirmaciones importantes antes de compartir." :
      si <= 5 ? "Varias señales. Haz lectura lateral y busca la fuente original antes de creer o compartir." :
      "Muchas señales. No lo compartas hasta confirmarlo en fuentes independientes.";
    $("#veredicto").textContent = v;
    $("#pendientes").textContent = ns ? ns + (ns === 1 ? " pregunta pendiente de comprobar." : " preguntas pendientes de comprobar.") : "";
  }
  $("#preguntas").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-q]"); if (!b) return;
    var id = b.getAttribute("data-q"), v = b.getAttribute("data-v");
    resp[id] = resp[id] === v ? undefined : v;
    var li = $("#q-" + id);
    li.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-v") === resp[id])); });
    li.className = resp[id] === "si" ? "alerta" : resp[id] === "ns" ? "dudoso" : "";
    recalcular();
  });
  $("#reiniciar").addEventListener("click", function () {
    resp = {}; document.querySelectorAll("#preguntas li").forEach(function (li) { li.className = ""; });
    document.querySelectorAll("#preguntas button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
    recalcular();
  });

  /* ---------- Tarjetas de técnicas ---------- */
  function pintarTarjetas(f) {
    $("#tarjetas").innerHTML = TECNICAS.filter(function (t) { return f === "todas" || t.familia === f; }).map(function (t) {
      return '<article class="card"><span class="fam">' + esc(t.familia) + "</span><h3>" + esc(t.nombre) + "</h3><p>" + esc(t.def) + '</p><p class="ej">' + esc(t.ejemplo) + '</p><p class="sig"><b>Señal:</b> ' + esc(t.senal) + "</p></article>";
    }).join("");
  }
  document.querySelectorAll(".chip").forEach(function (c) {
    c.addEventListener("click", function () {
      document.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
      c.classList.add("on"); pintarTarjetas(c.getAttribute("data-f"));
    });
  });
  pintarTarjetas("todas");
})();
