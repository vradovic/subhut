import express, { type ErrorRequestHandler } from 'express';
import { getRouter } from 'stremio-addon-sdk';
import { createAddon } from './addon';
import type { Config } from './config';
import { parseFilename, SubtitleRepository, subtitleTypes } from './subtitles';

export function createApp(config: Config) {
  const app = express();
  const repository = new SubtitleRepository(config.subtitlesDir, config.publicUrl);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });
  app.get('/', (_req, res) => {
    res.type('text/plain').send(`SubHut\n\nInstall in Stremio: ${config.publicUrl}/manifest.json\nSee README.md for subtitle folder layout.\n`);
  });
  app.get('/files/:type/:id/:filename', async (req, res, next) => {
    const { type, id, filename } = req.params;
    const file = await repository.findFile(type, id, filename);
    if (!file) { res.sendStatus(404); return; }
    const metadata = parseFilename(filename)!;
    res.setHeader('Content-Type', `${subtitleTypes[metadata.extension]}; charset=utf-8`);
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(file, (error) => { if (error) next(error); });
  });
  app.use(getRouter(createAddon(repository)));
  app.use((_req, res) => { res.sendStatus(404); });
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (res.headersSent) { next(error); return; }
    const status = error instanceof URIError ? 400
      : error instanceof Error && 'status' in error && error.status === 404 ? 404 : 500;
    if (status === 500) console.error(error);
    res.status(status).json({ error: status === 500 ? 'Internal server error' : 'Invalid or missing resource' });
  };
  app.use(handleError);
  return app;
}
