const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse exact-brand + Torn-bar-color wrapper.
// This intentionally replays the known-good current HUD patch first,
// then applies ONLY the requested brand image and resource color changes.
const BASE_COMMIT = 'c8a9222ae3737b72aff1d96035dc54ecb7a734a6';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const TEMP_BASE = path.join(process.cwd(), '.tornpulse-v100-known-good.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=64', 'origin', 'main'], {stdio:'ignore'});
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
  if (start < 0) throw new Error(`TornPulse exact-brand patch: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse exact-brand patch: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse exact-brand patch: could not parse ${name}`);
  return {start:valueStart,end:i+1,value:JSON.parse(src.slice(valueStart,i+1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0, found.start) + JSON.stringify(value) + src.slice(found.end);
}

function ensureImageImport(app) {
  if (/import \{[^}]*\bImage\b[^}]*\} from 'react-native';/s.test(app)) return app;
  const re = /import \{([^}]+)\} from 'react-native';/s;
  if (!re.test(app)) throw new Error('TornPulse exact-brand patch: React Native import not found');
  return app.replace(re, (m, names) => {
    const clean = names.trim().replace(/,\s*$/, '');
    return `import {${clean}, Image} from 'react-native';`;
  });
}

function setNamedColor(app, key, color) {
  const re = new RegExp(`(${key}:\\s*)'#[0-9A-Fa-f]{6}'`);
  if (re.test(app)) {
    app = app.replace(re, `$1'${color}'`);
    console.log(`✓ ${key} color constant -> ${color}`);
  }
  return app;
}

function setAccentByLabel(app, label, color) {
  let changed = false;

  // label appears before accent: one capture group only.
  // Keep the callback arity exact so the regex match offset is never appended to JSX.
  const labelFirst = new RegExp(`(<[^>]+label=["']${label}["'][^>]*?accent=)["']#[0-9A-Fa-f]{6}["']`, 'g');
  app = app.replace(labelFirst, (m, prefix) => {
    changed = true;
    return `${prefix}"${color}"`;
  });

  // accent appears before label: preserve both surrounding capture groups.
  const accentFirst = new RegExp(`(<[^>]+accent=)["']#[0-9A-Fa-f]{6}["']([^>]*?label=["']${label}["'])`, 'g');
  app = app.replace(accentFirst, (m, prefix, suffix) => {
    changed = true;
    return `${prefix}"${color}"${suffix}`;
  });

  if (changed) console.log(`✓ ${label} accent -> ${color}`);
  return app;
}

let app = extractEmbedded('APP_JS').value;
app = ensureImageImport(app);

// Replace the generated text wordmark + recreated heartbeat with the exact uploaded artwork.
const brandRe = /<Text style=\{styles\.tpBrand\}>TORN<Text style=\{styles\.tpBrandAccent\}>PULSE<\/Text><\/Text>\s*<TPHeartbeat\/>/;
if (!brandRe.test(app)) {
  throw new Error('TornPulse exact-brand patch: main TPTopBar wordmark was not found');
}
app = app.replace(
  brandRe,
  `<Image source={require('./tornpulse-header.png')} style={styles.tpBrandImage} resizeMode="contain"/>`
);
console.log('✓ exact TornPulse artwork installed in main top bar');

// Give the real artwork the full center slot between refresh and menu buttons.
if (!app.includes('tpBrandImage:{')) {
  const wrapRe = /(tpBrandWrap:\{[^}]+\},)/;
  if (!wrapRe.test(app)) throw new Error('TornPulse exact-brand patch: tpBrandWrap style not found');
  app = app.replace(
    wrapRe,
    `$1tpBrandImage:{width:240,height:78,maxWidth:'100%'},`
  );
}

// Torn resource color roles: Life blue, Energy green, Nerve red, Happy yellow.
// The app currently shows Life/Health, Energy and Nerve; Happy is set too for future use.
const LIFE   = '#4EA5E8';
const ENERGY = '#67C94A';
const NERVE  = '#D94A4A';
const HAPPY  = '#E7B93F';

app = setNamedColor(app, 'life', LIFE);
app = setNamedColor(app, 'energy', ENERGY);
app = setNamedColor(app, 'nerve', NERVE);
app = setNamedColor(app, 'happy', HAPPY);
app = setAccentByLabel(app, 'HEALTH', LIFE);
app = setAccentByLabel(app, 'LIFE', LIFE);
app = setAccentByLabel(app, 'ENERGY', ENERGY);
app = setAccentByLabel(app, 'NERVE', NERVE);
app = setAccentByLabel(app, 'HAPPY', HAPPY);

// Build-safety guard: an accent prop must close directly after the color string.
if (/accent=["']#[0-9A-Fa-f]{6}["']\d/.test(app)) {
  throw new Error('TornPulse exact-brand patch: malformed accent prop detected');
}

// Native floating HUD: match the same resource colors by semantic span position.
let kt = extractEmbedded('OVERLAY_SERVICE_KT').value;

function replaceSpanColor(text, targetRe, rgb, label) {
  if (!targetRe.test(text)) {
    console.log(`- native ${label} color span not found; leaving existing native style`);
    return text;
  }
  const out = text.replace(targetRe, (m, prefix, suffix) => `${prefix}Color.rgb(${rgb})${suffix}`);
  console.log(`✓ native ${label} color -> rgb(${rgb})`);
  return out;
}

kt = replaceSpanColor(
  kt,
  /(styled\.setSpan\(ForegroundColorSpan\()Color\.rgb\(\d+\s*,\s*\d+\s*,\s*\d+\)(\),\s*0,\s*life\.length,\s*Spannable\.SPAN_EXCLUSIVE_EXCLUSIVE\))/,
  '78, 165, 232',
  'life'
);
kt = replaceSpanColor(
  kt,
  /(styled\.setSpan\(ForegroundColorSpan\()Color\.rgb\(\d+\s*,\s*\d+\s*,\s*\d+\)(\),\s*energyStart,\s*energyStart\s*\+\s*energy\.length,\s*Spannable\.SPAN_EXCLUSIVE_EXCLUSIVE\))/,
  '103, 201, 74',
  'energy'
);
kt = replaceSpanColor(
  kt,
  /(styled\.setSpan\(ForegroundColorSpan\()Color\.rgb\(\d+\s*,\s*\d+\s*,\s*\d+\)(\),\s*nerveStart,\s*text\.length,\s*Spannable\.SPAN_EXCLUSIVE_EXCLUSIVE\))/,
  '217, 74, 74',
  'nerve'
);

setEmbedded('APP_JS', app);
setEmbedded('OVERLAY_SERVICE_KT', kt);
fs.writeFileSync(CONFIG_FILE, src);
console.log('✓ TornPulse exact logo + Torn resource colors applied');
