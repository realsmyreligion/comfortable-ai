const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// First apply the verified dashboard/header remodel from Build #147.
execFileSync(process.execPath, [path.join(__dirname, 'tornpulse-dashboard-base.cjs')], {
  stdio: 'inherit',
});

// Install the official full TP pulse emblem anywhere the Android/Expo project
// may source its launcher, adaptive, splash or in-app application icon.
const officialIcon = path.join(__dirname, 'tornpulse-app-icon.png');
if (!fs.existsSync(officialIcon)) throw new Error('Missing tornpulse-app-icon.png');
for (const target of [
  'icon.png',
  'adaptive-icon.png',
  'splash-icon.png',
  'tornpulse-icon.png',
  path.join('assets', 'icon.png'),
  path.join('assets', 'adaptive-icon.png'),
  path.join('assets', 'splash-icon.png'),
  path.join('assets', 'tornpulse-icon.png'),
]) {
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  fs.copyFileSync(officialIcon, target);
}
console.log('✓ official TP pulse app-icon assets installed');

let src = fs.readFileSync('app.config.js', 'utf8');

function getEmbedded(name) {
  const prefix = `const ${name} = `;
  const start = src.indexOf(prefix);
  if (start < 0) throw new Error(`Missing ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length) throw new Error(`Could not parse ${name}`);
  return { start: valueStart, end: i + 1, value: JSON.parse(src.slice(valueStart, i + 1)) };
}

function setEmbedded(name, value) {
  const found = getEmbedded(name);
  src = src.slice(0, found.start) + JSON.stringify(value) + src.slice(found.end);
}

function replaceExact(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count === 0) {
    console.log(`• ${label} already updated or not used by this HUD revision`);
    return text;
  }
  if (count > 1) throw new Error(`Expected at most one ${label}; found ${count}`);
  console.log(`✓ ${label}`);
  return text.replace(oldText, newText);
}

let kt = getEmbedded('OVERLAY_SERVICE_KT').value;

// Match the remodeled app: deep charcoal, subtle red outline, compact corners.
const oldShell = `      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(Color.rgb(77, 80, 83), Color.rgb(54, 57, 60))
      ).apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(12).toFloat()
      }`;
const newShell = `      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(Color.rgb(24, 27, 30), Color.rgb(10, 12, 14))
      ).apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(8).toFloat()
        setStroke(dp(1), Color.argb(210, 123, 32, 37))
      }`;
kt = replaceExact(kt, oldShell, newShell, 'dashboard-matched HUD shell');

const oldStateShell = `    root.background = GradientDrawable(
      GradientDrawable.Orientation.TOP_BOTTOM,
      intArrayOf(Color.rgb(77, 80, 83), Color.rgb(54, 57, 60))
    ).apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = dp(12).toFloat()
    }`;
const newStateShell = `    root.background = GradientDrawable(
      GradientDrawable.Orientation.TOP_BOTTOM,
      intArrayOf(Color.rgb(24, 27, 30), Color.rgb(10, 12, 14))
    ).apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = dp(8).toFloat()
      setStroke(dp(1), Color.argb(210, 123, 32, 37))
    }`;
kt = replaceExact(kt, oldStateShell, newStateShell, 'collapsed and expanded shell parity');

// Reduce overall footprint without sacrificing legibility.
kt = replaceExact(kt,
  `    val minWidthDp = when {
      compact -> 202
      large -> 280
      else -> 238
    }`,
  `    val minWidthDp = when {
      compact -> 196
      large -> 260
      else -> 224
    }`,
  'compact HUD widths');

kt = replaceExact(kt,
  `    val collapsedWidthDp = when {
      compact -> 150
      large -> 190
      else -> 170
    }`,
  `    val collapsedWidthDp = when {
      compact -> 54
      large -> 66
      else -> 60
    }`,
  'compact logo-only width');

kt = replaceExact(kt,
  `  private var currentMinWidthDp = 238
  private var currentCollapsedWidthDp = 170`,
  `  private var currentMinWidthDp = 224
  private var currentCollapsedWidthDp = 60`,
  'compact default dimensions');

// Tighten vertical rhythm across the visible rows.
kt = replaceExact(kt,
  `      setPadding(0, dp(5), 0, dp(1))`,
  `      setPadding(0, dp(3), 0, 0)`,
  'tighter stat row');

kt = replaceExact(kt,
  `        setPadding(dp(4), dp(4), dp(4), dp(4))`,
  `        setPadding(dp(3), dp(2), dp(3), dp(2))`,
  'tighter cooldown chips');

kt = replaceExact(kt,
  `          cornerRadius = dp(6).toFloat()
          setColor(Color.argb(118, 31, 33, 36))
          setStroke(dp(1), Color.argb(72, 220, 223, 226))`,
  `          cornerRadius = dp(5).toFloat()
          setColor(Color.argb(225, 19, 22, 25))
          setStroke(dp(1), Color.argb(150, 70, 77, 84))`,
  'dashboard cooldown styling');

kt = replaceExact(kt,
  `      topMargin = dp(5)
    })

    eventTickerText = makeText`,
  `      topMargin = dp(3)
    })

    eventTickerText = makeText`,
  'reduced cooldown gap');

kt = replaceExact(kt,
  `      setPadding(dp(6), dp(4), dp(6), dp(4))`,
  `      setPadding(dp(5), dp(2), dp(5), dp(2))`,
  'slimmer Torn clock');

kt = replaceExact(kt,
  `        cornerRadius = dp(6).toFloat()
        setColor(Color.argb(96, 27, 29, 32))
        setStroke(dp(1), Color.argb(64, 220, 223, 226))`,
  `        cornerRadius = dp(5).toFloat()
        setColor(Color.argb(225, 16, 18, 21))
        setStroke(dp(1), Color.argb(145, 72, 79, 87))`,
  'dashboard clock styling');

kt = replaceExact(kt,
  `      topMargin = dp(5)
    })

    val statContainer`,
  `      topMargin = dp(3)
    })

    val statContainer`,
  'reduced clock gap');

// Reinforce TornPulse red in the header rail instead of the pale steel divider.
kt = replaceExact(kt,
  `      setBackgroundColor(Color.argb(85, 225, 228, 231))`,
  `      setBackgroundColor(Color.rgb(123, 32, 37))`,
  'TornPulse red accent rail');

// Compatibility palette for the current Build #147 native HUD revision.
// These substitutions are deliberately idempotent and preserve all behavior.
kt = kt
  .replaceAll('Color.argb(242, 5, 7, 10)', 'Color.argb(246, 10, 12, 14)')
  .replaceAll('Color.argb(238, 8, 10, 13)', 'Color.argb(246, 10, 12, 14)')
  .replaceAll('Color.rgb(77, 80, 83)', 'Color.rgb(24, 27, 30)')
  .replaceAll('Color.rgb(54, 57, 60)', 'Color.rgb(10, 12, 14)')
  .replaceAll('Color.argb(110, 213, 47, 50)', 'Color.argb(210, 123, 32, 37)')
  .replaceAll('Color.argb(165, 213, 47, 50)', 'Color.argb(210, 123, 32, 37)');
console.log('✓ Build #147 HUD palette compatibility');

// Structural compaction for the current native eight-card HUD. This works on
// the generated Kotlin layout rather than depending on one historical shell.
let structuralChanges = 0;

kt = kt.replace(/cornerRadius = dp\((8|9|1[0-9])\)\.toFloat\(\)/g, () => {
  structuralChanges += 1;
  return 'cornerRadius = dp(6).toFloat()';
});

kt = kt.replace(
  /setPadding\(dp\((\d+)\), dp\((\d+)\), dp\((\d+)\), dp\((\d+)\)\)/g,
  (whole, left, top, right, bottom) => {
    const values = [left, top, right, bottom].map(Number);
    if (Math.max(...values) < 4) return whole;
    structuralChanges += 1;
    const compact = values.map((value, index) => {
      const factor = index === 1 || index === 3 ? 0.52 : 0.72;
      return Math.max(value > 0 ? 1 : 0, Math.round(value * factor));
    });
    return `setPadding(dp(${compact[0]}), dp(${compact[1]}), dp(${compact[2]}), dp(${compact[3]}))`;
  }
);

// Remove excessive transparent bleed-through from panel fill colors while
// leaving text, alert and outline colors untouched.
kt = kt.replace(
  /setColor\(Color\.argb\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)\)/g,
  (whole, alpha, red, green, blue) => {
    const a = Number(alpha);
    if (a >= 235) return whole;
    structuralChanges += 1;
    return `setColor(Color.argb(242, ${red}, ${green}, ${blue}))`;
  }
);

// Compress common layout gaps without touching timing or data values.
kt = kt.replace(/(topMargin|bottomMargin|leftMargin|rightMargin) = dp\((\d+)\)/g,
  (whole, name, value) => {
    const current = Number(value);
    if (current < 4) return whole;
    structuralChanges += 1;
    return `${name} = dp(${Math.max(2, Math.round(current * 0.55))})`;
  });

if (structuralChanges < 8) {
  throw new Error(`HUD structural remodel found only ${structuralChanges} layout hooks; refusing a cosmetic-only build`);
}
console.log(`✓ structural HUD remodel applied (${structuralChanges} layout changes)`);

// The internal scanner no longer exists. Re-purpose its HUD tile as the
// visual Baldr's List entry and use an unmistakable list symbol.
const scannerLabels = (kt.match(/"SCANNER"/g) || []).length;
if (scannerLabels < 1) {
  throw new Error('Could not find the obsolete HUD SCANNER label');
}
kt = kt.replaceAll('"SCANNER"', '"📋  BALDR LIST"');

const scannerIcons = (kt.match(/"◎"/g) || []).length;
if (scannerIcons > 0) kt = kt.replaceAll('"◎"', '"📋"');

// OPEN accurately describes the external-list slot; it is not a running
// scanner state. Restrict this to exact string literals.
const onLabels = (kt.match(/"ON"/g) || []).length;
if (onLabels > 0) kt = kt.replaceAll('"ON"', '"OPEN"');
console.log(`✓ removed Scanner HUD concept (${scannerLabels} guaranteed list label, ${scannerIcons} legacy icon, ${onLabels} state)`);

setEmbedded('OVERLAY_SERVICE_KT', kt);
fs.writeFileSync('app.config.js', src, 'utf8');
console.log('✓ TornPulse compact dashboard-matched HUD remodel complete');
