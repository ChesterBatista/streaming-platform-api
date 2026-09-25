const APP_CONFIG = {
  API_URL: 'http://localhost:3000',

  // Chave pública de demonstração LOCAL, visível a qualquer visitante.
  // Configure o mesmo valor no .env apenas para a demo. Nunca use chave de produção aqui.
  API_KEY: 'para-acessar-streaming-platform-api-local-8240',

  STORAGE_KEYS: {
    TOKEN: 'streaming_access_token',
    USER: 'streaming_current_user',
  },

  ROUTES: {
    LOGIN: './index.html',
    HOME: './home.html',
    CONTENT: './content.html',
    ADMIN: './admin.html',
  },
};

Object.freeze(APP_CONFIG);
Object.freeze(APP_CONFIG.STORAGE_KEYS);
Object.freeze(APP_CONFIG.ROUTES);
