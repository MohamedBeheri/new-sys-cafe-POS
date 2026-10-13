// Small HTTP helpers shared by all route modules
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const bad = (m) => new HttpError(400, m);
export const forbidden = (m = 'You do not have permission for this action.') => new HttpError(403, m);
export const notFound = (m = 'Not found.') => new HttpError(404, m);
// Wrap async handlers so thrown errors reach the error middleware
export const h = (fn) => (req, res, next) => { try { const r = fn(req, res, next); if (r && typeof r.then === 'function') r.catch(next); } catch (e) { next(e); } };
export const need = (v, msg) => { if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) throw bad(msg); return v; };
export const int = (v) => (v === undefined || v === null || v === '' ? null : Number.parseInt(v, 10));
export const clean = (s, max = 5000) => (s == null ? null : String(s).trim().slice(0, max));
