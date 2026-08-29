const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse instant hospital-release + manual refresh fix.
// Replays the current known-good app, then changes only Target Radar availability logic.
const BASE_COMMIT = 'fcd4dca0b15b8434b8de2c15614b2a6f596b69a4';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const TEMP_BASE = path.join(process.cwd(), '.tornpulse-current-known-good.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=192', 'origin', 'main'], {stdio:'ignore'});
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
  if (start < 0) throw new Error(`TornPulse instant targets: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse instant targets: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') {
    throw new Error(`TornPulse instant targets: could not parse ${name}`);
  }
  return {start:valueStart,end:i+1,value:JSON.parse(src.slice(valueStart,i+1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0,found.start) + JSON.stringify(value) + src.slice(found.end);
}


function functionBlockEnd(text, start, label) {
  const open = text.indexOf(') {', start);
  if (open < 0) throw new Error(`TornPulse instant targets: ${label} opening brace not found`);
  let depth = 0;
  for (let i=open+2;i<text.length;i++) {
    const ch=text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i+1;
    }
  }
  throw new Error(`TornPulse instant targets: ${label} closing brace not found`);
}

function replaceExact(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`TornPulse instant targets: expected 1 match for ${label}, found ${count}`);
  }
  console.log(`✓ ${label}`);
  return text.replace(oldText,newText);
}

let app = extractEmbedded('APP_JS').value;

// ---------------------------------------------------------------------------
// 1) Hospital countdown reaching zero becomes READY immediately in the UI.
//    We still keep the existing live pre-attack verification before opening Torn.
// ---------------------------------------------------------------------------
const statusMarker = 'function targetStatusText(target, clock) {';
const statusAt = app.indexOf(statusMarker);
if (statusAt < 0) throw new Error('TornPulse instant targets: targetStatusText helper not found');

const instantHelpers = `function targetHospitalExpired(target, clock=Date.now()) {
  if (!target || String(target.status || '') !== 'hospital') return false;
  const until = Number(target.until || 0);
  if (!(until > 0)) return false;
  return until <= Math.floor(Number(clock || Date.now())/1000);
}
function targetEffectiveStatus(target, clock=Date.now()) {
  return targetHospitalExpired(target,clock) ? 'okay' : String((target && target.status) || 'unknown');
}
function targetDisplayTarget(target, clock=Date.now()) {
  if (!target) return target;
  const status = targetEffectiveStatus(target,clock);
  if (status === target.status) return target;
  return {...target,status,statusDescription:'Hospital timer expired • live verify on attack'};
}

`;
app = app.slice(0,statusAt) + instantHelpers + app.slice(statusAt);
console.log('✓ instant hospital-expiry helpers');

app = replaceExact(
  app,
  `    if (left <= 0) return 'READY?';`,
  `    if (left <= 0) return 'READY';`,
  'zero-second hospital label becomes READY'
);

// ---------------------------------------------------------------------------
// 2) Manual refresh may borrow the AUTO scanner reserve, while always leaving
//    one API slot available for a final pre-attack verification.
// ---------------------------------------------------------------------------
const oldScannerBudget = `    const budget = Math.max(0,TARGET_API_BUDGET-recent.length);
    const scanBudget = Math.max(0,budget-TARGET_ATTACK_RESERVE);
    if (scanBudget <= 0) {
      const oldest = recent[0] || current;
      const wait = Math.max(1,Math.ceil((TARGET_API_WINDOW_MS-(current-oldest))/1000));
      setMessage('Attack reserve protected • scanner resumes in about ' + wait + 's');
      return;
    }
    const visiblePool = compact ? pageTargets.slice(0,2) : pageTargets;
    const scanPool = auto ? visiblePool.filter(t => targetNeedsLiveCheck(t,current)) : visiblePool;
    const candidates = scanPool.slice(0,scanBudget);`;

const newScannerBudget = `    const budget = Math.max(0,TARGET_API_BUDGET-recent.length);
    const protectedCalls = auto ? TARGET_ATTACK_RESERVE : 1;
    const scanBudget = Math.max(0,budget-protectedCalls);
    if (scanBudget <= 0) {
      const oldest = recent[0] || current;
      const wait = Math.max(1,Math.ceil((TARGET_API_WINDOW_MS-(current-oldest))/1000));
      setMessage(auto
        ? 'Attack reserve protected • scanner resumes in about ' + wait + 's'
        : 'Refresh cooling down • one attack check kept free • about ' + wait + 's');
      return;
    }
    const visiblePool = compact ? pageTargets.slice(0,2) : pageTargets;
    const scanPool = auto ? visiblePool.filter(t => targetNeedsLiveCheck(t,current)) : visiblePool;
    const candidates = scanPool.slice(0,scanBudget);`;

app = replaceExact(app,oldScannerBudget,newScannerBudget,'manual refresh can use auto reserve');
app = app.replace(
  `API {apiBudget}/{TARGET_API_BUDGET} • {TARGET_ATTACK_RESERVE} RESERVED`,
  `API {apiBudget}/{TARGET_API_BUDGET} • {TARGET_ATTACK_RESERVE} AUTO RES`
);

// ---------------------------------------------------------------------------
// 3) Keep RAW status for API scan decisions, but derive a display page every
//    second from the live clock. This makes READY/HOSP counts, filters and rows
//    switch on the exact second the hospital timer expires.
// ---------------------------------------------------------------------------
const assistantStart = app.indexOf('function TargetAssistant(');
if (assistantStart < 0) throw new Error('TornPulse instant targets: TargetAssistant block not found');
const assistantEnd = functionBlockEnd(app,assistantStart,'TargetAssistant');
let assistant = app.slice(assistantStart,assistantEnd);

const pageMatch = assistant.match(/(^|\n)([ \t]*)const pageTargets\s*=\s*([^;\n]+);/);
if (!pageMatch) throw new Error('TornPulse instant targets: pageTargets declaration not found');
const fullPageDecl = pageMatch[0];
const lead = pageMatch[1] || '';
const indent = pageMatch[2] || '  ';
const expression = pageMatch[3].trim();
const replacementPageDecl = `${lead}${indent}const rawPageTargets = ${expression};\n${indent}const pageTargets = rawPageTargets.map(t => targetDisplayTarget(t,clock));`;
assistant = assistant.replace(fullPageDecl,replacementPageDecl);
console.log('✓ second-by-second display target page');

// The scanner must continue to use raw API state so an expired hospital status
// is recognized by targetNeedsLiveCheck and can be confirmed on the next scan.
const scanStart = assistant.indexOf(`${indent}async function scanPage(`);
if (scanStart < 0) throw new Error('TornPulse instant targets: scanPage block not found');
const scanEnd = functionBlockEnd(assistant,scanStart,'scanPage');
let scanBlock = assistant.slice(scanStart,scanEnd);
scanBlock = scanBlock.replace(/\bpageTargets\b/g,'rawPageTargets');
assistant = assistant.slice(0,scanStart) + scanBlock + assistant.slice(scanEnd);
console.log('✓ scanner preserved on raw target status');

app = app.slice(0,assistantStart) + assistant + app.slice(assistantEnd);

// ---------------------------------------------------------------------------
// 4) Row-level fallback. Even if a target comes from a compact/alternate feed,
//    its fade, status glyph and ATTACK button use the effective clock status.
// ---------------------------------------------------------------------------
const rowStart = app.indexOf('function TargetRow(');
if (rowStart < 0) throw new Error('TornPulse instant targets: TargetRow block not found');
const rowEnd = functionBlockEnd(app,rowStart,'TargetRow');
let rowBlock = app.slice(rowStart,rowEnd);
const rowFirstLineEnd = rowBlock.indexOf('\n');
if (rowFirstLineEnd < 0) throw new Error('TornPulse instant targets: TargetRow first line malformed');
rowBlock = rowBlock.slice(0,rowFirstLineEnd+1) + `  const effectiveStatus=targetEffectiveStatus(target,clock);\n` + rowBlock.slice(rowFirstLineEnd+1);
rowBlock = rowBlock.replace(/target\.status\b/g,'effectiveStatus');
app = app.slice(0,rowStart) + rowBlock + app.slice(rowEnd);
console.log('✓ row fade/button status flips instantly');

// Build guards: fail loudly instead of shipping a half-applied target patch.
if (!app.includes('function targetEffectiveStatus(')) {
  throw new Error('TornPulse instant targets: effective-status helper missing');
}
if (!app.includes('const protectedCalls = auto ? TARGET_ATTACK_RESERVE : 1;')) {
  throw new Error('TornPulse instant targets: manual refresh reserve override missing');
}
if (!app.includes('const rawPageTargets = ') || !app.includes('rawPageTargets.map(t => targetDisplayTarget(t,clock))')) {
  throw new Error('TornPulse instant targets: raw/display page split missing');
}
if (app.includes(`if (left <= 0) return 'READY?';`)) {
  throw new Error('TornPulse instant targets: stale READY? behavior remains');
}
if (!app.includes('onVerifyTarget')) {
  throw new Error('TornPulse instant targets: pre-attack verification unexpectedly missing');
}

setEmbedded('APP_JS',app);
fs.writeFileSync(CONFIG_FILE,src);
console.log('✓ TornPulse instant target readiness + manual refresh fix applied');
