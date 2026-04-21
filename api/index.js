// Vercel serverless entry point.
// All /api/* and /bot* routes are rewritten here via vercel.json.
const { app, initDb } = require('../server/src/app');

let _ready = null;
function ensureReady() {
  if (!_ready) _ready = initDb().catch((e) => console.error('[DB init]', e.message));
  return _ready;
}

module.exports = async (req, res) => {
  await ensureReady();
  return app(req, res);
};
