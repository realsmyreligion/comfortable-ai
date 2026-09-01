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

// Install the eight dashboard category images supplied for this revision.
for (const name of ['health', 'energy', 'nerve', 'happiness', 'drug', 'booster', 'medical', 'baldr']) {
  const source = path.join(__dirname, `tp-${name}.png`);
  if (!fs.existsSync(source)) throw new Error(`Missing category image: tp-${name}.png`);
}
console.log('✓ eight dashboard category images installed');

let src = fs.readFileSync('app.config.js', 'utf8');

const expoIconMarker = `  config.userInterfaceStyle = 'dark';`;
const expoIconCount = src.split(expoIconMarker).length - 1;
if (expoIconCount !== 1) {
  throw new Error(`Expected one Expo icon configuration marker; found ${expoIconCount}`);
}
src = src.replace(expoIconMarker, `${expoIconMarker}
  // Official TornPulse TP pulse emblem. Explicit config overrides any stale
  // app.json/default icon retained by Expo or Android prebuild.
  config.icon = './tornpulse-app-icon.png';
  config.splash = {
    ...(config.splash || {}),
    image: './tornpulse-app-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#050607',
  };
  config.android = {
    ...(config.android || {}),
    adaptiveIcon: {
      ...((config.android && config.android.adaptiveIcon) || {}),
      foregroundImage: './tornpulse-app-icon.png',
      monochromeImage: './tornpulse-app-icon.png',
      backgroundColor: '#050607',
    },
  };`);
console.log('✓ Expo launcher, adaptive and splash icon configuration replaced');

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
let api = getEmbedded('TORN_API_JS').value;

// Keep the remodeled fourth vital live in the main app as well as the native
// overlay. Earlier builds fetched Happiness natively but discarded it in the
// React Native API normalizer.
api = replaceExact(
  api,
  `  const lifeRaw = payload?.bars?.life;\n  if (!energyRaw || !nerveRaw || !lifeRaw) throw new Error('Unexpected Torn bars response.');\n  return {energy: normalizeBar(energyRaw), nerve: normalizeBar(nerveRaw), life: normalizeBar(lifeRaw)};`,
  `  const lifeRaw = payload?.bars?.life;\n  const happyRaw = payload?.bars?.happy;\n  if (!energyRaw || !nerveRaw || !lifeRaw || !happyRaw) throw new Error('Unexpected Torn bars response.');\n  return {energy: normalizeBar(energyRaw), nerve: normalizeBar(nerveRaw), life: normalizeBar(lifeRaw), happy: normalizeBar(happyRaw)};`,
  'main API Happiness normalization'
);
api = replaceExact(
  api,
  `  const {energy, nerve, life} = validateBars(barsPayload);`,
  `  const {energy, nerve, life, happy} = validateBars(barsPayload);`,
  'main API Happiness snapshot binding'
);
api = replaceExact(
  api,
  `    life,\n    cooldowns,`,
  `    life,\n    happy,\n    cooldowns,`,
  'main API Happiness snapshot output'
);

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

