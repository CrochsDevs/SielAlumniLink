import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDirectory = fileURLToPath(new URL('../../Client/dist/', import.meta.url));

// Serve React and /api from one origin; Socket.IO uses the same HTTP server.
// Mount after API routes, before the final JSON 404 handler.
export function serveClient(app, directory = defaultDirectory) {
  const index = path.join(directory, 'index.html');
  if (!existsSync(index)) throw new Error('Client build missing. Run npm --prefix Client run build before starting with SERVE_CLIENT=true.');
  app.use('/assets', express.static(path.join(directory, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(directory, {
    index: false,
    setHeaders(res, filename) {
      if (filename === index) res.setHeader('Cache-Control', 'no-store');
    },
  }));
  app.get(/^\/(?!api(?:\/|$)|socket\.io(?:\/|$)).*/, (req, res, next) => {
    // Missing JS/images and unknown API endpoints must remain real 404s.
    if (path.extname(req.path) || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(index);
  });
}
