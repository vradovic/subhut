import path from 'node:path';

export interface Config {
  host: string;
  port: number;
  publicUrl: string;
  subtitlesDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const portText = env.PORT ?? '7000';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const url = new URL(env.PUBLIC_URL ?? `http://localhost:${port}`);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('PUBLIC_URL must be an HTTP(S) URL without credentials, query, or fragment.');
  }
  return {
    host: env.HOST ?? '0.0.0.0',
    port,
    publicUrl: url.href.replace(/\/+$/, ''),
    subtitlesDir: path.resolve(env.SUBTITLES_DIR ?? 'subtitles'),
  };
}
