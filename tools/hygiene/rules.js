// Pure core of the public-repository hygiene scanner: line rules, redaction, size check and allowlist validation. No file access here.

/** Role mailboxes (info@, noreply@ ...) are not personal addresses; they appear in license notices. */
const ROLE_LOCAL = /^(info|noreply|no-reply|support|contact|hello|admin)$/i;

export const LINE_RULES = Object.freeze([
  { id: 'home-path', re: /(?:[A-Za-z]:[\\/]+Users[\\/]|\/Users\/|\/home\/)[A-Za-z0-9_.-]+/g },
  { id: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, accept: (m) => ROLE_LOCAL.test(m.split('@')[0]) },
  { id: 'github-token', re: /\b(?:ghp_|gho_|ghs_|github_pat_)[A-Za-z0-9_]{10,}/g },
  { id: 'api-key', re: /\b(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{20,})/g },
  { id: 'private-key', re: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g },
]);

export const MAX_FILE_BYTES = 1024 * 1024;

/** Shows only a short prefix of a matched text. @param {string} s @returns {string} */
export function redact(s) {
  return `${s.slice(0, 4)}…[${s.length} chars]`;
}

/** @param {string} text @returns {{rule: string, line: number, sample: string}[]} findings of the line rules (redacted samples) */
export function scanText(text) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of LINE_RULES) {
      for (const m of line.matchAll(rule.re)) {
        if (rule.accept?.(m[0])) continue;
        out.push({ rule: rule.id, line: i + 1, sample: redact(m[0]) });
      }
    }
  });
  return out;
}

/** @param {string} path repo-relative path with forward slashes @returns {boolean} an env file (.env, .env.local ...) that must not be tracked */
export function isEnvFile(path) {
  const name = path.split('/').pop();
  return name === '.env' || (name.startsWith('.env.') && !/\.(example|sample|template)$/.test(name));
}

/** Frozen or generated study outputs: the only files an allowlist entry may name. @param {string} path @returns {boolean} */
export function isStudyFile(path) {
  if (path === 'docs/results/README.md') return false; // hand-written explanation
  return /^docs\/results\//.test(path) || /^docs\/(RESULTS|AUDIT)\.md$/.test(path) || /^docs\/fixtures\//.test(path)
    || path === 'experiments/heldout.lock.json' || path === 'src/data/directorBaseline.js' || /^tests\/golden\//.test(path);
}

/** @param {{path: string, rule: string, reason: string}[]} entries @returns {string[]} problems (empty when the allowlist is acceptable) */
export function validateAllowlist(entries) {
  const problems = [];
  for (const e of entries) {
    if (!e.path || !e.rule || !e.reason) problems.push(`entry needs path, rule and reason: ${JSON.stringify(e)}`);
    else if (!isStudyFile(e.path)) problems.push(`${e.path}: only frozen or generated study files may be allowlisted`);
  }
  return problems;
}

/**
 * @param {{path: string, text: string | null, size: number}[]} files text is null for binary files
 * @param {{path: string, rule: string}[]} allowlist
 * @returns {{findings: {path: string, rule: string, line: number, sample: string}[], allowed: object[]}} findings not covered by the allowlist, and the ones that were
 */
export function scanFiles(files, allowlist) {
  const all = [];
  for (const f of files) {
    if (isEnvFile(f.path)) all.push({ path: f.path, rule: 'env-file', line: 0, sample: '' });
    if (f.size > MAX_FILE_BYTES) all.push({ path: f.path, rule: 'large-file', line: 0, sample: `${f.size} bytes` });
    if (f.text !== null) for (const x of scanText(f.text)) all.push({ path: f.path, ...x });
  }
  const covered = (x) => allowlist.some((a) => a.path === x.path && a.rule === x.rule);
  return { findings: all.filter((x) => !covered(x)), allowed: all.filter(covered) };
}
