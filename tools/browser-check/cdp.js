// Minimal Chrome DevTools Protocol client on Node's built-in global WebSocket.
import { BrowserUnavailable } from './chrome.js';

/**
 * @param {string} wsUrl page target URL
 * @returns {Promise<{send: (method: string, params?: object) => Promise<any>, on: (event: string, fn: (params: any) => void) => void, close: () => void}>}
 */
export async function connect(wsUrl) {
  if (typeof WebSocket === 'undefined') throw new BrowserUnavailable('this Node has no global WebSocket (Node 22+ is required)');
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', () => reject(new Error('DevTools connection failed')), { once: true }); });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`)); else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    }
  });
  return {
    send: (method, params = {}) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }),
    on: (event, fn) => { listeners.set(event, [...(listeners.get(event) ?? []), fn]); },
    close: () => { try { ws.close(); } catch { /* already closed */ } },
  };
}
