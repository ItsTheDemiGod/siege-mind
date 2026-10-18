// Zero-dependency static file server for local dev.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8137;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

/**
 * Build a static file server (request handling only; caller does the listening).
 * @param {string} rootDir - directory to serve; nothing outside it is ever readable.
 * @returns {http.Server}
 */
export function createStaticServer(rootDir) {
  const root = resolve(rootDir);
  return http.createServer(async (req, res) => {
    const send = (code, body, type = 'text/plain') => res.writeHead(code, { 'Content-Type': type }).end(body);
    let path;
    try {
      // Manual split instead of new URL(): "//..//x" would be parsed as a host.
      path = decodeURIComponent(req.url.split(/[?#]/)[0]);
    } catch {
      return send(400, 'Bad request');
    }
    if (path.includes('\0')) return send(400, 'Bad request');
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(root, '.' + path);
    // Backslashes count as separators on Windows, so "..\x" is caught here too.
    if (file !== root && !file.startsWith(root + sep)) return send(403, 'Forbidden');
    try {
      send(200, await readFile(file), MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
    } catch {
      send(404, 'Not found');
    }
  });
}

/**
 * Parse the PORT env value.
 * @param {string|undefined} value
 * @returns {number} port in 0..65535 (0 = pick a free one)
 */
function parsePort(value) {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const n = Number(value);
  if (!/^\d+$/.test(value) || n > 65535) {
    console.error(`Invalid PORT "${value}": must be an integer from 0 to 65535.`);
    process.exit(1);
  }
  return n;
}

/** Listen on one address; resolves with the server or rejects with the listen error. */
function listenOn(root, port, host) {
  return new Promise((ok, fail) => {
    const server = createStaticServer(root);
    server.once('error', fail);
    server.listen(port, host, () => ok(server));
  });
}

async function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const requested = parsePort(process.env.PORT);
  const servers = [];
  const fatal = (msg) => {
    for (const s of servers) s.close();
    console.error(msg);
    process.exit(1);
  };
  try {
    servers.push(await listenOn(root, requested, '127.0.0.1'));
  } catch (err) {
    fatal(err.code === 'EADDRINUSE'
      ? `Port ${requested} is already in use. Choose another, e.g. (PowerShell) $env:PORT=9000; npm start`
      : `Server error: ${err.message}`);
  }
  const port = servers[0].address().port;
  const bound = ['127.0.0.1'];
  try {
    servers.push(await listenOn(root, port, '::1'));
    bound.push('::1');
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      fatal(`Port ${port} is already in use on ::1 (another server, possibly IPv6-only). Choose another, e.g. (PowerShell) $env:PORT=9000; npm start`);
    } else if (err.code !== 'EADDRNOTAVAIL' && err.code !== 'EAFNOSUPPORT') {
      fatal(`Server error: ${err.message}`);
    }
    // IPv6 unavailable: carry on with IPv4 only.
  }
  console.log(`Siege Mind dev server:\n  http://localhost:${port}\n  http://127.0.0.1:${port}\n  bound: ${bound.join(', ')}`);
}

// Compare resolved paths so this works with Windows drive letters/backslashes.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
