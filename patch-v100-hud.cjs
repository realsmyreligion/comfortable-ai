const fs = require('fs');
const FILE = 'app.config.js';
let src = fs.readFileSync(FILE, 'utf8');

function extractEmbedded(name) {
  const prefix = `const ${name} = `;
  const start = src.indexOf(prefix);
  if (start < 0) throw new Error(`TornPulse v1.0 HUD patch: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse v1.0 HUD patch: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse v1.0 HUD patch: could not parse ${name}`);
  return { start: valueStart, end: i + 1, value: JSON.parse(src.slice(valueStart, i + 1)) };
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0, found.start) + JSON.stringify(value) + src.slice(found.end);
}

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`TornPulse v1.0 HUD patch: expected 1 match for ${label}, found ${count}`);
  return text.replace(oldText, newText);
}

let kt = extractEmbedded('OVERLAY_SERVICE_KT').value;

kt = replaceOnce(
  kt,
  `import android.text.Spannable\nimport android.text.SpannableString\nimport android.text.style.ForegroundColorSpan`,
  `import android.text.Spannable\nimport android.text.SpannableString\nimport android.text.TextPaint\nimport android.text.TextUtils\nimport android.text.style.CharacterStyle\nimport android.text.style.ForegroundColorSpan\nimport android.text.style.UpdateAppearance`,
  'HUD text/glow imports'
);

kt = replaceOnce(
  kt,
  `import android.widget.LinearLayout\nimport android.widget.TextView`,
  `import android.widget.ImageView\nimport android.widget.LinearLayout\nimport android.widget.TextView`,
  'HUD logo image import'
);

kt = replaceOnce(
  kt,
  `class ComfortableOverlayService : Service() {\n  companion object {`,
  `class ComfortableOverlayService : Service() {\n  private class GlowSpan(private val radius: Float, private val glowColor: Int) : CharacterStyle(), UpdateAppearance {\n    override fun updateDrawState(tp: TextPaint) {\n      tp.setShadowLayer(radius, 0f, 0f, glowColor)\n    }\n  }\n\n  private data class HudBarPiece(val text: String, val current: Int, val maximum: Int, val color: Int)\n\n  companion object {`,
  'GlowSpan helper'
);

kt = replaceOnce(
  kt,
  `  private var attackBaselineReady = false\n  private var lastSeenAttackId = 0L\n\n  private lateinit var windowManager: WindowManager\n  private var overlayView: LinearLayout? = null\n  private var headerText: TextView? = null\n  private var barsText: TextView? = null\n  private var cooldownText: TextView? = null\n  private var detailText: TextView? = null`,
  `  private var attackBaselineReady = false\n  private var lastSeenAttackId = 0L\n  private var statusBaselineReady = false\n  private var lastStatusState = \"\"\n  private var eventTickerMessage: String? = null\n  private var eventTickerColor: Int = Color.rgb(227, 83, 96)\n  private var eventTickerUntilElapsed = 0L\n\n  private lateinit var windowManager: WindowManager\n  private var overlayView: LinearLayout? = null\n  private var statusText: TextView? = null\n  private var barsText: TextView? = null\n  private var cooldownText: TextView? = null\n  private var eventTickerText: TextView? = null\n  private var detailText: TextView? = null`,
  'HUD fields and event state'
);

kt = replaceOnce(
  kt,
  `    val minWidthDp = when {\n      compact -> 190\n      large -> 250\n      else -> 210\n    }`,
  `    val minWidthDp = when {\n      compact -> 202\n      large -> 280\n      else -> 238\n    }`,
  'HUD widths'
);

kt = replaceOnce(
  kt,
  `    val barsSize = when {\n      compact -> 11f\n      large -> 15f\n      else -> 13f\n    }`,
  `    val logoSize = when {\n      compact -> 18\n      large -> 24\n      else -> 21\n    }\n    val barsSize = when {\n      compact -> 13f\n      large -> 18f\n      else -> 15f\n    }`,
  'enlarged bar text'
);

kt = replaceOnce(
  kt,
  `    val cooldownSize = when {\n      compact -> 7f\n      large -> 9f\n      else -> 8f\n    }\n    val detailSize = when {`,
  `    val cooldownSize = when {\n      compact -> 7f\n      large -> 9f\n      else -> 8f\n    }\n    val tickerSize = when {\n      compact -> 7f\n      large -> 9f\n      else -> 8f\n    }\n    val detailSize = when {`,
  'ticker text sizing'
);

