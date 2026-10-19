// Pure helpers for the browser-check tool: argument parsing and the list of Chrome executables to try.
import { join } from 'node:path';

const DEFAULTS = Object.freeze({ wait: 3000, width: 1280, height: 720, timeout: 30000 });
const NUMBER_FLAGS = Object.freeze({ wait: [0, 600000], width: [100, 8000], height: [100, 8000], timeout: [1000, 600000] });
const STRING_FLAGS = Object.freeze(['url', 'base', 'shot', 'eval']);

/**
 * @param {string[]} argv arguments after the script name, each as --name=value
 * @returns {{url?: string, base?: string, wait: number, shot?: string, width: number, height: number, eval?: string, timeout: number}}
 * @throws {Error} for unknown flags, malformed arguments, bad numbers or a --shot name that is not a plain file name
 */
export function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (const arg of argv) {
    const m = /^--([a-z]+)=(.*)$/s.exec(arg);
    if (!m) throw new Error(`unrecognized argument: ${arg} (use --name=value)`);
    const [, name, value] = m;
    if (name in NUMBER_FLAGS) {
      const [min, max] = NUMBER_FLAGS[name];
      const n = Number(value);
      if (!/^\d+$/.test(value) || n < min || n > max) throw new RangeError(`--${name} must be an integer from ${min} to ${max}, got "${value}"`);
      out[name] = n;
    } else if (STRING_FLAGS.includes(name)) {
      if (value === '') throw new Error(`--${name} needs a value`);
      if (name === 'shot') checkShotName(value);
      out[name] = value;
    } else {
      throw new Error(`unknown flag: --${name}`);
    }
  }
  return out;
}

/** Screenshots land inside the tool's out folder: a bare file name only. */
function checkShotName(name) {
  if (/[\\/]/.test(name) || name.includes('..') || name.includes('\0') || /^[A-Za-z]:/.test(name)) throw new Error(`--shot must be a plain file name inside the out folder, got "${name}"`);
}

/** @param {string} name validated --shot name @param {string} outDir @returns {string} absolute path inside outDir */
export function shotPath(name, outDir) {
  checkShotName(name);
  return join(outDir, name);
}

/**
 * Ordered places to look for a Chrome, Chromium or Edge executable.
 * @param {'win32'|'darwin'|'linux'|string} platform @param {Record<string, string|undefined>} env
 * @returns {string[]}
 */
export function chromeCandidates(platform, env) {
  const list = [];
  if (env.CHROME_PATH) list.push(env.CHROME_PATH);
  if (platform === 'win32') {
    const pf = env.PROGRAMFILES ?? 'C:\\Program Files';
    const pf86 = env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
    const local = env.LOCALAPPDATA;
    list.push(`${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Google\\Chrome\\Application\\chrome.exe`);
    if (local) list.push(`${local}\\Google\\Chrome\\Application\\chrome.exe`);
    list.push(`${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`);
  } else if (platform === 'darwin') {
    list.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    list.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/bin/microsoft-edge');
  }
  return list;
}
