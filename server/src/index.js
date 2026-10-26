// Cloudflare Worker entry: all logic lives in handler.js so it can be tested without Cloudflare.
import { handle } from './handler.js';

export default { fetch: (request, env) => handle(request, env) };
