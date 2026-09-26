import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { mkdir } from 'node:fs/promises';
import { createApp } from './app';
import { loadConfig } from './config';

async function main(): Promise<void> {
  if (existsSync('.env')) loadEnvFile('.env');
  const config = loadConfig();
  await mkdir(config.subtitlesDir, { recursive: true });
  const server = createApp(config).listen(config.port, config.host, () => {
    console.log(`SubHut: ${config.publicUrl}/manifest.json`);
    console.log(`Subtitles: ${config.subtitlesDir}`);
  });
  server.on('error', (error) => { console.error(error); process.exitCode = 1; });
  const shutdown = () => {
    server.close((error) => { if (error) { console.error(error); process.exitCode = 1; } });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