kt = replaceOnce(
  kt,
  `    headerText = makeText(\"TORNPULSE • CONNECTING\", headerSize, Color.rgb(176, 183, 193), true).also {\n      it.letterSpacing = 0.16f\n      it.textAlignment = View.TEXT_ALIGNMENT_CENTER\n      root.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n    barsText = makeText(\"♥ --/--   ϟ --/--   ✺ --/--\", barsSize, Color.rgb(241, 243, 245), true).also {`,
  `    val headerRow = LinearLayout(this).apply {\n      orientation = LinearLayout.HORIZONTAL\n      gravity = Gravity.CENTER_VERTICAL\n    }\n    val logoView = ImageView(this).apply {\n      setImageDrawable(applicationInfo.loadIcon(packageManager))\n      scaleType = ImageView.ScaleType.FIT_CENTER\n      contentDescription = \"TornPulse\"\n    }\n    headerRow.addView(logoView, LinearLayout.LayoutParams(dp(logoSize), dp(logoSize)).apply { rightMargin = dp(8) })\n    val headerSpacer = View(this)\n    headerRow.addView(headerSpacer, LinearLayout.LayoutParams(0, 1, 1f))\n    statusText = makeText(\"CONNECTING\", headerSize, Color.rgb(176, 183, 193), true).also {\n      it.letterSpacing = 0.12f\n      it.textAlignment = View.TEXT_ALIGNMENT_VIEW_END\n      headerRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n    root.addView(headerRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n\n    barsText = makeText(\"♥ -- / --   ϟ -- / --   ✺ -- / --\", barsSize, Color.rgb(241, 243, 245), true).also {`,
  'split logo/status header'
);

kt = replaceOnce(
  kt,
  `    detailText = makeText(\"Connecting to Torn…\", detailSize, Color.rgb(153, 163, 178), false).also {`,
  `    eventTickerText = makeText(\"\", tickerSize, Color.rgb(227, 83, 96), true).also {\n      it.setPadding(0, dp(4), 0, 0)\n      it.setSingleLine(true)\n      it.ellipsize = TextUtils.TruncateAt.MARQUEE\n      it.marqueeRepeatLimit = -1\n      it.setHorizontallyScrolling(true)\n      it.isSelected = true\n      it.visibility = View.GONE\n      root.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n\n    detailText = makeText(\"Connecting to Torn…\", detailSize, Color.rgb(153, 163, 178), false).also {`,
  'event ticker view'
);

kt = replaceOnce(
  kt,
  `    headerText = null\n    barsText = null\n    cooldownText = null\n    detailText = null`,
  `    statusText = null\n    barsText = null\n    cooldownText = null\n    eventTickerText = null\n    detailText = null`,
  'rebuild HUD view refs'
);

const oldRenderBars = `  private fun renderBars(lifeText: String, energyText: String, nerveText: String) {\n    val life = \"♥ $lifeText\"\n    val gap = \"   \"\n    val energy = \"ϟ $energyText\"\n    val nerve = \"✺ $nerveText\"\n    val text = life + gap + energy + gap + nerve\n    val styled = SpannableString(text)\n    styled.setSpan(ForegroundColorSpan(Color.rgb(52, 152, 219)), 0, life.length, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n    val energyStart = life.length + gap.length\n    styled.setSpan(ForegroundColorSpan(Color.rgb(103, 213, 45)), energyStart, energyStart + energy.length, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n    val nerveStart = energyStart + energy.length + gap.length\n    styled.setSpan(ForegroundColorSpan(Color.rgb(255, 90, 56)), nerveStart, text.length, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n    barsText?.text = styled\n  }`;

