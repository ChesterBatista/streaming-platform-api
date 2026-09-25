export function validateEnvironment(config: Record<string, unknown>) {
  const databaseUrl = String(config.DATABASE_URL ?? '').trim();
  const jwtSecret = String(config.JWT_SECRET ?? '').trim();
  const jwtExpiresIn = String(config.JWT_EXPIRES_IN ?? '').trim();
  const apiKey = String(config.API_KEY ?? '').trim();
  const port = Number(config.PORT ?? 3000);
  let metadataBaseUrl = String(config.MEDIA_METADATA_BASE_URL ?? '').trim();
  const metadataTimeout = Number(config.MEDIA_METADATA_TIMEOUT_MS ?? 5000);

  if (!databaseUrl) {
    throw new Error('DATABASE_URL é obrigatória.');
  }

  if (!jwtSecret) {
    throw new Error('JWT_SECRET é obrigatória.');
  }

  if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 bytes.');
  }

  if (!jwtExpiresIn) {
    throw new Error('JWT_EXPIRES_IN é obrigatória.');
  }

  if (!apiKey) {
    throw new Error('API_KEY é obrigatória.');
  }

  if (Buffer.byteLength(apiKey, 'utf8') < 32) {
    throw new Error('API_KEY deve ter pelo menos 32 bytes.');
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT deve ser uma porta TCP válida.');
  }

  if (!Number.isInteger(metadataTimeout) || metadataTimeout < 1 || metadataTimeout > 30000) {
    throw new Error('MEDIA_METADATA_TIMEOUT_MS deve ser um inteiro entre 1 e 30000.');
  }
  if (metadataBaseUrl) {
    try {
      const url = new URL(metadataBaseUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error();
      }
      if (!url.pathname.endsWith('/')) url.pathname += '/';
      metadataBaseUrl = url.toString();
    } catch {
      throw new Error('MEDIA_METADATA_BASE_URL deve ser uma URL HTTP(S) sem credenciais, query ou fragmento.');
    }
  }

  return {
    ...config,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    API_KEY: apiKey,
    PORT: port,
    MEDIA_METADATA_BASE_URL: metadataBaseUrl,
    MEDIA_METADATA_TIMEOUT_MS: metadataTimeout,
  };
}
