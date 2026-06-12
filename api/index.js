// Vercel serverless entry — wraps the OreSight AI Express app.
// Static assets are served from mining-demo/public by the Vercel CDN
// (see vercel.json); only /api/* requests reach this function.
import app from '../mining-demo/server.js';

export default app;