const newRenderBars = `  private fun renderBars(lifeCurrent: Int, lifeMax: Int, energyCurrent: Int, energyMax: Int, nerveCurrent: Int, nerveMax: Int) {\n    val white = Color.rgb(244, 245, 246)\n    val muted = Color.rgb(137, 145, 156)\n    val lifeColor = Color.rgb(52, 152, 219)\n    val energyColor = Color.rgb(103, 213, 45)\n    val nerveColor = Color.rgb(255, 90, 56)\n\n    val pieces = listOf(\n      HudBarPiece(\"♥ $lifeCurrent / $lifeMax\", lifeCurrent, lifeMax, lifeColor),\n      HudBarPiece(\"ϟ $energyCurrent / $energyMax\", energyCurrent, energyMax, energyColor),\n      HudBarPiece(\"✺ $nerveCurrent / $nerveMax\", nerveCurrent, nerveMax, nerveColor),\n    )\n    val gap = \"   \"\n    val text = pieces.joinToString(gap) { it.text }\n    val styled = SpannableString(text)\n    var offset = 0\n\n    pieces.forEachIndexed { index, piece ->\n      val currentText = piece.current.toString()\n      val maxText = piece.maximum.toString()\n      val symbolStart = offset\n      val symbolEnd = symbolStart + 1\n      val currentStart = offset + 2\n      val currentEnd = currentStart + currentText.length\n      val slashStart = currentEnd + 1\n      val slashEnd = slashStart + 1\n      val maxStart = slashEnd + 1\n      val maxEnd = maxStart + maxText.length\n      val capped = piece.maximum > 0 && piece.current >= piece.maximum\n\n      styled.setSpan(ForegroundColorSpan(piece.color), symbolStart, symbolEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n      styled.setSpan(ForegroundColorSpan(if (capped) piece.color else white), currentStart, currentEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n      styled.setSpan(GlowSpan(if (capped) dp(3).toFloat() else dp(2).toFloat(), piece.color), currentStart, currentEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n      styled.setSpan(ForegroundColorSpan(if (capped) piece.color else muted), slashStart, slashEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n      styled.setSpan(ForegroundColorSpan(piece.color), maxStart, maxEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n\n      offset += piece.text.length\n      if (index < pieces.lastIndex) offset += gap.length\n    }\n    barsText?.text = styled\n  }`;
kt = replaceOnce(kt, oldRenderBars, newRenderBars, 'white/current colored-cap bar renderer');

kt = replaceOnce(
  kt,
  `      maybeNotifyAttack(latestAttack, attackAccess)\n\n      val next = Snapshot(`,
  `      maybeNotifyAttack(latestAttack, attackAccess)\n      maybeTrackStatus(status.optString(\"state\", \"Unknown\"))\n\n      val next = Snapshot(`,
  'status event tracking hook'
);

kt = replaceOnce(
  kt,
  `    if (snap == null) {\n      headerText?.text = if (lastError == null) \"TORNPULSE • CONNECTING\" else \"TORNPULSE • OFFLINE\"\n      renderBars(\"-- / --\", \"-- / --\", \"-- / --\")\n      cooldownText?.text = \"💊 --   •   🥤 --   •   ✚ --\"\n      detailText?.text = lastError ?: \"Connecting to Torn…\"\n      return\n    }`,
  `    if (snap == null) {\n      statusText?.text = if (lastError == null) \"CONNECTING\" else \"OFFLINE\"\n      statusText?.setTextColor(if (lastError == null) Color.rgb(176, 183, 193) else Color.rgb(227, 83, 96))\n      barsText?.text = \"♥ -- / --   ϟ -- / --   ✺ -- / --\"\n      cooldownText?.text = \"💊 --   •   🥤 --   •   ✚ --\"\n      renderEventTicker()\n      detailText?.text = lastError ?: \"Connecting to Torn…\"\n      return\n    }`,
  'connecting/offline split status'
);

kt = replaceOnce(
  kt,
  `    headerText?.text = if (stale) \"TORNPULSE • CHECKING$lockMark\" else \"TORNPULSE • $headerStatus$lockMark\"\n    val statusColor = when {`,
  `    statusText?.text = if (stale) \"CHECKING$lockMark\" else \"$headerStatus$lockMark\"\n    val statusColor = when {`,
  'right-side HUD status text'
);

kt = replaceOnce(
  kt,
  `    headerText?.setTextColor(statusColor)\n    renderBars(\"$life/\${snap.life.maximum}\", \"$energy/\${snap.energy.maximum}\", \"$nerve/\${snap.nerve.maximum}\")`,
  `    statusText?.setTextColor(statusColor)\n    renderBars(life, snap.life.maximum, energy, snap.energy.maximum, nerve, snap.nerve.maximum)\n    renderEventTicker()`,
  'status color and new bar render call'
);

