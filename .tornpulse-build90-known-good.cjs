const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse Baldr master target-list upgrade.
// Replays successful Build #89 exactly, then:
// - combines every maintained Baldr set into one ALL BALDR master list
// - deduplicates by Torn user ID
// - preserves name, level, total, STR, DEF, SPD, DEX
// - makes ALL BALDR the default Target Radar source
// - keeps the original Baldr sets available through the list selector
// - keeps the ALL BALDR view strictly Baldr-only (no Trip AFK extras)
const BASE_COMMIT = 'a52543c7e24c58a758ab1c2fb31c8dc0d19b9741';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const TEMP_BASE = path.join(process.cwd(), '.tornpulse-build89-known-good.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=96', 'origin', 'main'], {stdio:'ignore'});
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
  if (start < 0) throw new Error(`TornPulse Baldr master patch: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse Baldr master patch: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') {
    throw new Error(`TornPulse Baldr master patch: could not parse ${name}`);
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
    throw new Error(`TornPulse Baldr master patch: expected 1 match for ${label}, found ${count}`);
  }
  console.log(`✓ ${label}`);
  return text.replace(oldText, newText);
}

let app = extractEmbedded('APP_JS').value;

app = replaceExact(
  app,
  `function targetListShortName(name) {
  if (name === "Baldr's List 3") return 'SET 1';`,
  `function targetListShortName(name) {
  if (name === 'ALL BALDR') return 'ALL BALDR';
  if (name === "Baldr's List 3") return 'SET 1';`,
  'ALL BALDR short name'
);

app = replaceExact(
  app,
  `function targetSetRole(name) {
  if (name === "Baldr's List 3") return 'LOW LEVEL';`,
  `function targetSetRole(name) {
  if (name === 'ALL BALDR') return 'MASTER LIST';
  if (name === "Baldr's List 3") return 'LOW LEVEL';`,
  'ALL BALDR master role'
);

app = replaceExact(
  app,
  `  const preferred = [
    "Baldr's List 3",`,
  `  const preferred = [
    'ALL BALDR',
    "Baldr's List 3",`,
  'ALL BALDR first in target source order'
);

const oldNormalize = `        const normalized = {};
        Object.keys(raw || {}).forEach(name => {
          const rows = Array.isArray(raw[name]) ? raw[name] : [];
          normalized[name] = rows.map(normalizeBaldrTarget).filter(t => t.id > 0);
        });
        if (!live) return;
        const names = targetOrderedListNames(normalized);`;

const newNormalize = `        const normalized = {};
        const allBaldrById = {};
        Object.keys(raw || {}).forEach(name => {
          const rows = Array.isArray(raw[name]) ? raw[name] : [];
          normalized[name] = rows.map(normalizeBaldrTarget).filter(t => t.id > 0);

          normalized[name].forEach(target => {
            const id = Number(target.id || 0);
            if (!id) return;

            const previous = allBaldrById[id];
            const baldrLists = Array.from(new Set([...(previous?.baldrLists || []), name]));

            const useIncoming = !previous ||
              Number(target.total || 0) > Number(previous.total || 0) ||
              (Number(target.total || 0) === Number(previous.total || 0) &&
               Number(target.level || 0) > Number(previous.level || 0));

            allBaldrById[id] = {
              ...(useIncoming ? target : previous),
              baldrLists,
            };
          });
        });

        normalized['ALL BALDR'] = Object.values(allBaldrById).sort((a,b) =>
          Number(a.level || 0) - Number(b.level || 0) ||
          Number(a.total || 0) - Number(b.total || 0) ||
          String(a.name || '').localeCompare(String(b.name || ''))
        );

        if (!live) return;
        const names = targetOrderedListNames(normalized);`;

app = replaceExact(app, oldNormalize, newNormalize, 'combine all Baldr target sets');

app = replaceExact(
  app,
  `  const afkTargets = (demo ? [] : TRIP_AFK_TARGETS)`,
  `  const afkTargets = (demo || listName === 'ALL BALDR' ? [] : TRIP_AFK_TARGETS)`,
  'strict Baldr-only master view'
);

app = replaceExact(
  app,
  `        setMessage('Target radar loaded • sources merged');`,
  `        setMessage('Baldr master loaded • ' + (normalized['ALL BALDR']?.length || 0) + ' targets');`,
  'Baldr master load count'
);

app = app.replace(
  `Low → mid → high target sets with live availability and battle stats.`,
  `Complete Baldr master list with live availability and battle stats.`
);

if (!app.includes(`normalized['ALL BALDR']`)) {
  throw new Error('TornPulse Baldr master patch: master database was not installed');
}
if (!app.includes(`listName === 'ALL BALDR'`)) {
  throw new Error('TornPulse Baldr master patch: strict master source guard missing');
}

setEmbedded('APP_JS', app);
fs.writeFileSync(CONFIG_FILE, src);

console.log('✓ TornPulse ALL BALDR master target database installed');
