const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse Target Scanner headroom fix.
// Replays successful Build #90, then fixes the API-budget behavior seen in testing:
// - ALL BALDR is explicitly selected on load
// - compact dashboard scans only the two rows it actually displays
// - automatic/manual page scans preserve a dedicated reserve for ATTACK verification
// - failed target checks wait before automatic retry instead of immediately burning the budget
// - scanner cooldown is shown inline instead of a blocking popup
const BASE_COMMIT = 'e2ff8b47e119973cf138a3b12d41d2fa62b647b3';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const TEMP_BASE = path.join(process.cwd(), '.tornpulse-build90-known-good.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=112', 'origin', 'main'], {stdio:'ignore'});
  } catch (_) {}
  const base = execFileSync('git', ['show', `${BASE_COMMIT}:${BASE_PATH}`], {encoding:'utf8'});
  fs.writeFileSync(TEMP_BASE, base, 'utf8');
  execFileSync(process.execPath, [TEMP_BASE], {stdio:'inherit'});
} finally {
  try { fs.unlinkSync(TEMP_BASE); } catch (_) {}
}

let src = fs.readFileSync(CONFIG_FILE, 'utf8');

function extractEmbedded(name) {
  const prefix = `const ${name} = `;
  const start = src.indexOf(prefix);
  if (start < 0) throw new Error(`TornPulse scanner fix: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse scanner fix: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') {
    throw new Error(`TornPulse scanner fix: could not parse ${name}`);
  }
  return {start:valueStart,end:i+1,value:JSON.parse(src.slice(valueStart,i+1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0,found.start) + JSON.stringify(value) + src.slice(found.end);
}

function replaceExact(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`TornPulse scanner fix: expected 1 match for ${label}, found ${count}`);
  }
  console.log(`✓ ${label}`);
  return text.replace(oldText, newText);
}

let app = extractEmbedded('APP_JS').value;

// Keep a protected slice of TornPulse's internal 70-call scanner allowance.
// This reserve is only for the final per-target ATTACK verification.
app = replaceExact(
  app,
  `const TARGET_API_BUDGET = 70;
const TARGET_API_WINDOW_MS = 60000;
const TARGET_STATUS_TTL_MS = 60000;`,
  `const TARGET_API_BUDGET = 70;
const TARGET_ATTACK_RESERVE = 12;
const TARGET_API_WINDOW_MS = 60000;
const TARGET_STATUS_TTL_MS = 60000;
const TARGET_ERROR_RETRY_MS = 30000;`,
  'scanner attack reserve + error cooldown constants'
);

// Failed API checks must not immediately trigger another 36-target automatic sweep.
app = replaceExact(
  app,
  `  const status = String(target.status || 'unknown');
  if (!targetStatusConfirmed(status)) return true;
  if (status === 'hospital' && Number(target.until) > 0 && Number(target.until) <= Math.floor(Number(nowMs)/1000)) return true;`,
  `  const status = String(target.status || 'unknown');
  if (status === 'error') return targetStatusAgeMs(target,nowMs) >= TARGET_ERROR_RETRY_MS;
  if (!targetStatusConfirmed(status)) return true;
  if (status === 'hospital' && Number(target.until) > 0 && Number(target.until) <= Math.floor(Number(nowMs)/1000)) return true;`,
  'failed target checks back off for 30 seconds'
);

// Make the master list explicit rather than relying only on sort order.
app = replaceExact(
  app,
  `        setLists(normalized);
        setListName(names[0]);`,
  `        setLists(normalized);
        setListName(names.includes('ALL BALDR') ? 'ALL BALDR' : names[0]);`,
  'ALL BALDR forced as opening list'
);

// Do not burn 36 live checks for the two-row dashboard preview.
// Also preserve 12 calls for ATTACK verification even after manual refreshes/page changes.
app = replaceExact(
  app,
  `    const budget = Math.max(0,TARGET_API_BUDGET-recent.length);
    if (budget <= 0) {
      const wait = Math.max(1,Math.ceil((TARGET_API_WINDOW_MS-(current-recent[0]))/1000));
      if (!auto) Alert.alert('Scanner cooling down','TornPulse reserved API headroom. Try again in about ' + wait + ' seconds.');
      setMessage('API headroom reserved • ' + wait + 's');
      return;
    }
    const scanPool = auto ? pageTargets.filter(t => targetNeedsLiveCheck(t,current)) : pageTargets;
    const candidates = scanPool.slice(0,budget);`,
  `    const budget = Math.max(0,TARGET_API_BUDGET-recent.length);
    const scanBudget = Math.max(0,budget-TARGET_ATTACK_RESERVE);
    if (scanBudget <= 0) {
      const oldest = recent[0] || current;
      const wait = Math.max(1,Math.ceil((TARGET_API_WINDOW_MS-(current-oldest))/1000));
      setMessage('Attack reserve protected • scanner resumes in about ' + wait + 's');
      return;
    }
    const visiblePool = compact ? pageTargets.slice(0,2) : pageTargets;
    const scanPool = auto ? visiblePool.filter(t => targetNeedsLiveCheck(t,current)) : visiblePool;
    const candidates = scanPool.slice(0,scanBudget);`,
  'smart scanner pool + protected attack headroom'
);

// Make the UI explain the protected reserve.
app = app.replace(
  `API {apiBudget}/{TARGET_API_BUDGET}`,
  `API {apiBudget}/{TARGET_API_BUDGET} • {TARGET_ATTACK_RESERVE} RESERVED`
);

if (!app.includes('TARGET_ATTACK_RESERVE = 12')) {
  throw new Error('TornPulse scanner fix: attack reserve was not installed');
}
if (!app.includes(`compact ? pageTargets.slice(0,2) : pageTargets`)) {
  throw new Error('TornPulse scanner fix: compact scan limiter was not installed');
}
if (!app.includes(`names.includes('ALL BALDR') ? 'ALL BALDR' : names[0]`)) {
  throw new Error('TornPulse scanner fix: ALL BALDR default was not installed');
}

setEmbedded('APP_JS', app);
fs.writeFileSync(CONFIG_FILE, src);

console.log('✓ TornPulse scanner headroom fix applied');