const oldAttackLead = `    if (attack == null || attack.id <= 0L || attack.id == lastSeenAttackId) return\n    lastSeenAttackId = attack.id\n    val prefs = getSharedPreferences(\"comfortable_hud\", Context.MODE_PRIVATE)\n    if (!prefs.getBoolean(\"attack_alerts\", true)) return\n\n    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager`;
const newAttackLead = `    if (attack == null || attack.id <= 0L || attack.id == lastSeenAttackId) return\n    lastSeenAttackId = attack.id\n\n    val who = attack.attackerName ?: if (attack.isStealthed) \"UNKNOWN / STEALTH\" else \"UNKNOWN ATTACKER\"\n    val result = attack.result.ifBlank { \"ATTACKED\" }.uppercase()\n    val tickerMessage = if (result.contains(\"MUG\")) \"MUGGED BY $who\" else \"ATTACKED BY $who • $result\"\n    showHudEvent(tickerMessage, Color.rgb(227, 83, 96), 35)\n\n    val prefs = getSharedPreferences(\"comfortable_hud\", Context.MODE_PRIVATE)\n    if (!prefs.getBoolean(\"attack_alerts\", true)) return\n\n    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager`;
kt = replaceOnce(kt, oldAttackLead, newAttackLead, 'new attack ticker event');

kt = replaceOnce(
  kt,
  `    val who = attack.attackerName ?: if (attack.isStealthed) \"Unknown / stealth\" else \"Unknown attacker\"\n    val notification = NotificationCompat.Builder(this, ATTACK_CHANNEL_ID)`,
  `    val notificationWho = attack.attackerName ?: if (attack.isStealthed) \"Unknown / stealth\" else \"Unknown attacker\"\n    val notification = NotificationCompat.Builder(this, ATTACK_CHANNEL_ID)`,
  'notification attacker variable'
);

kt = replaceOnce(
  kt,
  `.setContentText(\"$who • \${attack.result}\")\n      .setStyle(NotificationCompat.BigTextStyle().bigText(\"$who • \${attack.result}\"))`,
  `.setContentText(\"$notificationWho • \${attack.result}\")\n      .setStyle(NotificationCompat.BigTextStyle().bigText(\"$notificationWho • \${attack.result}\"))`,
  'notification content attacker variable'
);

kt = replaceOnce(
  kt,
  `  private fun formatAge(totalSeconds: Int): String {`,
  `  private fun maybeTrackStatus(newState: String) {\n    val normalized = newState.trim().uppercase()\n    if (!statusBaselineReady) {\n      statusBaselineReady = true\n      lastStatusState = normalized\n      return\n    }\n    val previous = lastStatusState\n    lastStatusState = normalized\n    if (previous.contains(\"HOSPITAL\") && !normalized.contains(\"HOSPITAL\")) {\n      showHudEvent(\"RELEASED FROM HOSPITAL\", Color.rgb(97, 215, 133), 30)\n    } else if (previous.contains(\"JAIL\") && !normalized.contains(\"JAIL\")) {\n      showHudEvent(\"RELEASED FROM JAIL\", Color.rgb(97, 215, 133), 30)\n    }\n  }\n\n  private fun showHudEvent(message: String, color: Int, seconds: Int) {\n    eventTickerMessage = message\n    eventTickerColor = color\n    eventTickerUntilElapsed = SystemClock.elapsedRealtime() + seconds * 1000L\n    handler.post { renderEventTicker() }\n  }\n\n  private fun renderEventTicker() {\n    val view = eventTickerText ?: return\n    val message = eventTickerMessage\n    if (message.isNullOrBlank() || SystemClock.elapsedRealtime() >= eventTickerUntilElapsed) {\n      view.visibility = View.GONE\n      return\n    }\n    view.setTextColor(eventTickerColor)\n    val display = \"  $message   •   $message   \"\n    if (view.text.toString() != display) {\n      view.text = display\n      view.isSelected = false\n      view.isSelected = true\n    }\n    view.visibility = View.VISIBLE\n  }\n\n  private fun formatAge(totalSeconds: Int): String {`,
  'status release and ticker helpers'
);

setEmbedded('OVERLAY_SERVICE_KT', kt);
fs.writeFileSync(FILE, src, 'utf8');
console.log('\nTornPulse v1.0 final HUD polish applied successfully.');
