/*
 * CONFIGURACIÓN DE CONTRASTAR
 * ---------------------------------------------------------------
 * API_ENDPOINT: dirección del servidor intermedio (Cloudflare Worker)
 * que guarda su clave de IA de forma segura. Si la deja vacía, el sitio
 * funciona igual: el modo sin IA está siempre disponible y el modo con IA
 * pedirá al visitante su propia clave (que nunca sale de su navegador
 * salvo hacia el proveedor de IA elegido).
 *
 * Ejemplo tras desplegar el worker:
 *   API_ENDPOINT: "https://contrastar.SU-USUARIO.workers.dev"
 */
window.CONTRASTAR_CONFIG = {
  API_ENDPOINT: "",

  // Servicio público que convierte una página web en texto legible y
  // permite leerla desde el navegador. Puede cambiarlo o dejarlo vacío.
  READER: "https://r.jina.ai/",

  // Longitud máxima del texto que se envía a la IA (caracteres).
  MAX_CHARS: 24000,

  // Proveedor que aparece seleccionado al abrir la página.
  // Si el navegador no tiene IA integrada, se usa "gemini".
  PROVEEDOR_INICIAL: "navegador",

  /*
   * Proveedores de IA para el modo "con su propia clave".
   * tipo "openai" = API compatible con OpenAI (Groq, OpenRouter, DeepSeek...).
   * Los nombres de modelo cambian con el tiempo: actualícelos aquí.
   */
  PROVEEDORES: {
    navegador: {
      nombre: "IA del navegador (Edge o Chrome) · gratis, sin clave",
      tipo: "navegador",
      maxChars: 6000,
      nota: "Usa el modelo que trae el propio navegador (Phi-4-mini en Microsoft Edge, Gemini Nano en Google Chrome). Es gratis, no necesita clave y el texto no sale de tu equipo. Requiere Chrome 148 o posterior, o Edge Dev/Canary con la opción «Prompt API for Phi mini» activada en edge://flags, un equipo de escritorio con unos 20 GB libres y una tarjeta gráfica con al menos 4–5,5 GB de memoria (o, en Chrome, 16 GB de RAM). La primera vez descarga el modelo (unos 4 GB). Es un modelo pequeño: el informe es más breve y menos preciso."
    },
    gemini: {
      nombre: "Google Gemini · gratis",
      tipo: "gemini",
      modelo: "gemini-3.8-flash",
      clave: "https://aistudio.google.com/apikey",
      nota: "Gratis con cuenta de Google y sin tarjeta. En el nivel gratuito, Google puede usar los textos enviados para mejorar sus productos."
    },
    groq: {
      nombre: "Groq · gratis",
      tipo: "openai",
      url: "https://api.groq.com/openai/v1/chat/completions",
      modelo: "openai/gpt-oss-120b",
      maxChars: 12000,
      clave: "https://console.groq.com/keys",
      nota: "Gratis y sin tarjeta, con unas 1000 consultas al día. Acepta textos más cortos: se analizan los primeros 12 000 caracteres."
    },
    openrouter: {
      nombre: "OpenRouter · modelos gratuitos",
      tipo: "openai",
      url: "https://openrouter.ai/api/v1/chat/completions",
      modelo: "openrouter/free",
      clave: "https://openrouter.ai/keys",
      nota: "Gratis, con 50 consultas al día. «openrouter/free» elige al azar un modelo gratuito; la calidad varía."
    },
    deepseek: {
      nombre: "DeepSeek · de pago, muy barato",
      tipo: "openai",
      url: "https://api.deepseek.com/chat/completions",
      modelo: "deepseek-flash",
      json: true,
      clave: "https://platform.deepseek.com/api_keys",
      nota: "La API de DeepSeek no es gratuita: requiere saldo prepagado, aunque cada informe cuesta una fracción de centavo."
    },
    openai: {
      nombre: "OpenAI · de pago",
      tipo: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      modelo: "gpt-4.1-mini",
      json: true,
      clave: "https://platform.openai.com/api-keys",
      nota: "De pago por uso."
    },
    anthropic: {
      nombre: "Anthropic (Claude) · de pago",
      tipo: "anthropic",
      modelo: "claude-sonnet-4-5",
      clave: "https://console.anthropic.com/settings/keys",
      nota: "De pago por uso."
    }
  }
};
