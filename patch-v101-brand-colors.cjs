const fs = require('fs');

const CONFIG_FILE = 'app.config.js';
let src = fs.readFileSync(CONFIG_FILE, 'utf8');

function extractEmbedded(name) {
  const prefix = `const ${name} = `;
  const start = src.indexOf(prefix);
  if (start < 0) throw new Error(`TornPulse v1.0.1: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse v1.0.1: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse v1.0.1: could not parse ${name}`);
  return {start:valueStart,end:i+1,value:JSON.parse(src.slice(valueStart,i+1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0, found.start) + JSON.stringify(value) + src.slice(found.end);
}

let app = extractEmbedded('APP_JS').value;
let kt = extractEmbedded('OVERLAY_SERVICE_KT').value;

// Add React Native Image import without depending on import ordering.
app = app.replace(/import \{([^}]*)\} from 'react-native';/, (full, names) => {
  const parts = names.split(',').map(x => x.trim()).filter(Boolean);
  if (!parts.includes('Image')) parts.push('Image');
  return `import {${parts.join(', ')}} from 'react-native';`;
});

// Replace the generated TornPulse wordmark/heartbeat with the exact uploaded artwork.
const brandBlock = /<View style=\{styles\.tpBrandWrap\}>\s*<Text style=\{styles\.tpBrand\}>TORN<Text style=\{styles\.tpBrandAccent\}>PULSE<\/Text><\/Text>\s*<TPHeartbeat\s*\/>\s*<\/View>/;
if (!brandBlock.test(app)) {
  throw new Error('TornPulse v1.0.1: could not locate the current dashboard brand block');
}
app = app.replace(
  brandBlock,
  `<View style={styles.tpBrandWrap}><Image source={require('./tornpulse-header.png')} style={{width:230,height:82}} resizeMode="contain"/></View>`
);
console.log('✓ exact TornPulse header artwork');

// Match Torn's familiar bar scheme: Life blue, Energy green, Nerve red.
const colorReplacements = [
  [/life:\s*'#[0-9A-Fa-f]{6}'/, "life:'#4A9FE6'", 'Life / Health blue'],
  [/energy:\s*'#[0-9A-Fa-f]{6}'/, "energy:'#69B83F'", 'Energy green'],
  [/nerve:\s*'#[0-9A-Fa-f]{6}'/, "nerve:'#D94A45'", 'Nerve red'],
];
for (const [re, value, label] of colorReplacements) {
  if (re.test(app)) { app = app.replace(re, value); console.log(`✓ ${label}`); }
  else console.log(`- ${label}: existing theme entry not found; native HUD still updated`);
}

// Native floating HUD colors, matched by the span targets rather than old RGB values.
kt = kt.replace(
  /styled\.setSpan\(ForegroundColorSpan\(Color\.rgb\(\d+\s*,\s*\d+\s*,\s*\d+\)\), 0, life\.length, Spannable\.SPAN_EXCLUSIVE_EXCLUSIVE\)/,
  'styled.setSpan(ForegroundColorSpan(Color.rgb(74, 159, 230)), 0, life.length, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)'
);
kt = kt.replace(
  /styled\.setSpan\(ForegroundColorSpan\(Color\.rgb\(\d+\s*,\s*\d+\s*,\s*\d+\)\), energyStart, energyStart \+ energy\.length, Spannable\.SPAN_EXCLUSIVE_EXCLUSIVE\)/,
  'styled.setSpan(ForegroundColorSpan(Color.rgb(105, 184, 63)), energyStart, energyStart + energy.length, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)'
);
kt = kt.replace(
  /styled\.setSpan\(ForegroundColorSpan\(Color\.rgb\(\d+\s*,\s*\d+\s*,\s*\d+\)\), nerveStart, text\.length, Spannable\.SPAN_EXCLUSIVE_EXCLUSIVE\)/,
  'styled.setSpan(ForegroundColorSpan(Color.rgb(217, 74, 69)), nerveStart, text.length, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)'
);
console.log('✓ floating HUD Torn colors');

setEmbedded('APP_JS', app);
setEmbedded('OVERLAY_SERVICE_KT', kt);
fs.writeFileSync(CONFIG_FILE, src);
console.log('✓ TornPulse v1.0.1 brand + Torn colors applied');
