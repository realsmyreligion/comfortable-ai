const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// First apply the verified dashboard/header remodel from Build #147.
execFileSync(process.execPath, [path.join(__dirname, 'tornpulse-dashboard-base.cjs')], {
  stdio: 'inherit',
});

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
  if (count !== 1) throw new Error(`Expected one ${label}; found ${count}`);
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

setEmbedded('OVERLAY_SERVICE_KT', kt);
fs.writeFileSync('app.config.js', src, 'utf8');
console.log('✓ TornPulse compact dashboard-matched HUD remodel complete');
