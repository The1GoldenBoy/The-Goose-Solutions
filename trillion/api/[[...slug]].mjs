// Trillion sur Vercel — la même app, en fonction serverless.
// Le statique (public/) est servi par le CDN ; tout /api/* passe ici.
// L'état vit sur /tmp : persistant tant que l'instance est chaude,
// réinitialisé au redéploiement (même règle que le palier gratuit de Render —
// pour une mémoire permanente, brancher un volume/DB, voir DEPLOY.md).
import { createApp } from '../server.mjs';

let appPromise;

export default async function trillionHandler(req, res) {
  appPromise ||= createApp({ stateDir: process.env.TRILLION_STATE_DIR || '/tmp/trillion-state' });
  const { handler } = await appPromise;
  return handler(req, res);
}