// Replace the native floating-HUD canvas symbols with the same supplied PNG
// artwork used by the React Native dashboard. The images are embedded in the
// generated Kotlin so Android's overlay service can render them directly.
function replaceNative(oldText, newText, label) {
  const count = kt.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one native ${label}; found ${count}`);
  kt = kt.replace(oldText, newText);
  console.log(`✓ native ${label}`);
}

const nativeIconData = {};
for (const name of ['health', 'energy', 'nerve', 'happiness', 'drug', 'booster', 'medical', 'baldr']) {
  nativeIconData[name] = fs.readFileSync(path.join(__dirname, `tp-${name}.png`)).toString('base64');
}

const iconEngineStart = kt.indexOf('  // TORNPULSE_CLEAN_SLATE_ICON_ENGINE');
const iconEngineEnd = kt.indexOf('  private fun applyCollapsedState()', iconEngineStart);
if (iconEngineStart < 0 || iconEngineEnd < 0) throw new Error('Native HUD icon engine not found');
const nativeIconEngine = `  // TORNPULSE_CATEGORY_IMAGE_ENGINE
  private val TP_HEALTH_ICON = "${nativeIconData.health}"
  private val TP_ENERGY_ICON = "${nativeIconData.energy}"
  private val TP_NERVE_ICON = "${nativeIconData.nerve}"
  private val TP_HAPPINESS_ICON = "${nativeIconData.happiness}"
  private val TP_DRUG_ICON = "${nativeIconData.drug}"
  private val TP_BOOSTER_ICON = "${nativeIconData.booster}"
  private val TP_MEDICAL_ICON = "${nativeIconData.medical}"
  private val TP_BALDR_ICON = "${nativeIconData.baldr}"

  private fun makeHudGlyph(kind: String, color: Int, sizeDp: Int = 18): View {
    val normalized = kind.replace("📋", "").trim()
    val encoded = when (normalized) {
      "HEALTH" -> TP_HEALTH_ICON
      "ENERGY" -> TP_ENERGY_ICON
      "NERVE" -> TP_NERVE_ICON
      "HAPPINESS" -> TP_HAPPINESS_ICON
      "DRUG" -> TP_DRUG_ICON
      "BOOSTER" -> TP_BOOSTER_ICON
      "MEDICAL" -> TP_MEDICAL_ICON
      "BALDR LIST" -> TP_BALDR_ICON
      else -> TP_BALDR_ICON
    }
    val bytes = Base64.decode(encoded, Base64.DEFAULT)
    return ImageView(this).apply {
      setImageBitmap(BitmapFactory.decodeByteArray(bytes, 0, bytes.size))
      scaleType = ImageView.ScaleType.FIT_CENTER
      adjustViewBounds = true
      contentDescription = normalized
      minimumWidth = dp(sizeDp)
      minimumHeight = dp(sizeDp)
    }
  }

`;
kt = kt.slice(0, iconEngineStart) + nativeIconEngine + kt.slice(iconEngineEnd);
console.log('✓ native floating HUD uses all eight supplied category images');

const oldTornClockPanel = `    val tornClockRow = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(5), dp(4), dp(5), dp(4))
      minimumHeight = dp(92)
      visibility = if (hudCollapsed) View.GONE else View.VISIBLE
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(6).toFloat()
        setColor(Color.argb(242, 2, 3, 5))
        setStroke(dp(1), Color.argb(175, 227, 52, 60))
      }
    }
    val timeHead = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    val timeIconShell = LinearLayout(this).apply {
      gravity = Gravity.CENTER
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(6).toFloat()
        setColor(Color.argb(242, 238, 240, 244))
        setStroke(dp(1), Color.argb(200, 238, 240, 244))
      }
    }
    timeIconShell.addView(makeHudGlyph("TORN TIME", Color.rgb(238, 240, 244), 18), LinearLayout.LayoutParams(dp(18), dp(18)))
    timeHead.addView(timeIconShell, LinearLayout.LayoutParams(dp(34), dp(34)).apply { rightMargin = dp(4) })
    makeText("TORN TIME", maxOf(7.5f, cooldownSize - 0.2f), Color.rgb(238, 240, 244), true).also {
      it.letterSpacing = 0.055f; it.typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD); it.includeFontPadding = false; it.maxLines = 1
      timeHead.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    }
    tornClockRow.addView(timeHead, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    tornClockTimeText = makeText("TCT --:--:--", maxOf(10.5f, barsSize - 1f), Color.rgb(247, 248, 250), true).also {
      it.typeface = Typeface.create("sans-serif-medium", Typeface.BOLD); it.setPadding(0, dp(5), 0, 0); it.includeFontPadding = false; it.maxLines = 1; it.textAlignment = View.TEXT_ALIGNMENT_CENTER
      tornClockRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    }
    tornHourCountdownText = makeText("HOUR --:--:--", maxOf(7f, cooldownSize - .6f), Color.rgb(205, 209, 215), true).also {
      it.typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD); it.setPadding(0, dp(4), 0, 0); it.includeFontPadding = false; it.maxLines = 1; it.textAlignment = View.TEXT_ALIGNMENT_CENTER
      tornClockRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    }
    val timeAccent = View(this).apply { background = GradientDrawable().apply { shape = GradientDrawable.RECTANGLE; cornerRadius = dp(3).toFloat(); setColor(Color.rgb(227,52,60)) } }
    tornClockRow.addView(timeAccent, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3)).apply { topMargin = dp(4); leftMargin = dp(2); rightMargin = dp(2) })
    tornClockRowView = tornClockRow`;

const newTornClockPanel = `    // TORNPULSE_DIGITAL_TORN_CLOCK — a server-synchronized UTC/TCT display.
    val tornClockRow = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(8), dp(7), dp(8), dp(7))
      minimumHeight = dp(78)
      visibility = if (hudCollapsed) View.GONE else View.VISIBLE
      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(Color.rgb(8, 10, 12), Color.rgb(2, 3, 5))
      ).apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(6).toFloat()
        setStroke(dp(1), Color.argb(205, 198, 45, 53))
      }
    }
    makeText("TORN CITY  •  SERVER TIME", maxOf(6.8f, cooldownSize - 1.2f), Color.rgb(200, 69, 75), true).also {
      it.typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
      it.letterSpacing = 0.12f
      it.includeFontPadding = false
      it.maxLines = 1
      it.textAlignment = View.TEXT_ALIGNMENT_CENTER
      tornClockRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    }
    tornClockTimeText = makeText("--:--:--", maxOf(17f, barsSize + 3.5f), Color.rgb(248, 249, 250), true).also {
      it.typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
      it.letterSpacing = 0.08f
      it.setPadding(0, dp(3), 0, 0)
      it.includeFontPadding = false
      it.maxLines = 1
      it.textAlignment = View.TEXT_ALIGNMENT_CENTER
      tornClockRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    }
    tornHourCountdownText = makeText("NEXT HOUR  --:--:--", maxOf(7.2f, cooldownSize - .4f), Color.rgb(205, 209, 215), true).also {
      it.typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
      it.letterSpacing = 0.055f
      it.setPadding(0, dp(3), 0, 0)
      it.includeFontPadding = false
      it.maxLines = 1
      it.textAlignment = View.TEXT_ALIGNMENT_CENTER
      tornClockRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    }
    val timeAccent = View(this).apply { background = GradientDrawable().apply { shape = GradientDrawable.RECTANGLE; cornerRadius = dp(2).toFloat(); setColor(Color.rgb(227,52,60)) } }
    tornClockRow.addView(timeAccent, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(2)).apply { topMargin = dp(5) })
    tornClockRowView = tornClockRow`;
kt = replaceExact(kt, oldTornClockPanel, newTornClockPanel, 'icon-free digital Torn Time panel');

replaceNative(
  `    val now = currentTornEpochSeconds()\n    if (now == null) {\n      tornClockTimeText?.apply {\n        text = "TCT  SYNCING"\n        setTextColor(Color.rgb(190, 195, 200))\n      }\n      tornHourCountdownText?.apply {\n        text = "HOUR  --:--:--"\n        setTextColor(Color.rgb(190, 195, 200))\n      }\n      return\n    }`,
  `    // Torn time is UTC. Prefer Torn's own timestamp anchor; use device UTC\n    // only during the few moments before the first successful server sync.\n    val now = currentTornEpochSeconds() ?: (System.currentTimeMillis() / 1000L)`,
  'live Torn server-time fallback'
);
replaceNative(
  `      text = "TCT  \${clockStamp(daySeconds)}"`,
  `      text = clockStamp(daySeconds)`,
  'digital Torn clock face'
);
replaceNative(
  `      text = "HOUR  \${clockStamp(remaining)}"`,
  `      text = "NEXT HOUR  \${clockStamp(remaining)}"`,
  'digital next-hour countdown'
);

