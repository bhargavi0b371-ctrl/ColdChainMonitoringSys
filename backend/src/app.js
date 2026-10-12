import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import alertRoutes from './routes/alertRoutes.js';

const app = express();
const frontendDirectory = fileURLToPath(new URL('../../frontend/', import.meta.url));

app.use(express.json());
app.use('/api/alerts', alertRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/assets', express.static(path.join(frontendDirectory, 'assets')));
app.use(express.static(frontendDirectory));
app.get('/', (_req, res) => {
  res.sendFile(path.join(frontendDirectory, 'index.html'));
});

app.get('/settings.html', (_req, res) => {
  res.sendFile(path.join(frontendDirectory, 'settings.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
