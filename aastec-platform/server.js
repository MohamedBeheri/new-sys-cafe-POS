// ===================================================================
//  AASTEC Digital Platform — HTTP server
//  Express REST API + static portal (public/) on a single process
// ===================================================================
import express from 'express';
import { join } from 'node:path';
import { initDatabase } from './db/seed.js';
import { auth } from './lib/core.js';
import { HttpError } from './lib/http.js';
import { UPLOAD_DIR, PUBLIC_DIR } from './lib/paths.js';
import publicRoutes from './routes/public.js';
import coreRoutes from './routes/core.js';
import societyRoutes from './routes/society.js';
import communityRoutes from './routes/community.js';
import eventRoutes from './routes/events.js';
import electionRoutes from './routes/elections.js';
import learningRoutes from './routes/learning.js';
import incubatorRoutes from './routes/incubator.js';
import insightRoutes from './routes/insights.js';

const PORT = process.env.PORT || 4800;

try {
  if (initDatabase()) console.log('Database initialised.');
} catch (e) { console.error('Database initialisation failed:', e); process.exit(1); }

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next(); });

// ---------- API ----------
app.use('/api', publicRoutes);                 // health, login, register, public overview, certificate verification
app.use('/api', auth, coreRoutes, societyRoutes, communityRoutes, eventRoutes, electionRoutes, learningRoutes, incubatorRoutes, insightRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));
app.use((err, req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'The upload is too large.' });
  console.error(err);
  res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
});

// ---------- Static portal ----------
const pub = PUBLIC_DIR;
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.static(pub, { index: false, maxAge: '1h' }));
app.get(['/', '/index.html'], (req, res) => res.sendFile(join(pub, 'index.html')));
app.get(['/portal', '/portal/*'], (req, res) => res.sendFile(join(pub, 'portal.html')));
app.get('/verify/:code', (req, res) => res.sendFile(join(pub, 'verify.html')));
app.get('/checkin/:token', (req, res) => res.redirect(`/portal#/checkin/${encodeURIComponent(req.params.token)}`));
app.use((req, res) => res.status(404).sendFile(join(pub, 'index.html')));

app.listen(PORT, () => console.log(`AASTEC Digital Platform running on http://localhost:${PORT}`));