// Happiness takes the fourth vital card. Torn Time remains live but moves to
// its own full-width strip directly beneath the HUD header.
replaceNative(
  `    val life: BarState,\n    val energy: BarState,`,
  `    val life: BarState,\n    val happy: BarState,\n    val energy: BarState,`,
  'Happiness snapshot field'
);
replaceNative(
  `  private var lifeValueText: TextView? = null\n  private var energyValueText: TextView? = null`,
  `  private var lifeValueText: TextView? = null\n  private var happinessValueText: TextView? = null\n  private var energyValueText: TextView? = null`,
  'Happiness value reference'
);
replaceNative(
  `  private var lifeCooldownText: TextView? = null\n  private var energyCooldownText: TextView? = null`,
  `  private var lifeCooldownText: TextView? = null\n  private var happinessCooldownText: TextView? = null\n  private var energyCooldownText: TextView? = null`,
  'Happiness subtitle reference'
);
replaceNative(
  `    tornClockRowView = tornClockRow\n\n    val statContainer`,
  `    tornClockRowView = tornClockRow\n    root.addView(tornClockRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(3) })\n\n    val statContainer`,
  'top Torn Time strip'
);
replaceNative(
  `    val lifeStat = makeStatColumn("HEALTH", Color.rgb(74, 144, 226))\n    val energyStat = makeStatColumn("ENERGY", Color.rgb(139, 195, 74))\n    val nerveStat = makeStatColumn("NERVE", Color.rgb(231, 76, 60))\n    statContainer.addView(lifeStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { rightMargin = dp(2) })\n    statContainer.addView(energyStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(1); rightMargin = dp(1) })\n    statContainer.addView(nerveStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(1); rightMargin = dp(1) })\n    statContainer.addView(tornClockRow, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(2) })\n    lifeValueText = lifeStat.second\n    energyValueText = energyStat.second\n    nerveValueText = nerveStat.second\n    lifeCooldownText = lifeStat.third\n    energyCooldownText = energyStat.third\n    nerveCooldownText = nerveStat.third`,
  `    val lifeStat = makeStatColumn("HEALTH", Color.rgb(74, 144, 226))\n    val energyStat = makeStatColumn("ENERGY", Color.rgb(139, 195, 74))\n    val nerveStat = makeStatColumn("NERVE", Color.rgb(231, 76, 60))\n    val happinessStat = makeStatColumn("HAPPINESS", Color.rgb(216, 200, 91))\n    statContainer.addView(lifeStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { rightMargin = dp(2) })\n    statContainer.addView(energyStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(1); rightMargin = dp(1) })\n    statContainer.addView(nerveStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(1); rightMargin = dp(1) })\n    statContainer.addView(happinessStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(2) })\n    lifeValueText = lifeStat.second\n    energyValueText = energyStat.second\n    nerveValueText = nerveStat.second\n    happinessValueText = happinessStat.second\n    lifeCooldownText = lifeStat.third\n    energyCooldownText = energyStat.third\n    nerveCooldownText = nerveStat.third\n    happinessCooldownText = happinessStat.third`,
  'Happiness fourth vital card'
);
replaceNative(
  `        life = readBar(bars.getJSONObject("life")),\n        energy = readBar(bars.getJSONObject("energy")),`,
  `        life = readBar(bars.getJSONObject("life")),\n        happy = readBar(bars.getJSONObject("happy")),\n        energy = readBar(bars.getJSONObject("energy")),`,
  'Happiness API bar'
);
replaceNative(
  `  private fun renderBars(lifeCurrent: Int, lifeMax: Int, energyCurrent: Int, energyMax: Int, nerveCurrent: Int, nerveMax: Int) {\n    renderBarValue(lifeValueText, lifeCurrent, lifeMax, Color.rgb(74, 144, 226))\n    renderBarValue(energyValueText, energyCurrent, energyMax, Color.rgb(139, 195, 74))\n    renderBarValue(nerveValueText, nerveCurrent, nerveMax, Color.rgb(231, 76, 60))\n  }`,
  `  private fun renderBars(lifeCurrent: Int, lifeMax: Int, energyCurrent: Int, energyMax: Int, nerveCurrent: Int, nerveMax: Int, happinessCurrent: Int, happinessMax: Int) {\n    renderBarValue(lifeValueText, lifeCurrent, lifeMax, Color.rgb(74, 144, 226))\n    renderBarValue(energyValueText, energyCurrent, energyMax, Color.rgb(139, 195, 74))\n    renderBarValue(nerveValueText, nerveCurrent, nerveMax, Color.rgb(231, 76, 60))\n    renderBarValue(happinessValueText, happinessCurrent, happinessMax, Color.rgb(216, 200, 91))\n  }`,
  'Happiness value renderer'
);
replaceNative(
  `    lifeValueText?.text = "-- / --"\n    energyValueText?.text = "-- / --"\n    nerveValueText?.text = "-- / --"`,
  `    lifeValueText?.text = "-- / --"\n    energyValueText?.text = "-- / --"\n    nerveValueText?.text = "-- / --"\n    happinessValueText?.text = "-- / --"`,
  'empty Happiness value'
);
replaceNative(
  `    lifeValueText?.setTextColor(Color.rgb(137, 145, 156))\n    energyValueText?.setTextColor(Color.rgb(137, 145, 156))\n    nerveValueText?.setTextColor(Color.rgb(137, 145, 156))`,
  `    lifeValueText?.setTextColor(Color.rgb(137, 145, 156))\n    energyValueText?.setTextColor(Color.rgb(137, 145, 156))\n    nerveValueText?.setTextColor(Color.rgb(137, 145, 156))\n    happinessValueText?.setTextColor(Color.rgb(137, 145, 156))`,
  'empty Happiness color'
);
replaceNative(
  `      nerveCooldownText?.text = "--"\n      renderCooldownStrip`,
  `      nerveCooldownText?.text = "--"\n      happinessCooldownText?.text = "--"\n      renderCooldownStrip`,
  'empty Happiness subtitle'
);
replaceNative(
  `    val life = projected(snap.life, elapsed)\n    val energy = projected(snap.energy, elapsed)\n    val nerve = projected(snap.nerve, elapsed)`,
  `    val life = projected(snap.life, elapsed)\n    val energy = projected(snap.energy, elapsed)\n    val nerve = projected(snap.nerve, elapsed)\n    val happiness = projected(snap.happy, elapsed)`,
  'live Happiness projection'
);
replaceNative(
  `    renderBars(life, snap.life.maximum, energy, snap.energy.maximum, nerve, snap.nerve.maximum)`,
  `    renderBars(life, snap.life.maximum, energy, snap.energy.maximum, nerve, snap.nerve.maximum, happiness, snap.happy.maximum)`,
  'live Happiness render call'
);
replaceNative(
  `    nerveCooldownText?.apply {\n      text = nerveFull\n      setTextColor(if (nerve >= snap.nerve.maximum) Color.rgb(231, 76, 60) else timerMuted)\n    }`,
  `    nerveCooldownText?.apply {\n      text = nerveFull\n      setTextColor(if (nerve >= snap.nerve.maximum) Color.rgb(231, 76, 60) else timerMuted)\n    }\n    happinessCooldownText?.apply {\n      text = "CURRENT"\n      setTextColor(Color.rgb(216, 200, 91))\n    }`,
  'Happiness card subtitle'
);
replaceNative(
  `    lifeValueText = null\n    energyValueText = null`,
  `    lifeValueText = null\n    happinessValueText = null\n    energyValueText = null`,
  'clear Happiness value reference'
);
replaceNative(
  `    lifeCooldownText = null\n    energyCooldownText = null`,
  `    lifeCooldownText = null\n    happinessCooldownText = null\n    energyCooldownText = null`,
  'clear Happiness subtitle reference'
);

if ((kt.match(/TORNPULSE_CATEGORY_IMAGE_ENGINE/g) || []).length !== 1 || kt.includes('makeHudGlyph("TORN TIME"')) {
  throw new Error('Native category image verification failed');
}
console.log('✓ native Torn Time moved above four-image vital strip');

if (!api.includes('happy: normalizeBar(happyRaw)') || !api.includes('const {energy, nerve, life, happy}')) {
  throw new Error('Main API Happiness verification failed');
}

setEmbedded('TORN_API_JS', api);
setEmbedded('OVERLAY_SERVICE_KT', kt);
fs.writeFileSync('app.config.js', src, 'utf8');
console.log('✓ TornPulse compact dashboard-matched HUD remodel complete');
