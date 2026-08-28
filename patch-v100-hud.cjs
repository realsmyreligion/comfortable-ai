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


// Final v1.0 readability + minimize pass
kt = replaceOnce(kt, "  private var overlayView: LinearLayout? = null\n  private var statusText: TextView? = null\n  private var barsText: TextView? = null\n  private var cooldownText: TextView? = null\n  private var eventTickerText: TextView? = null\n  private var detailText: TextView? = null\n  private var params: WindowManager.LayoutParams? = null\n  private var expanded = false\n  private var positionLocked = false", "  private var overlayView: LinearLayout? = null\n  private var statusText: TextView? = null\n  private var collapseText: TextView? = null\n  private var statsRow: LinearLayout? = null\n  private var lifeValueText: TextView? = null\n  private var energyValueText: TextView? = null\n  private var nerveValueText: TextView? = null\n  private var cooldownText: TextView? = null\n  private var eventTickerText: TextView? = null\n  private var detailText: TextView? = null\n  private var params: WindowManager.LayoutParams? = null\n  private var expanded = false\n  private var positionLocked = false\n  private var hudCollapsed = false\n  private var compactHud = false\n  private var currentMinWidthDp = 238\n  private var currentCollapsedWidthDp = 170", "lettered HUD fields and collapse state");

kt = replaceOnce(kt, "    val minWidthDp = when {\n      compact -> 202\n      large -> 280\n      else -> 238\n    }", "    val minWidthDp = when {\n      compact -> 202\n      large -> 280\n      else -> 238\n    }\n    val collapsedWidthDp = when {\n      compact -> 150\n      large -> 190\n      else -> 170\n    }\n    hudCollapsed = prefs.getBoolean(\"hud_collapsed\", false)\n    compactHud = compact\n    currentMinWidthDp = minWidthDp\n    currentCollapsedWidthDp = collapsedWidthDp", "collapsed HUD widths and persisted state");

kt = replaceOnce(kt, "    val barsSize = when {\n      compact -> 13f\n      large -> 18f\n      else -> 15f\n    }", "    val statLabelSize = when {\n      compact -> 7f\n      large -> 9f\n      else -> 8f\n    }\n    val barsSize = when {\n      compact -> 13f\n      large -> 19f\n      else -> 16f\n    }", "bold letter labels and value sizing");

kt = replaceOnce(kt, "      minimumWidth = dp(minWidthDp)", "      minimumWidth = dp(if (hudCollapsed) collapsedWidthDp else minWidthDp)", "initial collapsed width");

kt = replaceOnce(kt, "      x = min(max(0, savedX), max(0, display.widthPixels - dp(minWidthDp)))", "      x = min(max(0, savedX), max(0, display.widthPixels - dp(if (hudCollapsed) collapsedWidthDp else minWidthDp)))", "initial collapsed position clamp");

kt = replaceOnce(kt, "            val width = max(root.width, dp(minWidthDp))", "            val width = max(root.width, dp(if (hudCollapsed) collapsedWidthDp else minWidthDp))", "collapsed drag width clamp");

kt = replaceOnce(kt, "    statusText = makeText(\"CONNECTING\", headerSize, Color.rgb(176, 183, 193), true).also {\n      it.letterSpacing = 0.12f\n      it.textAlignment = View.TEXT_ALIGNMENT_VIEW_END\n      headerRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n    root.addView(headerRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n\n    barsText = makeText(\"\u2665 -- / --   \u03df -- / --   \u273a -- / --\", barsSize, Color.rgb(241, 243, 245), true).also {\n      it.setPadding(0, dp(2), 0, 0)\n      it.maxLines = 1\n      it.textAlignment = View.TEXT_ALIGNMENT_CENTER\n      root.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }", "    statusText = makeText(\"CONNECTING\", headerSize, Color.rgb(176, 183, 193), true).also {\n      it.letterSpacing = 0.12f\n      it.textAlignment = View.TEXT_ALIGNMENT_VIEW_END\n      headerRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n    collapseText = makeText(if (hudCollapsed) \"\uff0b\" else \"\u2014\", headerSize + 2f, Color.rgb(137, 145, 156), true).also {\n      it.setPadding(dp(9), 0, 0, 0)\n      it.contentDescription = if (hudCollapsed) \"Expand TornPulse HUD\" else \"Minimize TornPulse HUD\"\n      headerRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n    root.addView(headerRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n\n    val statContainer = LinearLayout(this).apply {\n      orientation = LinearLayout.HORIZONTAL\n      gravity = Gravity.CENTER\n      setPadding(0, dp(4), 0, 0)\n      visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    }\n    fun makeStatColumn(label: String, color: Int): Pair<LinearLayout, TextView> {\n      val column = LinearLayout(this).apply {\n        orientation = LinearLayout.VERTICAL\n        gravity = Gravity.CENTER\n      }\n      val labelView = makeText(label, statLabelSize, color, true).apply {\n        letterSpacing = 0.08f\n        textAlignment = View.TEXT_ALIGNMENT_CENTER\n      }\n      val valueView = makeText(\"-- / --\", barsSize, Color.rgb(244, 245, 246), true).apply {\n        setPadding(0, dp(1), 0, 0)\n        maxLines = 1\n        textAlignment = View.TEXT_ALIGNMENT_CENTER\n      }\n      column.addView(labelView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n      column.addView(valueView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n      return Pair(column, valueView)\n    }\n    val lifeStat = makeStatColumn(\"H\", Color.rgb(52, 152, 219))\n    val energyStat = makeStatColumn(\"E\", Color.rgb(103, 213, 45))\n    val nerveStat = makeStatColumn(\"N\", Color.rgb(255, 90, 56))\n    statContainer.addView(lifeStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    statContainer.addView(energyStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    statContainer.addView(nerveStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    lifeValueText = lifeStat.second\n    energyValueText = energyStat.second\n    nerveValueText = nerveStat.second\n    statsRow = statContainer\n    root.addView(statContainer, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))", "lettered three-column stats and collapse control");

kt = replaceOnce(kt, "      it.visibility = if (compact) View.GONE else View.VISIBLE", "      it.visibility = if (compact || hudCollapsed) View.GONE else View.VISIBLE", "collapsed cooldown visibility");

kt = replaceOnce(kt, "          } else if (!moved) {\n            expanded = !expanded\n            detailText?.visibility = if (expanded) View.VISIBLE else View.GONE\n            render()\n          }", "          } else if (!moved) {\n            val collapseHit = event.x >= root.width - dp(40) && event.y <= dp(46)\n            if (hudCollapsed || collapseHit) {\n              hudCollapsed = !hudCollapsed\n              expanded = false\n              prefs.edit().putBoolean(\"hud_collapsed\", hudCollapsed).apply()\n              applyCollapsedState()\n              render()\n            } else {\n              expanded = !expanded\n              detailText?.visibility = if (expanded) View.VISIBLE else View.GONE\n              render()\n            }\n          }", "collapse/minimize touch behavior");

kt = replaceOnce(kt, "    statusText = null\n    barsText = null\n    cooldownText = null\n    eventTickerText = null\n    detailText = null", "    statusText = null\n    collapseText = null\n    statsRow = null\n    lifeValueText = null\n    energyValueText = null\n    nerveValueText = null\n    cooldownText = null\n    eventTickerText = null\n    detailText = null", "rebuild lettered HUD refs");

kt = replaceOnce(kt, "  private fun renderBars(lifeCurrent: Int, lifeMax: Int, energyCurrent: Int, energyMax: Int, nerveCurrent: Int, nerveMax: Int) {\n    val white = Color.rgb(244, 245, 246)\n    val muted = Color.rgb(137, 145, 156)\n    val lifeColor = Color.rgb(52, 152, 219)\n    val energyColor = Color.rgb(103, 213, 45)\n    val nerveColor = Color.rgb(255, 90, 56)\n\n    val pieces = listOf(\n      HudBarPiece(\"\u2665 $lifeCurrent / $lifeMax\", lifeCurrent, lifeMax, lifeColor),\n      HudBarPiece(\"\u03df $energyCurrent / $energyMax\", energyCurrent, energyMax, energyColor),\n      HudBarPiece(\"\u273a $nerveCurrent / $nerveMax\", nerveCurrent, nerveMax, nerveColor),\n    )\n    val gap = \"   \"\n    val text = pieces.joinToString(gap) { it.text }\n    val styled = SpannableString(text)\n    var offset = 0\n\n    pieces.forEachIndexed { index, piece ->\n      val currentText = piece.current.toString()\n      val maxText = piece.maximum.toString()\n      val symbolStart = offset\n      val symbolEnd = symbolStart + 1\n      val currentStart = offset + 2\n      val currentEnd = currentStart + currentText.length\n      val slashStart = currentEnd + 1\n      val slashEnd = slashStart + 1\n      val maxStart = slashEnd + 1\n      val maxEnd = maxStart + maxText.length\n      val capped = piece.maximum > 0 && piece.current >= piece.maximum\n\n      styled.setSpan(ForegroundColorSpan(piece.color), symbolStart, symbolEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n      styled.setSpan(ForegroundColorSpan(if (capped) piece.color else white), currentStart, currentEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n      styled.setSpan(GlowSpan(if (capped) dp(3).toFloat() else dp(2).toFloat(), piece.color), currentStart, currentEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n      styled.setSpan(ForegroundColorSpan(if (capped) piece.color else muted), slashStart, slashEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n      styled.setSpan(ForegroundColorSpan(piece.color), maxStart, maxEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n\n      offset += piece.text.length\n      if (index < pieces.lastIndex) offset += gap.length\n    }\n    barsText?.text = styled\n  }\n\n", "  private fun renderBarValue(view: TextView?, current: Int, maximum: Int, color: Int) {\n    val target = view ?: return\n    if (maximum <= 0) {\n      target.text = \"-- / --\"\n      target.setTextColor(Color.rgb(137, 145, 156))\n      return\n    }\n    val white = Color.rgb(244, 245, 246)\n    val muted = Color.rgb(137, 145, 156)\n    val currentText = current.toString()\n    val maxText = maximum.toString()\n    val text = \"$currentText / $maxText\"\n    val styled = SpannableString(text)\n    val currentStart = 0\n    val currentEnd = currentText.length\n    val slashStart = currentEnd + 1\n    val slashEnd = slashStart + 1\n    val maxStart = slashEnd + 1\n    val maxEnd = maxStart + maxText.length\n    val capped = current >= maximum\n\n    styled.setSpan(ForegroundColorSpan(if (capped) color else white), currentStart, currentEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n    styled.setSpan(GlowSpan(if (capped) dp(3).toFloat() else dp(2).toFloat(), color), currentStart, currentEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n    styled.setSpan(ForegroundColorSpan(if (capped) color else muted), slashStart, slashEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n    styled.setSpan(ForegroundColorSpan(color), maxStart, maxEnd, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)\n    target.text = styled\n  }\n\n  private fun renderBars(lifeCurrent: Int, lifeMax: Int, energyCurrent: Int, energyMax: Int, nerveCurrent: Int, nerveMax: Int) {\n    renderBarValue(lifeValueText, lifeCurrent, lifeMax, Color.rgb(52, 152, 219))\n    renderBarValue(energyValueText, energyCurrent, energyMax, Color.rgb(103, 213, 45))\n    renderBarValue(nerveValueText, nerveCurrent, nerveMax, Color.rgb(255, 90, 56))\n  }\n\n  private fun renderEmptyBars() {\n    lifeValueText?.text = \"-- / --\"\n    energyValueText?.text = \"-- / --\"\n    nerveValueText?.text = \"-- / --\"\n    lifeValueText?.setTextColor(Color.rgb(137, 145, 156))\n    energyValueText?.setTextColor(Color.rgb(137, 145, 156))\n    nerveValueText?.setTextColor(Color.rgb(137, 145, 156))\n  }\n\n  private fun applyCollapsedState() {\n    val root = overlayView ?: return\n    statsRow?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    cooldownText?.visibility = if (hudCollapsed || compactHud) View.GONE else View.VISIBLE\n    detailText?.visibility = if (!hudCollapsed && expanded) View.VISIBLE else View.GONE\n    collapseText?.text = if (hudCollapsed) \"\uff0b\" else \"\u2014\"\n    collapseText?.contentDescription = if (hudCollapsed) \"Expand TornPulse HUD\" else \"Minimize TornPulse HUD\"\n    root.minimumWidth = dp(if (hudCollapsed) currentCollapsedWidthDp else currentMinWidthDp)\n    if (hudCollapsed) {\n      eventTickerText?.visibility = View.GONE\n    } else {\n      renderEventTicker()\n    }\n    val lp = params\n    if (lp != null) {\n      val display = resources.displayMetrics\n      val targetWidth = dp(if (hudCollapsed) currentCollapsedWidthDp else currentMinWidthDp)\n      lp.x = min(max(0, lp.x), max(0, display.widthPixels - targetWidth))\n      try { windowManager.updateViewLayout(root, lp) } catch (_: Exception) {}\n    }\n    root.requestLayout()\n  }\n\n", "separate lettered bar value renderer and collapsed-state helper");

kt = replaceOnce(kt, "      barsText?.text = \"\u2665 -- / --   \u03df -- / --   \u273a -- / --\"", "      renderEmptyBars()", "empty lettered bars");

kt = replaceOnce(kt, "    detailText?.text = \"STATUS   $statusLine\\n$attackLine\\nFULL   \u2665 $lifeFull   \u2022   \u03df $energyFull   \u2022   \u273a $nerveFull\\nCOOLDOWNS   \ud83d\udc8a $drug   \u2022   \ud83e\udd64 $booster   \u2022   \u271a $medical$errorLine\\nTap to collapse   \u2022   $lockHelp\"", "    detailText?.text = \"STATUS   $statusLine\\n$attackLine\\nFULL   HEALTH $lifeFull   \u2022   ENERGY $energyFull   \u2022   NERVE $nerveFull\\nCOOLDOWNS   \ud83d\udc8a $drug   \u2022   \ud83e\udd64 $booster   \u2022   \u271a $medical$errorLine\\nTap for compact view   \u2022   \u2014 minimizes HUD   \u2022   $lockHelp\"", "lettered expanded details and minimize hint");

kt = replaceOnce(kt, "    val view = eventTickerText ?: return\n    val message = eventTickerMessage", "    val view = eventTickerText ?: return\n    if (hudCollapsed) {\n      view.visibility = View.GONE\n      return\n    }\n    val message = eventTickerMessage", "keep ticker hidden while HUD minimized");

kt = replaceOnce(kt, "  private data class HudBarPiece(val text: String, val current: Int, val maximum: Int, val color: Int)\n\n", " ", "tidy unused bar piece helper");

// Final v1.0 compact city HUD pass
kt = replaceOnce(kt, "import android.graphics.Color\nimport android.graphics.PixelFormat\nimport android.graphics.Typeface\nimport android.graphics.drawable.GradientDrawable", "import android.graphics.Canvas\nimport android.graphics.Color\nimport android.graphics.Paint\nimport android.graphics.PixelFormat\nimport android.graphics.Typeface\nimport android.graphics.drawable.Drawable\nimport android.graphics.drawable.GradientDrawable", "city skyline drawing imports");
kt = replaceOnce(kt, "private class GlowSpan(private val radius: Float, private val glowColor: Int) : CharacterStyle(), UpdateAppearance {\n    override fun updateDrawState(tp: TextPaint) {\n      tp.setShadowLayer(radius, 0f, 0f, glowColor)\n    }\n  }\n\n   companion object {", "private class GlowSpan(private val radius: Float, private val glowColor: Int) : CharacterStyle(), UpdateAppearance {\n    override fun updateDrawState(tp: TextPaint) {\n      tp.setShadowLayer(radius, 0f, 0f, glowColor)\n    }\n  }\n\n  private class SkylineDrawable(private val density: Float) : Drawable() {\n    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)\n    private fun d(value: Float): Float = value * density\n\n    override fun draw(canvas: Canvas) {\n      val b = bounds\n      if (b.width() <= 0 || b.height() <= 0) return\n      val left = b.left.toFloat()\n      val top = b.top.toFloat()\n      val right = b.right.toFloat()\n      val bottom = b.bottom.toFloat()\n      val width = b.width().toFloat()\n      val height = b.height().toFloat()\n      val radius = d(14f)\n\n      paint.style = Paint.Style.FILL\n      paint.color = Color.argb(248, 54, 57, 62)\n      canvas.drawRoundRect(left, top, right, bottom, radius, radius, paint)\n\n      val skylineBottom = bottom - d(5f)\n      val xs = floatArrayOf(0.00f, 0.09f, 0.18f, 0.27f, 0.37f, 0.46f, 0.55f, 0.65f, 0.74f, 0.84f, 0.93f)\n      val ws = floatArrayOf(0.11f, 0.10f, 0.12f, 0.11f, 0.10f, 0.12f, 0.11f, 0.10f, 0.12f, 0.11f, 0.09f)\n      val hs = floatArrayOf(0.34f, 0.48f, 0.29f, 0.55f, 0.39f, 0.62f, 0.42f, 0.51f, 0.32f, 0.58f, 0.40f)\n      paint.color = Color.argb(90, 11, 13, 16)\n      for (i in xs.indices) {\n        val x = left + width * xs[i]\n        val w = width * ws[i]\n        val h = height * hs[i]\n        canvas.drawRect(x, skylineBottom - h, minOf(right, x + w), skylineBottom, paint)\n      }\n\n      paint.color = Color.argb(34, 225, 229, 234)\n      val windowY = top + height * 0.66f\n      for (i in 0..7) {\n        val x = left + width * (0.08f + i * 0.115f)\n        canvas.drawRect(x, windowY, x + d(2f), windowY + d(2f), paint)\n      }\n\n      paint.style = Paint.Style.STROKE\n      paint.strokeWidth = d(1f)\n      paint.color = Color.argb(165, 213, 47, 50)\n      canvas.drawRoundRect(left + d(.5f), top + d(.5f), right - d(.5f), bottom - d(.5f), radius, radius, paint)\n      paint.style = Paint.Style.FILL\n    }\n\n    override fun setAlpha(alpha: Int) { paint.alpha = alpha }\n    override fun setColorFilter(colorFilter: android.graphics.ColorFilter?) { paint.colorFilter = colorFilter }\n    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT\n  }\n\n  companion object {", "procedural Torn-inspired gray skyline drawable");
kt = replaceOnce(kt, "  private var overlayView: LinearLayout? = null\n  private var statusText: TextView? = null\n  private var collapseText: TextView? = null\n  private var statsRow: LinearLayout? = null\n  private var lifeValueText: TextView? = null\n  private var energyValueText: TextView? = null\n  private var nerveValueText: TextView? = null\n  private var cooldownText: TextView? = null\n  private var eventTickerText: TextView? = null\n  private var detailText: TextView? = null", "  private var overlayView: LinearLayout? = null\n  private var headerRowView: LinearLayout? = null\n  private var accentRailView: View? = null\n  private var logoViewRef: ImageView? = null\n  private var statusText: TextView? = null\n  private var collapseText: TextView? = null\n  private var statsRow: LinearLayout? = null\n  private var lifeValueText: TextView? = null\n  private var energyValueText: TextView? = null\n  private var nerveValueText: TextView? = null\n  private var lifeCooldownText: TextView? = null\n  private var energyCooldownText: TextView? = null\n  private var nerveCooldownText: TextView? = null\n  private var cooldownText: TextView? = null\n  private var eventTickerText: TextView? = null\n  private var detailText: TextView? = null", "compact HUD view references");
kt = replaceOnce(kt, "    val collapsedWidthDp = when {\n      compact -> 150\n      large -> 190\n      else -> 170\n    }", "    val collapsedWidthDp = when {\n      compact -> 38\n      large -> 50\n      else -> 44\n    }", "logo-only collapsed dimensions");
kt = replaceOnce(kt, "      background = GradientDrawable().apply {\n        shape = GradientDrawable.RECTANGLE\n        cornerRadius = dp(14).toFloat()\n        setColor(Color.argb(242, 5, 7, 10))\n        setStroke(dp(1), Color.argb(110, 213, 47, 50))\n      }", "      background = if (hudCollapsed) GradientDrawable().apply {\n        shape = GradientDrawable.RECTANGLE\n        cornerRadius = dp(12).toFloat()\n        setColor(Color.argb(248, 48, 51, 56))\n        setStroke(dp(1), Color.argb(165, 213, 47, 50))\n      } else SkylineDrawable(resources.displayMetrics.density)", "gray cityscape HUD background");
kt = replaceOnce(kt, "    val accentRail = View(this).apply { setBackgroundColor(Color.rgb(213, 47, 50)) }\n    root.addView(accentRail, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply { bottomMargin = dp(6) })", "    val accentRail = View(this).apply {\n      setBackgroundColor(Color.rgb(213, 47, 50))\n      visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    }\n    accentRailView = accentRail\n    root.addView(accentRail, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply { bottomMargin = dp(6) })", "collapsible accent rail");
kt = replaceOnce(kt, "    val headerRow = LinearLayout(this).apply {\n      orientation = LinearLayout.HORIZONTAL\n      gravity = Gravity.CENTER_VERTICAL\n    }\n    val logoView = ImageView(this).apply {\n      setImageDrawable(applicationInfo.loadIcon(packageManager))\n      scaleType = ImageView.ScaleType.FIT_CENTER\n      contentDescription = \"TornPulse\"\n    }\n    headerRow.addView(logoView, LinearLayout.LayoutParams(dp(logoSize), dp(logoSize)).apply { rightMargin = dp(8) })\n    val headerSpacer = View(this)\n    headerRow.addView(headerSpacer, LinearLayout.LayoutParams(0, 1, 1f))\n    statusText = makeText(\"CONNECTING\", headerSize, Color.rgb(176, 183, 193), true).also {\n      it.letterSpacing = 0.12f\n      it.textAlignment = View.TEXT_ALIGNMENT_VIEW_END\n      headerRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n    collapseText = makeText(if (hudCollapsed) \"\uff0b\" else \"\u2014\", headerSize + 2f, Color.rgb(137, 145, 156), true).also {\n      it.setPadding(dp(9), 0, 0, 0)\n      it.contentDescription = if (hudCollapsed) \"Expand TornPulse HUD\" else \"Minimize TornPulse HUD\"\n      headerRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n    root.addView(headerRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n\n", "    val headerRow = LinearLayout(this).apply {\n      orientation = LinearLayout.HORIZONTAL\n      gravity = if (hudCollapsed) Gravity.CENTER else Gravity.CENTER_VERTICAL\n    }\n    headerRowView = headerRow\n    val logoView = ImageView(this).apply {\n      setImageDrawable(applicationInfo.loadIcon(packageManager))\n      scaleType = ImageView.ScaleType.FIT_CENTER\n      contentDescription = if (hudCollapsed) \"Expand TornPulse HUD\" else \"Collapse TornPulse HUD\"\n    }\n    logoViewRef = logoView\n    headerRow.addView(logoView, LinearLayout.LayoutParams(dp(logoSize), dp(logoSize)))\n    statusText = makeText(\"CONNECTING\", headerSize, Color.rgb(176, 183, 193), true).also {\n      it.letterSpacing = 0.12f\n      it.setPadding(dp(8), 0, 0, 0)\n      it.textAlignment = View.TEXT_ALIGNMENT_VIEW_END\n      it.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n      headerRow.addView(it, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    }\n    root.addView(headerRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n\n", "logo-driven compact header");
kt = replaceOnce(kt, "    val statContainer = LinearLayout(this).apply {\n      orientation = LinearLayout.HORIZONTAL\n      gravity = Gravity.CENTER\n      setPadding(0, dp(4), 0, 0)\n      visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    }\n    fun makeStatColumn(label: String, color: Int): Pair<LinearLayout, TextView> {\n      val column = LinearLayout(this).apply {\n        orientation = LinearLayout.VERTICAL\n        gravity = Gravity.CENTER\n      }\n      val labelView = makeText(label, statLabelSize, color, true).apply {\n        letterSpacing = 0.08f\n        textAlignment = View.TEXT_ALIGNMENT_CENTER\n      }\n      val valueView = makeText(\"-- / --\", barsSize, Color.rgb(244, 245, 246), true).apply {\n        setPadding(0, dp(1), 0, 0)\n        maxLines = 1\n        textAlignment = View.TEXT_ALIGNMENT_CENTER\n      }\n      column.addView(labelView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n      column.addView(valueView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n      return Pair(column, valueView)\n    }\n    val lifeStat = makeStatColumn(\"H\", Color.rgb(52, 152, 219))\n    val energyStat = makeStatColumn(\"E\", Color.rgb(103, 213, 45))\n    val nerveStat = makeStatColumn(\"N\", Color.rgb(255, 90, 56))\n    statContainer.addView(lifeStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    statContainer.addView(energyStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    statContainer.addView(nerveStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    lifeValueText = lifeStat.second\n    energyValueText = energyStat.second\n    nerveValueText = nerveStat.second\n    statsRow = statContainer\n    root.addView(statContainer, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n", "    val statContainer = LinearLayout(this).apply {\n      orientation = LinearLayout.HORIZONTAL\n      gravity = Gravity.CENTER\n      setPadding(0, dp(5), 0, dp(1))\n      visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    }\n    fun makeStatColumn(label: String, color: Int): Triple<LinearLayout, TextView, TextView> {\n      val column = LinearLayout(this).apply {\n        orientation = LinearLayout.VERTICAL\n        gravity = Gravity.CENTER\n      }\n      val miniRow = LinearLayout(this).apply {\n        orientation = LinearLayout.HORIZONTAL\n        gravity = Gravity.CENTER\n      }\n      val labelView = makeText(label, statLabelSize + 1f, color, true).apply {\n        letterSpacing = 0.08f\n      }\n      val timerView = makeText(\"--\", maxOf(6f, statLabelSize - 1f), Color.rgb(188, 193, 200), true).apply {\n        setPadding(dp(4), 0, 0, 0)\n        maxLines = 1\n      }\n      miniRow.addView(labelView)\n      miniRow.addView(timerView)\n      val valueView = makeText(\"-- / --\", barsSize, Color.rgb(244, 245, 246), true).apply {\n        setPadding(0, dp(1), 0, 0)\n        maxLines = 1\n        textAlignment = View.TEXT_ALIGNMENT_CENTER\n      }\n      column.addView(miniRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n      column.addView(valueView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n      return Triple(column, valueView, timerView)\n    }\n    val lifeStat = makeStatColumn(\"H\", Color.rgb(52, 152, 219))\n    val energyStat = makeStatColumn(\"E\", Color.rgb(103, 213, 45))\n    val nerveStat = makeStatColumn(\"N\", Color.rgb(255, 90, 56))\n    statContainer.addView(lifeStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    statContainer.addView(energyStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    statContainer.addView(nerveStat.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    lifeValueText = lifeStat.second\n    energyValueText = energyStat.second\n    nerveValueText = nerveStat.second\n    lifeCooldownText = lifeStat.third\n    energyCooldownText = energyStat.third\n    nerveCooldownText = nerveStat.third\n    statsRow = statContainer\n    root.addView(statContainer, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n", "H E N with per-stat full timers");
kt = replaceOnce(kt, "    cooldownText = makeText(\"\ud83d\udc8a --   \u2022   \ud83e\udd64 --   \u2022   \u271a --\", cooldownSize, Color.rgb(174, 181, 191), true).also {\n      it.setPadding(0, dp(3), 0, 0)\n      it.maxLines = 1\n      it.textAlignment = View.TEXT_ALIGNMENT_CENTER\n      it.visibility = if (compact || hudCollapsed) View.GONE else View.VISIBLE\n      root.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n    eventTickerText = makeText(\"\", tickerSize, Color.rgb(227, 83, 96), true).also {\n      it.setPadding(0, dp(4), 0, 0)\n      it.setSingleLine(true)\n      it.ellipsize = TextUtils.TruncateAt.MARQUEE\n      it.marqueeRepeatLimit = -1\n      it.setHorizontallyScrolling(true)\n      it.isSelected = true\n      it.visibility = View.GONE\n      root.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n\n    detailText = makeText(\"Connecting to Torn\u2026\", detailSize, Color.rgb(153, 163, 178), false).also {\n      it.setPadding(0, dp(5), 0, 0)\n      it.setLineSpacing(dp(1).toFloat(), 1f)\n      it.visibility = View.GONE\n      root.addView(it)\n    }\n\n", "    eventTickerText = makeText(\"\", tickerSize + 1f, Color.rgb(244, 245, 246), true).also {\n      it.setPadding(dp(8), dp(6), dp(8), dp(6))\n      it.maxLines = 2\n      it.visibility = View.GONE\n      root.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {\n        topMargin = dp(6)\n      })\n    }\n\n", "dedicated bottom attack alert box and no pull-down content");
kt = replaceOnce(kt, "          } else if (!moved) {\n            val collapseHit = event.x >= root.width - dp(40) && event.y <= dp(46)\n            if (hudCollapsed || collapseHit) {\n              hudCollapsed = !hudCollapsed\n              expanded = false\n              prefs.edit().putBoolean(\"hud_collapsed\", hudCollapsed).apply()\n              applyCollapsedState()\n              render()\n            } else {\n              expanded = !expanded\n              detailText?.visibility = if (expanded) View.VISIBLE else View.GONE\n              render()\n            }\n          }", "          } else if (!moved) {\n            val logoHit = hudCollapsed || (event.x <= dp(logoSize + 14) && event.y <= dp(logoSize + 14))\n            if (logoHit) {\n              hudCollapsed = !hudCollapsed\n              expanded = false\n              prefs.edit().putBoolean(\"hud_collapsed\", hudCollapsed).apply()\n              applyCollapsedState()\n              render()\n            }\n          }", "logo-only collapse interaction without pull-down");
kt = replaceOnce(kt, "    overlayView = null\n    statusText = null\n    collapseText = null\n    statsRow = null\n    lifeValueText = null\n    energyValueText = null\n    nerveValueText = null\n    cooldownText = null\n    eventTickerText = null\n    detailText = null", "    overlayView = null\n    headerRowView = null\n    accentRailView = null\n    logoViewRef = null\n    statusText = null\n    collapseText = null\n    statsRow = null\n    lifeValueText = null\n    energyValueText = null\n    nerveValueText = null\n    lifeCooldownText = null\n    energyCooldownText = null\n    nerveCooldownText = null\n    cooldownText = null\n    eventTickerText = null\n    detailText = null", "rebuild compact HUD refs");
kt = replaceOnce(kt, "  private fun applyCollapsedState() {\n    val root = overlayView ?: return\n    statsRow?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    cooldownText?.visibility = if (hudCollapsed || compactHud) View.GONE else View.VISIBLE\n    detailText?.visibility = if (!hudCollapsed && expanded) View.VISIBLE else View.GONE\n    collapseText?.text = if (hudCollapsed) \"\uff0b\" else \"\u2014\"\n    collapseText?.contentDescription = if (hudCollapsed) \"Expand TornPulse HUD\" else \"Minimize TornPulse HUD\"\n    root.minimumWidth = dp(if (hudCollapsed) currentCollapsedWidthDp else currentMinWidthDp)\n    if (hudCollapsed) {\n      eventTickerText?.visibility = View.GONE\n    } else {\n      renderEventTicker()\n    }\n    val lp = params\n    if (lp != null) {\n      val display = resources.displayMetrics\n      val targetWidth = dp(if (hudCollapsed) currentCollapsedWidthDp else currentMinWidthDp)\n      lp.x = min(max(0, lp.x), max(0, display.widthPixels - targetWidth))\n      try { windowManager.updateViewLayout(root, lp) } catch (_: Exception) {}\n    }\n    root.requestLayout()\n  }\n\n", "  private fun applyCollapsedState() {\n    val root = overlayView ?: return\n    statsRow?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    statusText?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    accentRailView?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    headerRowView?.gravity = if (hudCollapsed) Gravity.CENTER else Gravity.CENTER_VERTICAL\n    logoViewRef?.contentDescription = if (hudCollapsed) \"Expand TornPulse HUD\" else \"Collapse TornPulse HUD\"\n    root.minimumWidth = dp(if (hudCollapsed) currentCollapsedWidthDp else currentMinWidthDp)\n    root.background = if (hudCollapsed) GradientDrawable().apply {\n      shape = GradientDrawable.RECTANGLE\n      cornerRadius = dp(12).toFloat()\n      setColor(Color.argb(248, 48, 51, 56))\n      setStroke(dp(1), Color.argb(165, 213, 47, 50))\n    } else SkylineDrawable(resources.displayMetrics.density)\n    if (hudCollapsed) eventTickerText?.visibility = View.GONE else renderEventTicker()\n    val lp = params\n    if (lp != null) {\n      val display = resources.displayMetrics\n      val targetWidth = dp(if (hudCollapsed) currentCollapsedWidthDp else currentMinWidthDp)\n      lp.x = min(max(0, lp.x), max(0, display.widthPixels - targetWidth))\n      try { windowManager.updateViewLayout(root, lp) } catch (_: Exception) {}\n    }\n    root.requestLayout()\n  }\n\n", "logo-only collapsed state");
kt = replaceOnce(kt, "      renderEmptyBars()\n      cooldownText?.text = \"\ud83d\udc8a --   \u2022   \ud83e\udd64 --   \u2022   \u271a --\"\n      renderEventTicker()\n      detailText?.text = lastError ?: \"Connecting to Torn\u2026\"\n      return", "      renderEmptyBars()\n      lifeCooldownText?.text = \"--\"\n      energyCooldownText?.text = \"--\"\n      nerveCooldownText?.text = \"--\"\n      renderEventTicker()\n      return", "empty compact HUD timers");
kt = replaceOnce(kt, "    val lifeFull = if (life >= snap.life.maximum) \"CAPPED\" else formatDuration(remaining(snap.life.fullTime, elapsed))\n    val energyFull = if (energy >= snap.energy.maximum) \"CAPPED\" else formatDuration(remaining(snap.energy.fullTime, elapsed))\n    val nerveFull = if (nerve >= snap.nerve.maximum) \"CAPPED\" else formatDuration(remaining(snap.nerve.fullTime, elapsed))\n    val drug = formatDuration(remaining(snap.drug, elapsed))\n    val booster = formatDuration(remaining(snap.booster, elapsed))\n    val medical = formatDuration(remaining(snap.medical, elapsed))\n    val statusLine = if (statusRemaining > 0) \"${snap.statusDescription} \u2022 ${formatDuration(statusRemaining)}\" else snap.statusDescription\n    val attackLine = snap.latestAttack?.let {\n      val who = it.attackerName ?: if (it.isStealthed) \"UNKNOWN / STEALTH\" else \"UNKNOWN ATTACKER\"\n      val age = if (it.ended > 0L) \" \u2022 ${formatAge(max(0L, nowUnix - it.ended).toInt())}\" else \"\"\n      \"LAST INCOMING   $who \u2022 ${it.result}$age\"\n    } ?: if (!snap.attackAccess) \"LAST INCOMING   Limited read-only key required\" else \"LAST INCOMING   No recent attack\"\n    val errorLine = lastError?.let { \"\\nLast refresh failed \u2022 retrying automatically\" } ?: \"\"\n\n    cooldownText?.text = \"\ud83d\udc8a $drug   \u2022   \ud83e\udd64 $booster   \u2022   \u271a $medical\"\n    val lockHelp = if (positionLocked) \"Hold to unlock position\" else \"Hold to lock position\"\n    detailText?.text = \"STATUS   $statusLine\\n$attackLine\\nFULL   HEALTH $lifeFull   \u2022   ENERGY $energyFull   \u2022   NERVE $nerveFull\\nCOOLDOWNS   \ud83d\udc8a $drug   \u2022   \ud83e\udd64 $booster   \u2022   \u271a $medical$errorLine\\nTap for compact view   \u2022   \u2014 minimizes HUD   \u2022   $lockHelp\"", "    val lifeFull = if (life >= snap.life.maximum) \"CAPPED\" else formatDuration(remaining(snap.life.fullTime, elapsed))\n    val energyFull = if (energy >= snap.energy.maximum) \"CAPPED\" else formatDuration(remaining(snap.energy.fullTime, elapsed))\n    val nerveFull = if (nerve >= snap.nerve.maximum) \"CAPPED\" else formatDuration(remaining(snap.nerve.fullTime, elapsed))\n    val timerMuted = Color.rgb(188, 193, 200)\n    lifeCooldownText?.apply {\n      text = lifeFull\n      setTextColor(if (life >= snap.life.maximum) Color.rgb(52, 152, 219) else timerMuted)\n    }\n    energyCooldownText?.apply {\n      text = energyFull\n      setTextColor(if (energy >= snap.energy.maximum) Color.rgb(103, 213, 45) else timerMuted)\n    }\n    nerveCooldownText?.apply {\n      text = nerveFull\n      setTextColor(if (nerve >= snap.nerve.maximum) Color.rgb(255, 90, 56) else timerMuted)\n    }", "per-stat cooldown prompt rendering");
kt = replaceOnce(kt, "  private fun renderEventTicker() {\n    val view = eventTickerText ?: return\n    if (hudCollapsed) {\n      view.visibility = View.GONE\n      return\n    }\n    val message = eventTickerMessage\n    if (message.isNullOrBlank() || SystemClock.elapsedRealtime() >= eventTickerUntilElapsed) {\n      view.visibility = View.GONE\n      return\n    }\n    view.setTextColor(eventTickerColor)\n    val display = \"  $message   \u2022   $message   \"\n    if (view.text.toString() != display) {\n      view.text = display\n      view.isSelected = false\n      view.isSelected = true\n    }\n    view.visibility = View.VISIBLE\n  }\n\n", "  private fun renderEventTicker() {\n    val view = eventTickerText ?: return\n    if (hudCollapsed) {\n      view.visibility = View.GONE\n      return\n    }\n    val message = eventTickerMessage\n    if (message.isNullOrBlank() || SystemClock.elapsedRealtime() >= eventTickerUntilElapsed) {\n      view.visibility = View.GONE\n      return\n    }\n    view.text = \"\u26a0  ALERT  \u2022  $message\"\n    view.setTextColor(eventTickerColor)\n    view.background = GradientDrawable().apply {\n      shape = GradientDrawable.RECTANGLE\n      cornerRadius = dp(8).toFloat()\n      setColor(Color.argb(220, 36, 31, 34))\n      setStroke(dp(1), Color.argb(205, Color.red(eventTickerColor), Color.green(eventTickerColor), Color.blue(eventTickerColor)))\n    }\n    view.visibility = View.VISIBLE\n  }\n\n", "boxed bottom attack and mug alert");

// Final v1.0 main-screen stat typography pass
let app = extractEmbedded('APP_JS').value;
app = replaceOnce(
  app,
  'function MetricCard({label, symbol, bar, accent}) {',
  'function MetricCard({label, bar, accent}) {',
  'main-screen metric signature without symbols'
);
app = replaceOnce(
  app,
  '<View style={styles.metricIdentity}><View style={[styles.metricBadge,{borderColor:accent}]}><Text style={[styles.metricBadgeText,{color:accent}]}>{symbol}</Text></View><Text style={styles.metricLabel}>{label}</Text></View>',
  '<View style={styles.metricIdentity}><Text style={[styles.metricLabel,{color:accent}]}>{label}</Text></View>',
  'main-screen full-word bold metric labels'
);
app = replaceOnce(
  app,
  '{snapshot.life?<MetricCard label="HEALTH" symbol="♥" bar={snapshot.life} accent={C.life}/>:null}\n    <MetricCard label="ENERGY" symbol="⚡" bar={snapshot.energy} accent={C.energy}/>\n    <MetricCard label="NERVE" symbol="✺" bar={snapshot.nerve} accent={C.nerve}/>',
  '{snapshot.life?<MetricCard label="Health" bar={snapshot.life} accent={C.life}/>:null}\n    <MetricCard label="Energy" bar={snapshot.energy} accent={C.energy}/>\n    <MetricCard label="Nerve" bar={snapshot.nerve} accent={C.nerve}/>',
  'main-screen Health Energy Nerve labels'
);


// Final v1.0 Torn-familiar graphite reskin
const skylineStart = kt.indexOf('  private class SkylineDrawable');
const companionStart = skylineStart >= 0 ? kt.indexOf('  companion object {', skylineStart) : -1;
if (skylineStart < 0 || companionStart < 0) throw new Error('TornPulse gray reskin: SkylineDrawable block not found');
kt = kt.slice(0, skylineStart) + kt.slice(companionStart);

kt = replaceOnce(
  kt,
  `import android.graphics.Canvas\nimport android.graphics.Color\nimport android.graphics.Paint\nimport android.graphics.PixelFormat\nimport android.graphics.Typeface\nimport android.graphics.drawable.Drawable\nimport android.graphics.drawable.GradientDrawable`,
  `import android.graphics.Color\nimport android.graphics.PixelFormat\nimport android.graphics.Typeface\nimport android.graphics.drawable.GradientDrawable`,
  'remove skyline drawing imports'
);

const grayHudBackground = `      background = GradientDrawable(\n        GradientDrawable.Orientation.TOP_BOTTOM,\n        intArrayOf(Color.rgb(77, 80, 83), Color.rgb(54, 57, 60))\n      ).apply {\n        shape = GradientDrawable.RECTANGLE\n        cornerRadius = dp(12).toFloat()\n      }`;
kt = replaceOnce(
  kt,
  `      background = if (hudCollapsed) GradientDrawable().apply {\n        shape = GradientDrawable.RECTANGLE\n        cornerRadius = dp(12).toFloat()\n        setColor(Color.argb(248, 48, 51, 56))\n        setStroke(dp(1), Color.argb(165, 213, 47, 50))\n      } else SkylineDrawable(resources.displayMetrics.density)`,
  grayHudBackground,
  'clean graphite HUD background'
);

kt = replaceOnce(
  kt,
  `      setBackgroundColor(Color.rgb(213, 47, 50))`,
  `      setBackgroundColor(Color.argb(85, 225, 228, 231))`,
  'neutral steel HUD divider'
);

kt = replaceOnce(
  kt,
  `    root.background = if (hudCollapsed) GradientDrawable().apply {\n      shape = GradientDrawable.RECTANGLE\n      cornerRadius = dp(12).toFloat()\n      setColor(Color.argb(248, 48, 51, 56))\n      setStroke(dp(1), Color.argb(165, 213, 47, 50))\n    } else SkylineDrawable(resources.displayMetrics.density)`,
  `    root.background = GradientDrawable(\n      GradientDrawable.Orientation.TOP_BOTTOM,\n      intArrayOf(Color.rgb(77, 80, 83), Color.rgb(54, 57, 60))\n    ).apply {\n      shape = GradientDrawable.RECTANGLE\n      cornerRadius = dp(12).toFloat()\n    }`,
  'clean graphite collapsed/expanded HUD shell'
);

app = replaceOnce(
  app,
  `const C={\n  bg:'#050607',\n  surface:'#0B0D10',\n  surface2:'#111419',\n  line:'#22272E',\n  line2:'#353C46',\n  text:'#F4F5F6',\n  muted:'#89919C',\n  red:'#D52F32',\n  redDark:'#251012',\n  life:'#3498DB',\n  energy:'#67D52D',\n  nerve:'#FF5A38',\n  green:'#61D785',\n  amber:'#E1A834'\n};`,
  `const C={\n  bg:'#303336',\n  surface:'#3A3E41',\n  surface2:'#464A4E',\n  line:'#26292C',\n  line2:'#5B6065',\n  text:'#F3F3F1',\n  muted:'#B7BBC0',\n  red:'#C83A3E',\n  redDark:'#44272A',\n  life:'#3498DB',\n  energy:'#67D52D',\n  nerve:'#FF5A38',\n  green:'#6FD08D',\n  amber:'#D7A544'\n};`,
  'Torn-familiar graphite app palette'
);

app = replaceOnce(
  app,
  `A live overlay for Health, Energy, Nerve and Torn status. Choose a size, tap to expand, drag to move, or hold to lock it in place.`,
  `A compact live overlay for Health, Energy, Nerve and Torn status. Choose a size, tap the TornPulse logo to collapse, drag to move, or hold to lock it in place.`,
  'updated HUD help copy'
);
app = replaceOnce(app, `tap • drag • hold lock`, `logo collapse • drag • hold lock`, 'updated HUD interaction hint');

// Industrialize the main page: tighter corners and warmer steel-gray copy.
app = app.replaceAll("borderRadius:14", "borderRadius:7");
app = app.replaceAll("borderRadius:13", "borderRadius:7");
app = app.replaceAll("borderRadius:12", "borderRadius:6");
app = app.replaceAll("borderRadius:11", "borderRadius:6");
app = app.replaceAll("borderRadius:10", "borderRadius:5");
app = app.replaceAll("borderRadius:8", "borderRadius:4");
app = app.replaceAll("color:'#C7CBD0'", "color:'#E0E1DF'");
app = app.replaceAll("color:'#C6CAD0'", "color:'#DDDEDC'");
app = app.replaceAll("backgroundColor:'#090B0E'", "backgroundColor:C.surface2");
app = app.replaceAll("backgroundColor:'#242930'", "backgroundColor:'#292C2F'");
app = app.replaceAll("color:'#666D76'", "color:'#A4A8AC'");


// Final v1.0 HUD Drug / Booster / Medical cooldown strip
kt = replaceOnce(kt, "  private var lifeCooldownText: TextView? = null\n  private var energyCooldownText: TextView? = null\n  private var nerveCooldownText: TextView? = null\n  private var cooldownText: TextView? = null\n  private var eventTickerText: TextView? = null", "  private var lifeCooldownText: TextView? = null\n  private var energyCooldownText: TextView? = null\n  private var nerveCooldownText: TextView? = null\n  private var cooldownRowView: LinearLayout? = null\n  private var drugCooldownText: TextView? = null\n  private var boosterCooldownText: TextView? = null\n  private var medicalCooldownText: TextView? = null\n  private var cooldownText: TextView? = null\n  private var eventTickerText: TextView? = null", "cooldown strip HUD fields");
kt = replaceOnce(kt, "    statsRow = statContainer\n    root.addView(statContainer, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    eventTickerText = makeText(\"\", tickerSize + 1f, Color.rgb(244, 245, 246), true).also {", "    statsRow = statContainer\n    root.addView(statContainer, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n\n    val cooldownRow = LinearLayout(this).apply {\n      orientation = LinearLayout.HORIZONTAL\n      gravity = Gravity.CENTER\n      visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    }\n    fun makeCooldownChip(label: String, labelColor: Int): Pair<LinearLayout, TextView> {\n      val chip = LinearLayout(this).apply {\n        orientation = LinearLayout.VERTICAL\n        gravity = Gravity.CENTER\n        setPadding(dp(4), dp(4), dp(4), dp(4))\n        background = GradientDrawable().apply {\n          shape = GradientDrawable.RECTANGLE\n          cornerRadius = dp(6).toFloat()\n          setColor(Color.argb(118, 31, 33, 36))\n          setStroke(dp(1), Color.argb(72, 220, 223, 226))\n        }\n      }\n      val labelView = makeText(label, maxOf(6f, cooldownSize - 1f), labelColor, true).apply {\n        letterSpacing = 0.06f\n        maxLines = 1\n        textAlignment = View.TEXT_ALIGNMENT_CENTER\n      }\n      val valueView = makeText(\"--\", cooldownSize, Color.rgb(236, 238, 240), true).apply {\n        setPadding(0, dp(1), 0, 0)\n        maxLines = 1\n        textAlignment = View.TEXT_ALIGNMENT_CENTER\n      }\n      chip.addView(labelView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n      chip.addView(valueView, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n      return Pair(chip, valueView)\n    }\n    val drugChip = makeCooldownChip(\"DRUG\", Color.rgb(180, 184, 205))\n    val boosterChip = makeCooldownChip(\"BOOSTER\", Color.rgb(215, 165, 68))\n    val medicalChip = makeCooldownChip(\"MEDICAL\", Color.rgb(111, 208, 141))\n    cooldownRow.addView(drugChip.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { rightMargin = dp(3) })\n    cooldownRow.addView(boosterChip.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(1); rightMargin = dp(1) })\n    cooldownRow.addView(medicalChip.first, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { leftMargin = dp(3) })\n    drugCooldownText = drugChip.second\n    boosterCooldownText = boosterChip.second\n    medicalCooldownText = medicalChip.second\n    cooldownRowView = cooldownRow\n    root.addView(cooldownRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {\n      topMargin = dp(5)\n    })\n\n    eventTickerText = makeText(\"\", tickerSize + 1f, Color.rgb(244, 245, 246), true).also {", "three-chip cooldown strip layout");
kt = replaceOnce(kt, "  private fun renderEventTicker() {\n    val view = eventTickerText ?: return", "  private fun renderCooldownStrip(drugSeconds: Int, boosterSeconds: Int, medicalSeconds: Int) {\n    fun update(view: TextView?, seconds: Int) {\n      val target = view ?: return\n      when {\n        seconds < 0 -> {\n          target.text = \"--\"\n          target.setTextColor(Color.rgb(170, 175, 181))\n        }\n        seconds == 0 -> {\n          target.text = \"READY\"\n          target.setTextColor(Color.rgb(111, 208, 141))\n        }\n        else -> {\n          target.text = formatDuration(seconds)\n          target.setTextColor(Color.rgb(236, 238, 240))\n        }\n      }\n    }\n    update(drugCooldownText, drugSeconds)\n    update(boosterCooldownText, boosterSeconds)\n    update(medicalCooldownText, medicalSeconds)\n    cooldownRowView?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n  }\n\n  private fun renderEventTicker() {\n    val view = eventTickerText ?: return", "cooldown strip renderer helper");
kt = replaceOnce(kt, "    statsRow?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    statusText?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE", "    statsRow?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    cooldownRowView?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    statusText?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE", "hide cooldown strip with logo collapse");
kt = replaceOnce(kt, "      nerveCooldownText?.text = \"--\"\n      renderEventTicker()\n      return", "      nerveCooldownText?.text = \"--\"\n      renderCooldownStrip(-1, -1, -1)\n      renderEventTicker()\n      return", "empty cooldown strip state");
kt = replaceOnce(kt, "    nerveCooldownText?.apply {\n      text = nerveFull\n      setTextColor(if (nerve >= snap.nerve.maximum) Color.rgb(255, 90, 56) else timerMuted)\n    }", "    nerveCooldownText?.apply {\n      text = nerveFull\n      setTextColor(if (nerve >= snap.nerve.maximum) Color.rgb(255, 90, 56) else timerMuted)\n    }\n    val drugSeconds = remaining(snap.drug, elapsed)\n    val boosterSeconds = remaining(snap.booster, elapsed)\n    val medicalSeconds = remaining(snap.medical, elapsed)\n    renderCooldownStrip(drugSeconds, boosterSeconds, medicalSeconds)", "live Drug Booster Medical cooldown values");
kt = replaceOnce(kt, "    nerveCooldownText = null\n    cooldownText = null\n    eventTickerText = null", "    nerveCooldownText = null\n    cooldownRowView = null\n    drugCooldownText = null\n    boosterCooldownText = null\n    medicalCooldownText = null\n    cooldownText = null\n    eventTickerText = null", "clear cooldown strip references");


// TornPulse — TCT forum clock sync + next-hour countdown
kt = replaceOnce(kt, "  private var cooldownRowView: LinearLayout? = null\n  private var drugCooldownText: TextView? = null\n  private var boosterCooldownText: TextView? = null\n  private var medicalCooldownText: TextView? = null\n  private var cooldownText: TextView? = null\n  private var eventTickerText: TextView? = null", "  private var cooldownRowView: LinearLayout? = null\n  private var drugCooldownText: TextView? = null\n  private var boosterCooldownText: TextView? = null\n  private var medicalCooldownText: TextView? = null\n  private var tornClockRowView: LinearLayout? = null\n  private var tornClockTimeText: TextView? = null\n  private var tornHourCountdownText: TextView? = null\n  @Volatile private var tornServerEpochSeconds = 0L\n  @Volatile private var tornServerSyncElapsed = 0L\n  private var cooldownText: TextView? = null\n  private var eventTickerText: TextView? = null", "TCT clock fields and server-time anchor");
kt = replaceOnce(kt, "    root.addView(headerRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n\n    val statContainer = LinearLayout(this).apply {", "    root.addView(headerRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n\n    val tornClockRow = LinearLayout(this).apply {\n      orientation = LinearLayout.HORIZONTAL\n      gravity = Gravity.CENTER_VERTICAL\n      setPadding(dp(6), dp(4), dp(6), dp(4))\n      visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n      background = GradientDrawable().apply {\n        shape = GradientDrawable.RECTANGLE\n        cornerRadius = dp(6).toFloat()\n        setColor(Color.argb(96, 27, 29, 32))\n        setStroke(dp(1), Color.argb(64, 220, 223, 226))\n      }\n    }\n    tornClockTimeText = makeText(\"TCT  --:--:--\", cooldownSize, Color.rgb(190, 195, 200), true).also {\n      it.maxLines = 1\n      tornClockRow.addView(it, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))\n    }\n    tornHourCountdownText = makeText(\"HOUR  --:--:--\", cooldownSize + 1f, Color.rgb(244, 245, 246), true).also {\n      it.maxLines = 1\n      it.textAlignment = View.TEXT_ALIGNMENT_VIEW_END\n      tornClockRow.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))\n    }\n    tornClockRowView = tornClockRow\n    root.addView(tornClockRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {\n      topMargin = dp(5)\n    })\n\n    val statContainer = LinearLayout(this).apply {", "TCT clock row below HUD header");
kt = replaceOnce(kt, "    statsRow?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    cooldownRowView?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    statusText?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE", "    statsRow?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    cooldownRowView?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    tornClockRowView?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE\n    statusText?.visibility = if (hudCollapsed) View.GONE else View.VISIBLE", "hide TCT clock with logo collapse");
kt = replaceOnce(kt, "      snapshot = next\n      lastError = null\n      handler.post { render() }", "      snapshot = next\n      lastError = null\n      handler.post { render() }\n\n      // Sync against Torn's forum/server clock after the core snapshot is already live.\n      // A failed clock sync never takes Health/Energy/Nerve/status offline.\n      try {\n        val cacheBust = System.currentTimeMillis() / 1000L\n        val serverTime = getJson(\"/forum/timestamp?timestamp=$cacheBust\", key).optLong(\"timestamp\", 0L)\n        if (serverTime > 0L) {\n          tornServerEpochSeconds = serverTime\n          tornServerSyncElapsed = SystemClock.elapsedRealtime()\n          handler.post { renderTornClock() }\n        }\n      } catch (_: Exception) {\n        // Keep the last good Torn clock anchor if the time-only request fails.\n      }", "sync HUD against Torn forum timestamp without affecting core snapshot");
kt = replaceOnce(kt, "  private fun render() {\n    val snap = snapshot", "  private fun render() {\n    renderTornClock()\n    val snap = snapshot", "tick Torn clock every HUD render second");
kt = replaceOnce(kt, "    val nowUnix = System.currentTimeMillis() / 1000L", "    val nowUnix = currentTornEpochSeconds() ?: (System.currentTimeMillis() / 1000L)", "use Torn server time for status countdowns when synced");
kt = replaceOnce(kt, "  private fun renderCooldownStrip(drugSeconds: Int, boosterSeconds: Int, medicalSeconds: Int) {", "  private fun currentTornEpochSeconds(): Long? {\n    if (tornServerEpochSeconds <= 0L || tornServerSyncElapsed <= 0L) return null\n    val elapsedSeconds = ((SystemClock.elapsedRealtime() - tornServerSyncElapsed) / 1000L).coerceAtLeast(0L)\n    return tornServerEpochSeconds + elapsedSeconds\n  }\n\n  private fun clockStamp(totalSeconds: Long): String {\n    val hours = totalSeconds / 3600L\n    val minutes = (totalSeconds % 3600L) / 60L\n    val seconds = totalSeconds % 60L\n    return hours.toString().padStart(2, '0') + \":\" +\n      minutes.toString().padStart(2, '0') + \":\" +\n      seconds.toString().padStart(2, '0')\n  }\n\n  private fun renderTornClock() {\n    val row = tornClockRowView ?: return\n    if (hudCollapsed) {\n      row.visibility = View.GONE\n      return\n    }\n    row.visibility = View.VISIBLE\n    val now = currentTornEpochSeconds()\n    if (now == null) {\n      tornClockTimeText?.apply {\n        text = \"TCT  SYNCING\"\n        setTextColor(Color.rgb(190, 195, 200))\n      }\n      tornHourCountdownText?.apply {\n        text = \"HOUR  --:--:--\"\n        setTextColor(Color.rgb(190, 195, 200))\n      }\n      return\n    }\n\n    val daySeconds = ((now % 86400L) + 86400L) % 86400L\n    val secondsIntoHour = daySeconds % 3600L\n    val remaining = if (secondsIntoHour == 0L) 0L else 3600L - secondsIntoHour\n    tornClockTimeText?.apply {\n      text = \"TCT  ${clockStamp(daySeconds)}\"\n      setTextColor(Color.rgb(205, 209, 213))\n    }\n    tornHourCountdownText?.apply {\n      text = \"HOUR  ${clockStamp(remaining)}\"\n      setTextColor(when {\n        remaining in 1L..10L -> Color.rgb(227, 83, 96)\n        remaining in 11L..60L -> Color.rgb(215, 165, 68)\n        remaining == 0L -> Color.rgb(111, 208, 141)\n        else -> Color.rgb(244, 245, 246)\n      })\n    }\n  }\n\n  private fun renderCooldownStrip(drugSeconds: Int, boosterSeconds: Int, medicalSeconds: Int) {", "TCT clock and top-of-hour countdown renderer");
kt = replaceOnce(kt, "    nerveCooldownText = null\n    cooldownRowView = null\n    drugCooldownText = null\n    boosterCooldownText = null\n    medicalCooldownText = null\n    cooldownText = null", "    nerveCooldownText = null\n    cooldownRowView = null\n    drugCooldownText = null\n    boosterCooldownText = null\n    medicalCooldownText = null\n    tornClockRowView = null\n    tornClockTimeText = null\n    tornHourCountdownText = null\n    cooldownText = null", "clear TCT clock view references");

setEmbedded('APP_JS', app);

setEmbedded('OVERLAY_SERVICE_KT', kt);
fs.writeFileSync(FILE, src, 'utf8');
console.log('\nTornPulse TCT forum clock + hourly countdown applied successfully.');


// ================================================================
// TornPulse Target Assistant — Baldr-style live target integration
// Kept inside patch-v100-hud.cjs so GitHub patch numbering stays unchanged.
// ================================================================
;(() => {
const fs = require('fs');
const FILE = 'app.config.js';
let src = fs.readFileSync(FILE, 'utf8');

function extractEmbedded(name) {
  const prefix = `const ${name} = `;
  const start = src.indexOf(prefix);
  if (start < 0) throw new Error(`TornPulse Target Assistant: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse Target Assistant: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse Target Assistant: could not parse ${name}`);
  return {start:valueStart, end:i + 1, value:JSON.parse(src.slice(valueStart, i + 1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0, found.start) + JSON.stringify(value) + src.slice(found.end);
}

function replaceOnce(text, oldText, newText, label) {
  if (text.includes(newText)) return text;
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`TornPulse Target Assistant: expected 1 match for ${label}, found ${count}`);
  return text.replace(oldText, newText);
}

let app = extractEmbedded('APP_JS').value;
let overlayModule = extractEmbedded('OVERLAY_MODULE_KT').value;

// Add the Android UI/WebView imports needed for TornPulse's persistent in-app attack browser.
overlayModule = replaceOnce(
  overlayModule,
  `import android.content.Intent
import android.net.Uri
import android.os.Build`,
  `import android.app.Dialog
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Build
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView`,
  'in-app attack browser native imports'
);

// Android's official Torn app intercepts normal torn.com ACTION_VIEW links and routes
// them into its URL Manager. Add a native helper that explicitly targets real browser
// packages so the user's sword tap reaches Torn's web attack screen instead.
overlayModule = replaceOnce(
  overlayModule,
  `  @ReactMethod
  fun isRunning(promise: Promise) {
    promise.resolve(ComfortableOverlayService.isRunning)
  }`,
  `  @ReactMethod
  fun openAttackBrowser(url: String, promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "TornPulse could not open the in-app Torn browser.")
      return
    }
    activity.runOnUiThread {
      try {
        val cookies = CookieManager.getInstance()
        cookies.setAcceptCookie(true)

        val dialog = Dialog(activity, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.BLACK))

        val root = LinearLayout(activity).apply {
          orientation = LinearLayout.VERTICAL
          setBackgroundColor(Color.rgb(5, 6, 8))
        }

        val web = WebView(activity).apply {
          setBackgroundColor(Color.BLACK)
          settings.javaScriptEnabled = true
          settings.domStorageEnabled = true
          settings.databaseEnabled = true
          settings.loadsImagesAutomatically = true
          settings.useWideViewPort = true
          settings.loadWithOverviewMode = false
          settings.setSupportZoom(false)
          webViewClient = WebViewClient()
          webChromeClient = WebChromeClient()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          cookies.setAcceptThirdPartyCookies(web, true)
        }

        val top = LinearLayout(activity).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.CENTER_VERTICAL
          setPadding(18, 10, 10, 10)
          setBackgroundColor(Color.rgb(13, 15, 18))
        }
        val title = TextView(activity).apply {
          text = "TORNPULSE • TORN"
          setTextColor(Color.rgb(242, 244, 246))
          textSize = 14f
          setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val spacer = android.view.View(activity)
        val back = Button(activity).apply {
          text = "BACK"
          setOnClickListener {
            if (web.canGoBack()) web.goBack() else dialog.dismiss()
          }
        }
        val close = Button(activity).apply {
          text = "CLOSE"
          setOnClickListener { dialog.dismiss() }
        }
        top.addView(title, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        top.addView(spacer, LinearLayout.LayoutParams(0, 1, 1f))
        top.addView(back, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        top.addView(close, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        root.addView(top, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        root.addView(web, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        dialog.setContentView(root, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        dialog.setOnDismissListener {
          cookies.flush()
          web.stopLoading()
          web.destroy()
        }
        dialog.show()
        web.loadUrl(url)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("ATTACK_BROWSER", "Unable to open TornPulse's in-app Torn browser.", e)
      }
    }
  }

  @ReactMethod
  fun openExternalUrl(url: String, promise: Promise) {
    val uri = Uri.parse(url)
    val browserPackages = listOf(
      "com.sec.android.app.sbrowser",
      "com.android.chrome",
      "com.google.android.apps.chrome",
      "org.mozilla.firefox",
      "com.brave.browser",
      "com.microsoft.emmx",
      "com.opera.browser",
      "com.opera.gx",
      "com.vivaldi.browser",
      "com.duckduckgo.mobile.android"
    )
    var lastError: Exception? = null
    for (packageName in browserPackages) {
      try {
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
          setPackage(packageName)
          addCategory(Intent.CATEGORY_BROWSABLE)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        appContext.startActivity(intent)
        promise.resolve(packageName)
        return
      } catch (e: Exception) {
        lastError = e
      }
    }
    promise.reject("NO_EXTERNAL_BROWSER", "No supported external browser could open this Torn link.", lastError)
  }

  @ReactMethod
  fun isRunning(promise: Promise) {
    promise.resolve(ComfortableOverlayService.isRunning)
  }`,
  'external browser launcher native method'
);
setEmbedded('OVERLAY_MODULE_KT', overlayModule);

// Linking remains a fallback. Android attack links prefer TornPulse's persistent in-app Torn browser.
// The user performs the attack in Torn; TornPulse never automates combat.
app = replaceOnce(
  app,
  'NativeModules, Platform, Pressable,',
  'Animated, Linking, NativeModules, Platform, Pressable,',
  'React Native Linking import'
);

const targetComponents = `
/* TORNPULSE_LIVE_TARGETS_START
 * Target intelligence source: Baldr's public leveling lists, mirrored by OranWeb.
 * Live availability source: Torn API v2 /user/{id}/basic using the user's existing API key.
 * The scanner deliberately budgets its own calls below Torn's published 100 req/min limit.
 */
const BALDR_SOURCE_URL = 'https://raw.githubusercontent.com/OranWeb/tc-baldrs-levelling-list/master/data.json';
const TARGET_PAGE_SIZE = 36;
const TARGET_API_BUDGET = 70;
const TARGET_API_WINDOW_MS = 60000;
const TARGET_MIN_LEVEL = 15;
const TRIP_FORUM_URL = 'https://www.torn.com/forums.php?p=threads&t=16070031';
const TRIP_AFK_TARGETS = [{"id":1152656,"name":"86t7","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1181544,"name":"ronstopable","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":879649,"name":"BloodySorrow","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":937967,"name":"devil8","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":867487,"name":"naterbug_98","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1003909,"name":"slamz123","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":936644,"name":"wee-man13","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":945908,"name":"ZachPowell","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1347599,"name":"ACHILLES300","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":975654,"name":"badkid911","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1415316,"name":"cw65222","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1427616,"name":"daquiane","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1264604,"name":"dman10","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":947081,"name":"genty","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1031581,"name":"jojo96","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":929635,"name":"kyle4493","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1265478,"name":"sunil1","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":842092,"name":"0341grunt","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":917753,"name":"babyboy","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1417924,"name":"bullet789","level":15,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1024614,"name":"Daishaun","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1299741,"name":"pops11","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1422350,"name":"adeyemi","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1354193,"name":"Syd_2345","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1384023,"name":"alex27","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":997057,"name":"jack_le","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1366440,"name":"zzgdogzz","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1115424,"name":"justoneway","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1269232,"name":"Lazyboy36","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1250264,"name":"mariconarana","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1121417,"name":"mastahman12","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1175704,"name":"dude81","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1118454,"name":"harry9876","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":881857,"name":"hassanian","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":929210,"name":"glamorous301","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1280992,"name":"Johna","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1513123,"name":"petert95","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1509582,"name":"youngcarter5","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1126680,"name":"brackee","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1322842,"name":"brav_92popo","level":16,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":977056,"name":"fraselharr","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":886000,"name":"kandak","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":691758,"name":"Ridrix","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1457012,"name":"liljjwild","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1180739,"name":"abdat","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":953916,"name":"bgkane","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":894920,"name":"Death-God","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1412894,"name":"IamBattersby97","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1414611,"name":"tramel","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":903170,"name":"icywicy","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1439606,"name":"JORROCKS","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1394118,"name":"Rida103","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1306675,"name":"Zohe","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1076252,"name":"1076252","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1164883,"name":"mckoyy","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1107790,"name":"minime09","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1317384,"name":"stidn","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":929846,"name":"breshizzle","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1294027,"name":"playername2","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1537904,"name":"laulord1999","level":17,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1143714,"name":"Adri99","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":842230,"name":"collector","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":920457,"name":"Slicker","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":692386,"name":"tomm1001","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":860699,"name":"noelx","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1210466,"name":"rambo85","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":782754,"name":"tigre195","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":941021,"name":"TrickyRicky22","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1160497,"name":"tuanarif","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":959900,"name":"captain_toshiro","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":959589,"name":"Dejanone","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1318542,"name":"indicator34","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1344597,"name":"maran10","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":986909,"name":"saltypuma","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":915359,"name":"4srd4","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":894991,"name":"daniel0434","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1330125,"name":"ghostbusterz13","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":931844,"name":"REBELPRIDE","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":622374,"name":"dark_zodiac7","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1180502,"name":"Keplex","level":18,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":928958,"name":"Ophianne","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":927486,"name":"Rell","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":463693,"name":"van-helsing","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":625140,"name":"haflife678","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1008675,"name":"hiromishi","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1292835,"name":"blueyesd2","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1301482,"name":"rabbit132","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1028504,"name":"winfast","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1419601,"name":"BiGBusH","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1126022,"name":"Hafizin","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1442848,"name":"casper619","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1177121,"name":"propaganda","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1183664,"name":"dillin1333","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":897513,"name":"johnnyboy360","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1276959,"name":"Mechwing","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":892496,"name":"jf99","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1192940,"name":"davey1","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":991303,"name":"LEE4EVA","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1100197,"name":"skullmaster","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1579922,"name":"woppers","level":19,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":896057,"name":"andwalt","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":759615,"name":"jetybisto","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":590954,"name":"Smiley6666","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":611381,"name":"Ace9233","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1026078,"name":"Lyss","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":524329,"name":"shanuj","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":794755,"name":"tnm021","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":894666,"name":"nature95boy","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":904225,"name":"CHRIS382","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1545343,"name":"hahapoint","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1104804,"name":"mzwpunk","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1003142,"name":"1Wonder","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":770646,"name":"asdfsf111","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":877991,"name":"Bossman88","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1400442,"name":"landhead71","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1413853,"name":"smw23","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1767292,"name":"XpecoMan","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1368813,"name":"Dustymemories","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":785081,"name":"n1ghtk11lerz","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":708894,"name":"anarchyking420","level":20,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1079830,"name":"Madds4","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":775683,"name":"batista1","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":505181,"name":"SufferingWierdo","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":607500,"name":"eminem999","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1371819,"name":"freakddg83","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1501130,"name":"trooney1992","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1040562,"name":"CrisTheVampire","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1410804,"name":"irokthedude","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":951810,"name":"hoops1113","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1403093,"name":"nedster34","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1282831,"name":"flame1995","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":847030,"name":"mcleano","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1190929,"name":"rean","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":920391,"name":"bean101","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":999334,"name":"klord","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":955843,"name":"Password","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":983094,"name":"bASTO","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1271570,"name":"CLAMPY","level":21,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":687771,"name":"wilson121","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":595042,"name":"scottywalker","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1182544,"name":"wadseee","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":914038,"name":"calvin5258","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":590783,"name":"isidor90210","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":735269,"name":"jvwarrior","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":693146,"name":"K00L-","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1026129,"name":"Moonshiner","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":687503,"name":"boorber","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":857036,"name":"D4RKM1ND101","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1199189,"name":"Bob_the_butler","level":22,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1293226,"name":"ravish","level":23,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":603201,"name":"-Dead-Soulja-","level":23,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":905505,"name":"Bramble420","level":23,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":796316,"name":"raysil","level":24,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1767284,"name":"Awesome0ne","level":24,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":590277,"name":"evil-one","level":24,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":768356,"name":"Chrissy_M_","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"<2K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":602869,"name":"Harp","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":711660,"name":"applexster","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":498180,"name":"Cudda_1480","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1565523,"name":"Hawk000","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":281747,"name":"dark_fart","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":670049,"name":"alria","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":1362214,"name":"Furamax","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":975896,"name":"Azmodeus","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":578558,"name":"corbs92","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":463919,"name":"Excelin","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":567293,"name":"Gh0sT120","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":386818,"name":"dnick493","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":824198,"name":"DiddlesHimself","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":555262,"name":"E2-Gangsta-007","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"},{"id":4980,"name":"Finnishboy","level":25,"total":0,"strength":0,"defense":0,"speed":0,"dexterity":0,"status":"afk","until":0,"staticAfk":true,"statCap":"\u226420K","statusDescription":"Trip's Target Trove \u2022 static inactive target"}];

const TARGET_DEMO = [
  {id:320161,name:'crazydave',level:35,total:990,strength:234,defense:244,speed:257,dexterity:255,status:'okay',until:0},
  {id:522960,name:'maverick1972',level:31,total:396,strength:106,defense:107,speed:99,dexterity:84,status:'hospital',until:Math.floor(Date.now()/1000)+143},
  {id:488552,name:'Mataifa',level:31,total:640,strength:292,defense:39,speed:218,dexterity:91,status:'okay',until:0},
  {id:810355,name:'fanpi017',level:30,total:654,strength:195,defense:138,speed:146,dexterity:175,status:'travel',until:0},
  {id:524912,name:'Luciii',level:28,total:579,strength:117,defense:100,speed:262,dexterity:100,status:'okay',until:0},
  {id:1682111,name:'-----Nick----',level:28,total:638,strength:197,defense:121,speed:177,dexterity:143,status:'jail',until:0},
];

function targetNumber(value) {
  const n = Number(String(value == null ? '0' : value).replace(/,/g,''));
  return Number.isFinite(n) ? n : 0;
}

function normalizeBaldrTarget(row) {
  return {
    id: targetNumber(row && row.id),
    name: String((row && row.name) || ('Player ' + ((row && row.id) || '?'))),
    level: targetNumber(row && row.lvl),
    total: targetNumber(row && row.total),
    strength: targetNumber(row && row.str),
    defense: targetNumber(row && row.def),
    speed: targetNumber(row && row.spd),
    dexterity: targetNumber(row && row.dex),
  };
}

function compactStat(value) {
  const n = Number(value || 0);
  let text = n >= 1e9 ? (n/1e9).toFixed(n>=10e9?1:2)+'b' : n >= 1e6 ? (n/1e6).toFixed(n>=10e6?1:2)+'m' : n >= 1e3 ? (n/1e3).toFixed(n>=100e3?0:1)+'k' : String(n || '?');
  return text.replace(/\\.0(?=[kmb]$)/,'');
}

function normalizeTargetState(status) {
  const raw = String((status && (status.state || status.description)) || 'unknown').toLowerCase();
  if (raw === 'okay') return 'okay';
  if (raw.includes('hospital')) return 'hospital';
  if (raw.includes('jail')) return 'jail';
  if (raw.includes('travel') || raw.includes('abroad')) return 'travel';
  if (raw.includes('fallen')) return 'fallen';
  if (raw.includes('federal')) return 'federal';
  return raw || 'unknown';
}

function targetStatusGlyph(status) {
  if (status === 'okay') return '●';
  if (status === 'afk') return '◆';
  if (status === 'hospital') return '✚';
  if (status === 'jail') return '▣';
  if (status === 'travel') return '✈';
  if (status === 'checking') return '◌';
  if (status === 'error') return '!';
  return '•';
}

function targetStatusColor(status) {
  if (status === 'okay') return C.green;
  if (status === 'afk') return '#9A7CFF';
  if (status === 'hospital') return C.red;
  if (status === 'jail') return C.amber;
  if (status === 'checking') return C.amber;
  return C.muted;
}

function targetStatusText(target, clock) {
  if (!target) return '?';
  if (target.status === 'hospital' && Number(target.until) > 0) {
    const left = Math.max(0, Number(target.until) - Math.floor(Number(clock || Date.now())/1000));
    if (left <= 0) return 'READY?';
    const m = Math.floor(left/60);
    const s = left % 60;
    return (m > 99 ? '99+' : String(m)) + ':' + String(s).padStart(2,'0');
  }
  if (target.status === 'okay') return 'READY';
  if (target.status === 'afk') return 'AFK?';
  if (target.status === 'checking') return '...';
  if (target.status === 'travel') return 'TRAVEL';
  if (target.status === 'jail') return 'JAIL';
  if (target.status === 'fallen') return 'FALLEN';
  if (target.status === 'federal') return 'FED';
  if (target.status === 'error') return 'ERROR';
  return '?';
}

async function fetchPublicTargetStatus(targetId, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const url = 'https://api.torn.com/v2/user/' + encodeURIComponent(targetId) + '/basic?comment=TornPulse-Targets';
    const response = await fetch(url, {
      headers:{Authorization:'ApiKey ' + key, Accept:'application/json'},
      signal:controller.signal,
    });
    const json = await response.json().catch(()=>null);
    if (!response.ok || (json && json.error)) {
      const message = json && json.error && (json.error.error || json.error.message);
      throw new Error(message || ('Torn API error ' + response.status));
    }
    const profile = (json && json.profile) || json || {};
    const rawStatus = profile.status || (json && json.status) || {};
    return {
      status:normalizeTargetState(rawStatus),
      until:targetNumber(rawStatus.until),
      statusDescription:String(rawStatus.description || rawStatus.state || ''),
    };
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('Target status timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function targetListShortName(name) {
  if (name === "Baldr's List 1") return 'BALDR 1';
  if (name === "Baldr's List 2") return 'BALDR 2';
  if (name === "Baldr's List 3") return 'BALDR 3';
  if (name === "Baldr's Extra List 1") return 'EXTRA 1';
  if (name === "Baldr's Extra List 2") return 'EXTRA 2';
  if (name === "Baldr's Extra List 3") return 'EXTRA 3';
  if (name === "Baldr's DOMINO List") return 'DOMINO';
  return String(name || 'TARGETS').replace("Baldr's ",'').toUpperCase();
}

function TornPulsePageTabs({active,onChange}) {
  return <View style={styles.pageTabs}>
    {[['DASHBOARD','⌂  DASHBOARD'],['TARGETS','◎  TARGETS']].map(([key,label]) => <Pressable key={key} onPress={()=>onChange(key)} style={[styles.pageTab,active===key&&styles.pageTabOn]}><Text style={[styles.pageTabText,active===key&&styles.pageTabTextOn]}>{label}</Text></Pressable>)}
  </View>;
}

function PulseBootLogo() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:1,duration:480,useNativeDriver:true}),
      Animated.timing(pulse,{toValue:0,duration:720,useNativeDriver:true}),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);
  const logoScale = pulse.interpolate({inputRange:[0,1],outputRange:[1,1.075]});
  const glowScale = pulse.interpolate({inputRange:[0,1],outputRange:[.86,1.34]});
  const glowOpacity = pulse.interpolate({inputRange:[0,1],outputRange:[.14,.52]});
  const lineScale = pulse.interpolate({inputRange:[0,1],outputRange:[.62,1]});
  return <SafeAreaView style={styles.pulseBootScreen}>
    <StatusBar style="light"/>
    <View style={styles.pulseBootStage}>
      <Animated.View style={[styles.pulseBootGlow,{opacity:glowOpacity,transform:[{scale:glowScale}]}]}/>
      <Animated.View style={[styles.pulseBootLogo,{transform:[{scale:logoScale}]}]}>
        <View style={styles.pulseBootSlash}/>
        <Text style={styles.pulseBootT}>T</Text><Text style={styles.pulseBootP}>P</Text>
      </Animated.View>
    </View>
    <Text style={styles.pulseBootWord}>TORN<Text style={styles.pulseBootWordAccent}>PULSE</Text></Text>
    <View style={styles.pulseBootLineTrack}><Animated.View style={[styles.pulseBootLine,{transform:[{scaleX:lineScale}]}]}/></View>
    <Text style={styles.pulseBootSub}>SYNCING CITY INTEL</Text>
  </SafeAreaView>;
}

function TargetRow({target, demo, clock, onVerify, rank}) {
  const [expanded,setExpanded] = useState(false);
  const staticAfk = Boolean(target.staticAfk);
  const verifying = staticAfk && target.status === 'checking';
  const liveVerified = staticAfk && !['afk','unknown','checking','error'].includes(String(target.status||''));
  const attack = async () => {
    if (demo) return Alert.alert('Target Assistant demo','The sword opens this player in TornPulse’s built-in Torn browser. Log in once there and the session stays available for future targets.');
    const attackUrl = 'https://www.torn.com/page.php?sid=attack&user2ID=' + encodeURIComponent(target.id);
    const profileUrl = 'https://www.torn.com/profiles.php?XID=' + encodeURIComponent(target.id);
    try {
      if (Platform.OS === 'android' && ComfortableOverlay?.openAttackBrowser) {
        await ComfortableOverlay.openAttackBrowser(attackUrl);
      } else if (Platform.OS === 'android' && ComfortableOverlay?.openExternalUrl) {
        await ComfortableOverlay.openExternalUrl(attackUrl);
      } else {
        await Linking.openURL(attackUrl);
      }
    } catch (_) {
      try {
        if (Platform.OS === 'android' && ComfortableOverlay?.openAttackBrowser) {
          await ComfortableOverlay.openAttackBrowser(profileUrl);
        } else if (Platform.OS === 'android' && ComfortableOverlay?.openExternalUrl) {
          await ComfortableOverlay.openExternalUrl(profileUrl);
        } else {
          await Linking.openURL(profileUrl);
        }
        Alert.alert('Attack page could not open','TornPulse opened the player profile instead. Tap Attack from there if needed.');
      } catch (_) {
        Alert.alert('Browser needed','TornPulse could not find a supported browser. Install or enable Samsung Internet, Chrome, Firefox, Brave, Edge, Opera, Vivaldi, or DuckDuckGo.');
      }
    }
  };
  const statusText = targetStatusText(target,clock);
  const totalLabel = staticAfk ? String(target.statCap || '<2K') : compactStat(target.total);
  const railColor = targetStatusColor(target.status);
  return <View style={[styles.targetRow,staticAfk&&styles.targetRowAfk]}>
    <View style={[styles.targetRail,{backgroundColor:railColor}]}/>
    <Pressable onPress={() => setExpanded(v=>!v)} style={styles.targetBody}>
      <View style={styles.targetLine1}>
        <Text style={styles.targetRank}>{String(rank||1).padStart(2,'0')}</Text>
        <Text numberOfLines={1} style={[styles.targetName,staticAfk&&styles.targetNameAfk]}>{target.name}</Text>
        <Text style={styles.targetLv}>L{target.level || '?'}</Text>
        <Text style={styles.targetTotal}>BS {totalLabel}</Text>
        <Text style={[styles.targetState,{color:railColor}]}>{statusText}</Text>
      </View>
      {staticAfk ? <View style={styles.targetLine2}><Text numberOfLines={1} style={[styles.targetStaticMeta,liveVerified&&styles.targetStaticMetaLive]}>{liveVerified ? ('LIVE CHECK • ' + (target.statusDescription || statusText)) : ('TRIP CLASSIC • SOURCE ORDER • ' + (target.statCap || '<2K') + ' BS CAP')}</Text></View> : <View style={styles.targetLine2}>
        <Text style={styles.targetStat}>STR {compactStat(target.strength)}</Text>
        <Text style={styles.targetStat}>DEF {compactStat(target.defense)}</Text>
        <Text style={styles.targetStat}>SPD {compactStat(target.speed)}</Text>
        <Text style={styles.targetStat}>DEX {compactStat(target.dexterity)}</Text>
      </View>}
      {expanded ? <View style={styles.targetExpanded}>
        <Text style={styles.targetExpandedText}>ID {target.id}  •  {staticAfk ? 'TRIP CLASSIC / LEGACY AFK' : 'BALDR LIST INTEL'}  •  {target.statusDescription || statusText}</Text>
      </View> : null}
    </Pressable>
    {staticAfk ? <Pressable onPress={()=>onVerify&&onVerify(target)} disabled={verifying} style={[styles.targetVerify,verifying&&styles.targetVerifyBusy]} accessibilityLabel={'Verify ' + target.name}><Text style={styles.targetVerifyText}>{verifying?'…':'◎'}</Text></Pressable> : null}
    <Pressable onPress={attack} style={[styles.targetAttack,staticAfk&&styles.targetAttackAfk]} accessibilityLabel={'Open attack page for ' + target.name}>
      <Text style={styles.targetAttackText}>⚔</Text>
    </Pressable>
  </View>;
}

function TargetAssistant({demo=false, clock=Date.now()}) {
  const [sourceMode,setSourceMode] = useState(demo ? 'LIVE' : 'AFK');
  const [tab,setTab] = useState('ALL');
  const [lists,setLists] = useState(demo ? {'Demo Targets':TARGET_DEMO} : {});
  const [listName,setListName] = useState(demo ? 'Demo Targets' : '');
  const [levelFilter,setLevelFilter] = useState('ALL');
  const [page,setPage] = useState(0);
  const [statusById,setStatusById] = useState({});
  const [loadingLists,setLoadingLists] = useState(!demo);
  const [scanning,setScanning] = useState(false);
  const [message,setMessage] = useState('');
  const [scanVersion,setScanVersion] = useState(0);
  const scanLogRef = useRef([]);

  useEffect(() => {
    if (demo) return;
    let live = true;
    (async () => {
      setLoadingLists(true);
      try {
        const response = await fetch(BALDR_SOURCE_URL, {headers:{Accept:'application/json'}});
        if (!response.ok) throw new Error('Target list download failed (' + response.status + ')');
        const raw = await response.json();
        const normalized = {};
        Object.keys(raw || {}).forEach(name => {
          const rows = Array.isArray(raw[name]) ? raw[name] : [];
          normalized[name] = rows.map(normalizeBaldrTarget).filter(t => t.id > 0);
        });
        if (!live) return;
        const names = Object.keys(normalized);
        if (!names.length) throw new Error('No Baldr target lists were returned.');
        setLists(normalized);
        setListName(names[0]);
        setMessage('Live Baldr lists loaded');
      } catch (e) {
        if (live) setMessage(e && e.message ? e.message : 'Could not load the live target list.');
      } finally { if (live) setLoadingLists(false); }
    })();
    return () => { live = false; };
  }, [demo]);

  const listNames = Object.keys(lists);
  const liveTargets = (lists[listName] || []).map(t => ({...t,...(statusById[t.id] || {status:'unknown',until:0,statusDescription:''})}));
  const afkTargets = TRIP_AFK_TARGETS.map(t => ({...t,...(statusById[t.id] || {})}));
  const sourceTargets = sourceMode === 'AFK' && !demo ? afkTargets : liveTargets;
  const eligibleTargets = sourceTargets.filter(t => Number(t.level||0) >= TARGET_MIN_LEVEL);
  const maxSourceLevel = Math.max(TARGET_MIN_LEVEL,...eligibleTargets.map(t=>Number(t.level||TARGET_MIN_LEVEL)));
  const visibleLevels = Array.from({length:Math.max(1,maxSourceLevel-TARGET_MIN_LEVEL+1)},(_,i)=>i+TARGET_MIN_LEVEL);
  const levelCounts = visibleLevels.reduce((map,level)=>{ map[level]=eligibleTargets.filter(t=>Number(t.level)===level).length; return map; },{});
  const allLevelsSelected = levelFilter === 'ALL';
  const filteredTargets = allLevelsSelected ? eligibleTargets : eligibleTargets.filter(t => Number(t.level) === Number(levelFilter));
  const orderedTargets = sourceMode === 'AFK' && !demo
    ? [...filteredTargets]
    : [...filteredTargets].sort((a,b) => allLevelsSelected ? (Number(a.level)-Number(b.level) || a.total-b.total || String(a.name).localeCompare(String(b.name))) : (a.total-b.total || String(a.name).localeCompare(String(b.name))));
  const pageCount = Math.max(1,Math.ceil(orderedTargets.length/TARGET_PAGE_SIZE));
  const safePage = Math.min(page,pageCount-1);
  const pageStart = safePage*TARGET_PAGE_SIZE;
  const pageTargets = orderedTargets.slice(pageStart,pageStart+TARGET_PAGE_SIZE);
  const nowMs = Number(clock || Date.now());
  const recentCalls = scanLogRef.current.filter(ts => nowMs-ts < TARGET_API_WINDOW_MS);
  scanLogRef.current = recentCalls;
  const apiBudget = Math.max(0,TARGET_API_BUDGET-recentCalls.length);
  const readyOnPage = pageTargets.filter(t => t.status === 'okay').length;
  const checkedOnPage = pageTargets.filter(t => t.status && !['unknown','checking','afk'].includes(t.status)).length;

  let shown = [...pageTargets];
  if (sourceMode === 'LIVE' || demo) {
    if (tab === 'READY') shown = shown.filter(t => t.status === 'okay');
    if (tab === 'LOW') shown.sort((a,b) => allLevelsSelected ? (Number(a.level)-Number(b.level) || a.total-b.total) : ((a.status==='okay'?0:1)-(b.status==='okay'?0:1) || a.total-b.total));
    else if (!allLevelsSelected) shown.sort((a,b) => a.total-b.total || String(a.name).localeCompare(String(b.name)));
  }
  const shownGroups = [];
  shown.forEach(target => {
    const level = Number(target.level||0);
    let group = shownGroups[shownGroups.length-1];
    if (!group || group.level !== level) {
      group = {level,targets:[]};
      shownGroups.push(group);
    }
    group.targets.push(target);
  });

  async function scanPage(auto=false) {
    if (sourceMode === 'AFK' && !demo) return;
    if (demo) return Alert.alert('Target Assistant demo','Live mode checks Torn status for the visible page.');
    if (scanning || !pageTargets.length) return;
    const key = await getApiKey();
    if (!key) return Alert.alert('Connect Torn first','Your TornPulse API key is required to check live target status.');
    const current = Date.now();
    const recent = scanLogRef.current.filter(ts => current-ts < TARGET_API_WINDOW_MS);
    scanLogRef.current = recent;
    const budget = Math.max(0,TARGET_API_BUDGET-recent.length);
    if (budget <= 0) {
      const wait = Math.max(1,Math.ceil((TARGET_API_WINDOW_MS-(current-recent[0]))/1000));
      if (!auto) Alert.alert('Scanner cooling down','TornPulse reserved API headroom. Try again in about ' + wait + ' seconds.');
      setMessage('API headroom reserved • ' + wait + 's');
      return;
    }
    const candidates = pageTargets.slice(0,budget);
    if (!candidates.length) return;
    setScanning(true);
    setMessage('Checking ' + candidates.length + ' targets…');
    setStatusById(prev => {
      const next = {...prev};
      candidates.forEach(t => { next[t.id] = {...(next[t.id]||{}),status:'checking'}; });
      return next;
    });
    let failures = 0;
    try {
      for (let i=0;i<candidates.length;i+=4) {
        const group = candidates.slice(i,i+4);
        group.forEach(() => scanLogRef.current.push(Date.now()));
        const results = await Promise.all(group.map(async target => {
          try { return {id:target.id, ...(await fetchPublicTargetStatus(target.id,key))}; }
          catch (e) { failures++; return {id:target.id,status:'error',until:0,statusDescription:e && e.message ? e.message : 'Status error'}; }
        }));
        setStatusById(prev => {
          const next = {...prev};
          results.forEach(result => { next[result.id] = result; });
          return next;
        });
        setScanVersion(v=>v+1);
        if (i+4<candidates.length) await new Promise(resolve => setTimeout(resolve,650));
      }
      setMessage(failures ? ('Scan complete • ' + failures + ' unavailable') : 'Scan complete');
    } finally { setScanning(false); }
  }


  function firstAvailableLevel(rows) {
    const levels = rows.map(t=>Number(t.level||0)).filter(level=>level>=TARGET_MIN_LEVEL).sort((a,b)=>a-b);
    return levels.length ? levels[0] : TARGET_MIN_LEVEL;
  }

  function setSource(mode) {
    setSourceMode(mode);
    setLevelFilter('ALL');
    setPage(0);
    setTab('ALL');
    setMessage(mode==='AFK' ? 'Trip Classic ready • showing all saved levels' : 'Live Baldr ready • showing all levels • refresh when you want a status check');
  }

  function changeList(delta) {
    if (!listNames.length) return;
    const current = Math.max(0,listNames.indexOf(listName));
    const nextIndex = (current+delta+listNames.length)%listNames.length;
    const nextName = listNames[nextIndex];
    setListName(nextName);
    setLevelFilter('ALL');
    setPage(0);
    setTab('ALL');
    setMessage('Live list changed • showing all levels • tap refresh to check the visible page');
  }

  async function verifyOne(target) {
    if (demo || !target || !target.id) return;
    if (target.status === 'checking') return;
    const key = await getApiKey();
    if (!key) return Alert.alert('Connect Torn first','Your TornPulse API key is required to verify this target.');
    const current = Date.now();
    const recent = scanLogRef.current.filter(ts => current-ts < TARGET_API_WINDOW_MS);
    scanLogRef.current = recent;
    if (recent.length >= TARGET_API_BUDGET) {
      const wait = Math.max(1,Math.ceil((TARGET_API_WINDOW_MS-(current-recent[0]))/1000));
      return Alert.alert('Scanner cooling down','TornPulse is preserving API headroom. Try this target again in about ' + wait + ' seconds.');
    }
    setStatusById(prev=>({...prev,[target.id]:{...(prev[target.id]||{}),status:'checking',until:0,statusDescription:'Checking Torn…'}}));
    scanLogRef.current.push(Date.now());
    setMessage('Verifying ' + target.name + '…');
    try {
      const result = await fetchPublicTargetStatus(target.id,key);
      setStatusById(prev=>({...prev,[target.id]:result}));
      setMessage(target.name + ' • ' + targetStatusText({...target,...result},Date.now()));
    } catch (e) {
      const result={status:'error',until:0,statusDescription:e&&e.message?e.message:'Status error'};
      setStatusById(prev=>({...prev,[target.id]:result}));
      setMessage(target.name + ' • verification failed');
    }
  }

  function selectLevel(level) {
    const next = level === 'ALL' ? 'ALL' : Number(level);
    setLevelFilter(next);
    setPage(0);
    setTab('ALL');
    setMessage(next === 'ALL' ? ((sourceMode==='AFK'?'AFK':'Live') + ' • all levels selected') : ((sourceMode==='AFK'?'AFK':'Live') + ' Level ' + next + ' selected'));
  }

  function changePage(delta) {
    const nextPage = Math.max(0,Math.min(pageCount-1,safePage+delta));
    if (nextPage === safePage) return;
    setPage(nextPage);
    if (sourceMode==='LIVE') setMessage('Page ' + (nextPage+1) + ' • refresh to check status');
  }

  const levelScopeLabel = allLevelsSelected ? 'ALL LEVELS' : ('LEVEL ' + levelFilter);
  const emptyTitle = sourceMode==='AFK' ? ('NO AFK TARGETS IN ' + levelScopeLabel) : loadingLists ? 'LOADING TARGET INTEL…' : scanning ? 'SCANNING…' : tab==='READY' && checkedOnPage===0 ? 'CHECKING AVAILABILITY…' : tab==='READY' ? ('NO READY TARGETS IN ' + levelScopeLabel) : ('NO TARGETS IN ' + levelScopeLabel);
  const emptyText = sourceMode==='AFK' ? 'Choose ALL or another level from the strip.' : loadingLists ? 'Pulling the current Baldr target lists.' : tab==='READY' ? 'Tap refresh to re-check the visible page, or switch to LOW BS / ALL STATES.' : 'Choose ALL, another level, or another Baldr list.';
  const afkCount = allLevelsSelected ? eligibleTargets.length : TRIP_AFK_TARGETS.filter(t=>Number(t.level)===Number(levelFilter)).length;

  return <View style={styles.targetPanel}>
    <View style={styles.targetSourceBar}>
      <Pressable onPress={()=>setSource('LIVE')} style={[styles.targetSourceChip,sourceMode==='LIVE'&&styles.targetSourceChipLive]}><Text style={[styles.targetSourceText,sourceMode==='LIVE'&&styles.targetSourceTextOn]}>⚡ LIVE BALDR</Text></Pressable>
      <Pressable onPress={()=>setSource('AFK')} style={[styles.targetSourceChip,sourceMode==='AFK'&&styles.targetSourceChipAfk]}><Text style={[styles.targetSourceText,sourceMode==='AFK'&&styles.targetSourceTextOn]}>◆ AFK CLASSIC</Text></Pressable>
    </View>
    <View style={styles.targetHead}>
      <View style={{flex:1,minWidth:0}}><Text style={styles.targetEyebrow}>{sourceMode==='AFK'?'STATIC AFK TARGETS':'LIVE TARGET ASSISTANT'}</Text><Text style={[styles.targetCount,sourceMode==='AFK'&&styles.targetCountAfk]}>{sourceMode==='AFK' ? (afkCount+' TARGETS • '+levelScopeLabel) : (readyOnPage+' READY')} <Text style={styles.targetCountMuted}>{sourceMode==='AFK'?'• STATIC • VERIFY OPTIONAL':('• '+checkedOnPage+'/'+pageTargets.length+' CHECKED • API '+apiBudget+'/'+TARGET_API_BUDGET)}</Text></Text></View>
      {sourceMode==='LIVE' ? <Pressable onPress={()=>scanPage(false).catch(()=>{})} disabled={scanning||loadingLists||!pageTargets.length} style={[styles.targetRefresh,(scanning||loadingLists)&&styles.targetRefreshOff]}><Text style={styles.targetRefreshText}>{scanning?'…':'↻'}</Text></Pressable> : <View style={styles.targetStaticBadge}><Text style={styles.targetStaticBadgeText}>AFK</Text></View>}
    </View>
    {sourceMode==='LIVE' ? <View style={styles.targetListBar}>
      <Pressable onPress={()=>changeList(-1)} style={styles.targetListArrow}><Text style={styles.targetListArrowText}>‹</Text></Pressable>
      <View style={styles.targetListNameWrap}><Text numberOfLines={1} style={styles.targetListName}>{targetListShortName(listName)}</Text><Text style={styles.targetListMeta}>{filteredTargets.length} • {levelScopeLabel} • PAGE {safePage+1}/{pageCount}</Text></View>
      <Pressable onPress={()=>changeList(1)} style={styles.targetListArrow}><Text style={styles.targetListArrowText}>›</Text></Pressable>
    </View> : <Pressable onPress={()=>Linking.openURL(TRIP_FORUM_URL).catch(()=>{})} style={styles.targetAfkSource}><View><Text style={styles.targetAfkSourceTitle}>TRIP'S TARGET TROVE</Text><Text style={styles.targetAfkSourceMeta}>{TRIP_AFK_TARGETS.length} BUILT-IN • FROM 387 ORIGINAL • LEVELS 15–25</Text></View><Text style={styles.targetAfkSourceArrow}>↗</Text></Pressable>}
    <View style={styles.targetLevelWrap}>
      <Text style={styles.targetLevelLabel}>FILTER LEVEL • ALL OR PICK ONE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.targetLevelScroll}>
        <Pressable onPress={()=>selectLevel('ALL')} style={[styles.targetLevelChip,styles.targetLevelChipAll,allLevelsSelected&&styles.targetLevelChipOn]}><Text style={[styles.targetLevelChipText,allLevelsSelected&&styles.targetLevelChipTextOn]}>ALL</Text><Text style={[styles.targetLevelChipCount,allLevelsSelected&&styles.targetLevelChipCountOn]}>{eligibleTargets.length}</Text></Pressable>
        {visibleLevels.map(level => { const count=Number(levelCounts[level]||0); return <Pressable key={level} onPress={()=>selectLevel(level)} style={[styles.targetLevelChip,count===0&&styles.targetLevelChipEmpty,Number(levelFilter)===level&&styles.targetLevelChipOn]}><Text style={[styles.targetLevelChipText,Number(levelFilter)===level&&styles.targetLevelChipTextOn]}>{level}</Text><Text style={[styles.targetLevelChipCount,Number(levelFilter)===level&&styles.targetLevelChipCountOn]}>{count||'–'}</Text></Pressable>; })}
      </ScrollView>
    </View>
    {sourceMode==='LIVE' ? <View style={styles.targetTabs}>
      {[['READY','READY'],['LOW','LOW BS'],['ALL','ALL STATES']].map(([key,label]) => <Pressable key={key} onPress={()=>setTab(key)} style={[styles.targetTab,tab===key&&styles.targetTabOn]}><Text style={[styles.targetTabText,tab===key&&styles.targetTabTextOn]}>{label}</Text></Pressable>)}
    </View> : <View style={styles.targetAfkNotice}><Text style={styles.targetAfkNoticeText}>◆ STATIC LIST • ◎ VERIFY ONE TARGET • ⚔ OPEN ATTACK</Text></View>}
    <View style={styles.targetColumns}><Text style={styles.targetColumnsText}>PLAYER                 LV       BS             STATE</Text></View>
    {shown.length ? <>{shownGroups.map(group => <View key={'level-'+group.level}><View style={styles.targetLevelDivider}><View style={styles.targetLevelAccent}/><Text style={styles.targetLevelDividerText}>LEVEL {group.level}</Text><Text style={styles.targetLevelDividerCount}>{Number(levelCounts[group.level]||group.targets.length)} TARGETS</Text></View>{group.targets.map(t => <TargetRow key={t.id} target={t} demo={demo} clock={clock} onVerify={verifyOne} rank={pageStart+shown.indexOf(t)+1}/>)}</View>)}</> : <View style={styles.targetEmpty}><Text style={styles.targetEmptyTitle}>{emptyTitle}</Text><Text style={styles.targetEmptyText}>{emptyText}</Text></View>}
    {pageCount>1 ? <View style={styles.targetPageNav}>
      <Pressable onPress={()=>changePage(-1)} disabled={safePage<=0} style={[styles.targetPageButton,safePage<=0&&styles.targetPageButtonOff]}><Text style={styles.targetPageButtonText}>‹ PREV</Text></Pressable>
      <Text style={styles.targetPageText}>{pageStart+1}-{Math.min(pageStart+TARGET_PAGE_SIZE,filteredTargets.length)} / {filteredTargets.length}</Text>
      <Pressable onPress={()=>changePage(1)} disabled={safePage>=pageCount-1} style={[styles.targetPageButton,safePage>=pageCount-1&&styles.targetPageButtonOff]}><Text style={styles.targetPageButtonText}>NEXT ›</Text></Pressable>
    </View> : null}
    <Text style={styles.targetDemoNote}>{demo ? 'DEMO DATA • layout preview only' : (message || (sourceMode==='AFK'?'TRIP CLASSIC • LEGACY AFK SOURCE • VERIFY OPTIONAL':'BALDR LIST INTEL • LIVE TORN STATUS'))}</Text>
  </View>;
}

/* TORNPULSE_LIVE_TARGETS_END */
`;

// Replace the previous Target Assistant implementation when this file is used as an upgrade,
// or inject it on a clean build.
const existingComponentStart = app.indexOf('const TARGET_DEMO = [');
const appComponentMarker = 'export default function App() {';
const appComponentAt = app.indexOf(appComponentMarker);
if (appComponentAt < 0) throw new Error('TornPulse Target Assistant: App component marker not found');
if (existingComponentStart >= 0 && existingComponentStart < appComponentAt) {
  app = app.slice(0,existingComponentStart) + targetComponents + '\n' + app.slice(appComponentAt);
} else if (!app.includes('TORNPULSE_LIVE_TARGETS_START')) {
  app = app.slice(0,appComponentAt) + targetComponents + '\n' + app.slice(appComponentAt);
}

// Minimal TornPulse boot screen: oversized logo with a heartbeat-style pulse.
const bootStart = app.indexOf('if (loading) return <SafeAreaView');
const bootEndMarker = '\n\n  if (!snapshot) return';
const bootEnd = bootStart >= 0 ? app.indexOf(bootEndMarker, bootStart) : -1;
if (bootStart >= 0 && bootEnd >= 0) {
  app = app.slice(0,bootStart) + 'if (loading) return <PulseBootLogo/>;' + app.slice(bootEnd);
} else if (!app.includes('if (loading) return <PulseBootLogo/>;')) {
  throw new Error('TornPulse Target Assistant: loading screen marker not found');
}

// Targets now lives on its own first-class app page instead of inside the dashboard.
if (!app.includes("const [activePage,setActivePage] = useState('DASHBOARD');")) {
  app = replaceOnce(
    app,
    'const [clock, setClock] = useState(Date.now());',
    "const [clock, setClock] = useState(Date.now());\n  const [activePage,setActivePage] = useState('DASHBOARD');",
    'Targets page state'
  );
}

// Remove an older inline dashboard Target Assistant if this patch is ever run on an upgraded source.
app = app.replace('<View style={styles.sectionHead}><Text style={styles.sectionTitle}>TARGETS</Text><View style={styles.sectionLine}/></View>\n    <TargetAssistant demo={Boolean(snapshot.demo)} clock={clock}/>\n    ', '');
app = app.replace('<TargetAssistant demo={Boolean(snapshot.demo)}/>', '');

const connectedReturn = 'return <SafeAreaView style={styles.screen}><StatusBar style="light"/><ScrollView contentContainerStyle={styles.content}>';
if (!app.includes('TORNPULSE_TARGETS_PAGE_RETURN')) {
  const targetPageReturn = `/* TORNPULSE_TARGETS_PAGE_RETURN */
  if (activePage === 'TARGETS') return <SafeAreaView style={styles.screen}><StatusBar style="light"/><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <View style={styles.headerRail}/>
      <View style={styles.headerMain}><View><Text style={styles.wordmark}>TORN<Text style={{color:C.red}}>PULSE</Text></Text><Text style={styles.headerSub}>TARGET INTELLIGENCE</Text></View><Pressable onPress={()=>setActivePage('DASHBOARD')} style={styles.refresh}><Text style={styles.refreshText}>‹</Text></Pressable></View>
      <View style={styles.headerMeta}><StatusTag tone={snapshot.demo?'warn':'live'}>{snapshot.demo?'DEMO':'TARGETS'}</StatusTag><Text style={styles.versionInline}>v1.0.0</Text></View>
    </View>
    <TornPulsePageTabs active="TARGETS" onChange={setActivePage}/>
    <View style={styles.targetPageIntro}><Text style={styles.targetPageKicker}>TORNPULSE • TARGET INTELLIGENCE</Text><Text style={styles.targetPageTitle}>TARGET RADAR</Text><Text style={styles.targetPageCopy}>Use ALL for the full radar or jump straight to Level 15, 16, 17 and up. Live Baldr gives current status; Trip Classic stays available as a permanent legacy AFK list with optional one-target verification.</Text></View>
    <TargetAssistant demo={Boolean(snapshot.demo)} clock={clock}/>
  </ScrollView></SafeAreaView>;

  `;
  app = replaceOnce(app, connectedReturn, targetPageReturn + connectedReturn, 'Targets standalone page');
}

const dashboardHeaderEnd = `<View style={styles.headerMeta}><StatusTag tone={snapshot.demo?'warn':staleData?'warn':'live'}>{snapshot.demo?'DEMO':staleData?'STALE':'LIVE DATA'}</StatusTag><Text style={styles.versionInline}>v1.0.0</Text></View>\n    </View>`;
if (!app.includes('<TornPulsePageTabs active="DASHBOARD" onChange={setActivePage}/>')) {
  app = replaceOnce(
    app,
    dashboardHeaderEnd,
    dashboardHeaderEnd + '\n    <TornPulsePageTabs active="DASHBOARD" onChange={setActivePage}/>',
    'Dashboard page tabs'
  );
}

const targetStyles = `
  pulseBootScreen:{flex:1,backgroundColor:'#030405',alignItems:'center',justifyContent:'center',paddingHorizontal:28},pulseBootStage:{width:190,height:190,alignItems:'center',justifyContent:'center'},pulseBootGlow:{position:'absolute',width:150,height:150,borderRadius:42,backgroundColor:'rgba(200,58,62,.20)',borderWidth:1,borderColor:'rgba(200,58,62,.34)'},pulseBootLogo:{width:126,height:126,borderRadius:25,backgroundColor:'#0A0B0D',borderWidth:2,borderColor:'#31353A',alignItems:'center',justifyContent:'center',flexDirection:'row',overflow:'hidden',elevation:9},pulseBootSlash:{position:'absolute',width:13,height:160,backgroundColor:C.red,transform:[{rotate:'24deg'}],opacity:.92},pulseBootT:{color:'#F4F5F6',fontSize:58,fontWeight:'900',letterSpacing:-5,marginRight:-1,textShadowColor:'rgba(255,255,255,.20)',textShadowRadius:4},pulseBootP:{color:C.red,fontSize:58,fontWeight:'900',letterSpacing:-5,marginLeft:-1,textShadowColor:'rgba(200,58,62,.45)',textShadowRadius:6},pulseBootWord:{color:'#F4F5F6',fontSize:22,fontWeight:'900',letterSpacing:3.3,marginTop:18},pulseBootWordAccent:{color:C.red},pulseBootLineTrack:{width:152,height:2,backgroundColor:'#202327',overflow:'hidden',marginTop:15},pulseBootLine:{width:'100%',height:2,backgroundColor:C.red},pulseBootSub:{color:'#757D87',fontSize:8,fontWeight:'900',letterSpacing:2.1,marginTop:11},
  pageTabs:{flexDirection:'row',gap:7,marginBottom:14},pageTab:{flex:1,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface,borderRadius:10,paddingVertical:10,alignItems:'center'},pageTabOn:{borderColor:C.red,backgroundColor:C.redDark,elevation:4},pageTabText:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1.05},pageTabTextOn:{color:'#FFF',textShadowColor:'rgba(213,47,50,.55)',textShadowRadius:4},
  targetPageIntro:{marginBottom:12,paddingHorizontal:3,paddingTop:1},targetPageKicker:{color:C.red,fontSize:8,fontWeight:'900',letterSpacing:1.6},targetPageTitle:{color:C.text,fontSize:22,fontWeight:'900',letterSpacing:.7,marginTop:3,textShadowColor:'rgba(255,255,255,.12)',textShadowRadius:3},targetPageCopy:{color:C.muted,fontSize:11,lineHeight:17,marginTop:5},
  targetPanel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,borderRadius:12,overflow:'hidden',elevation:2},
  targetSourceBar:{flexDirection:'row',gap:6,padding:7,backgroundColor:'#090B0E',borderBottomWidth:1,borderColor:C.line},targetSourceChip:{flex:1,minHeight:36,borderWidth:1,borderColor:C.line2,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:C.surface2},targetSourceChipLive:{borderColor:C.green,backgroundColor:'#09170F',elevation:3},targetSourceChipAfk:{borderColor:'#9A7CFF',backgroundColor:'#151126',elevation:3},targetSourceText:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:.8},targetSourceTextOn:{color:C.text},
  targetHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingHorizontal:11,paddingTop:10,paddingBottom:8},targetEyebrow:{color:C.text,fontSize:12,fontWeight:'900',letterSpacing:1.25},targetCount:{color:C.green,fontSize:9,fontWeight:'900',marginTop:3},targetCountAfk:{color:'#B6A5FF'},targetCountMuted:{color:C.muted},targetRefresh:{width:36,height:36,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.green,borderRadius:8,backgroundColor:'#09170F',elevation:2},targetRefreshOff:{opacity:.45},targetRefreshText:{color:C.green,fontSize:19,fontWeight:'900'},targetStaticBadge:{width:42,height:34,borderWidth:1,borderColor:'#9A7CFF',borderRadius:8,backgroundColor:'#151126',alignItems:'center',justifyContent:'center'},targetStaticBadgeText:{color:'#C9BCFF',fontSize:9,fontWeight:'900',letterSpacing:1},
  targetListBar:{minHeight:40,flexDirection:'row',alignItems:'center',borderTopWidth:1,borderColor:C.line,backgroundColor:C.bg},targetListArrow:{width:40,height:40,alignItems:'center',justifyContent:'center'},targetListArrowText:{color:C.text,fontSize:24,fontWeight:'900'},targetListNameWrap:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center'},targetListName:{color:'#72C7FF',fontSize:10,fontWeight:'900',letterSpacing:1,textShadowColor:'rgba(78,175,255,0.35)',textShadowRadius:3},targetListMeta:{color:C.muted,fontSize:8,fontWeight:'800',marginTop:1},
  targetAfkSource:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:11,borderTopWidth:1,borderColor:C.line,backgroundColor:'#10101A'},targetAfkSourceTitle:{color:'#C9BCFF',fontSize:10,fontWeight:'900',letterSpacing:1},targetAfkSourceMeta:{color:C.muted,fontSize:8,fontWeight:'800',marginTop:2},targetAfkSourceArrow:{color:'#9A7CFF',fontSize:17,fontWeight:'900'},
  targetLevelWrap:{borderTopWidth:1,borderColor:C.line,backgroundColor:C.surface2,paddingTop:8,paddingBottom:9},targetLevelLabel:{color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:1.5,paddingHorizontal:9,marginBottom:7},targetLevelScroll:{paddingHorizontal:8,gap:6,paddingBottom:1},targetLevelChip:{minWidth:44,height:38,borderWidth:1,borderColor:C.line2,borderRadius:9,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',paddingHorizontal:8},targetLevelChipAll:{minWidth:52},targetLevelChipEmpty:{opacity:.38},targetLevelChipOn:{borderColor:C.red,backgroundColor:C.redDark,elevation:5},targetLevelChipText:{color:C.muted,fontSize:10,fontWeight:'900',lineHeight:12},targetLevelChipTextOn:{color:'#FFF',fontSize:11,textShadowColor:'rgba(213,47,50,.7)',textShadowRadius:4},targetLevelChipCount:{color:'#666F7B',fontSize:7,fontWeight:'900',marginTop:1},targetLevelChipCountOn:{color:'#F5B4B6'},
  targetTabs:{flexDirection:'row',borderTopWidth:1,borderBottomWidth:1,borderColor:C.line},targetTab:{flex:1,paddingVertical:8,alignItems:'center',backgroundColor:C.surface2},targetTabOn:{backgroundColor:'#10151C'},targetTabText:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:.65},targetTabTextOn:{color:'#72C7FF'},targetAfkNotice:{paddingVertical:7,paddingHorizontal:9,borderTopWidth:1,borderBottomWidth:1,borderColor:'#2A2442',backgroundColor:'#110E1B'},targetAfkNoticeText:{color:'#A99AE8',fontSize:8,fontWeight:'900',letterSpacing:.45,textAlign:'center'},
  targetColumns:{paddingHorizontal:9,paddingVertical:5,backgroundColor:C.bg},targetColumnsText:{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:.25},targetLevelDivider:{height:32,flexDirection:'row',alignItems:'center',paddingRight:9,borderTopWidth:1,borderBottomWidth:1,borderColor:C.line,backgroundColor:'#0C1016'},targetLevelAccent:{width:4,alignSelf:'stretch',backgroundColor:C.red,marginRight:9},targetLevelDividerText:{flex:1,color:'#F4F6F8',fontSize:11,fontWeight:'900',letterSpacing:1.2},targetLevelDividerCount:{color:'#72C7FF',fontSize:8,fontWeight:'900',letterSpacing:.7},
  targetRow:{minHeight:50,flexDirection:'row',borderBottomWidth:1,borderColor:C.line,backgroundColor:C.surface},targetRowAfk:{backgroundColor:'#111118'},targetRail:{width:3,alignSelf:'stretch',opacity:.9},targetBody:{flex:1,paddingLeft:7,paddingTop:4,paddingBottom:4,paddingRight:4},targetLine1:{height:21,flexDirection:'row',alignItems:'center'},targetRank:{width:23,color:'#606A76',fontSize:7,fontWeight:'900',letterSpacing:.3},targetStatus:{width:14,fontSize:10,fontWeight:'900'},targetName:{flex:1,color:'#72C7FF',fontSize:11,fontWeight:'900',textShadowColor:'rgba(64,169,255,0.55)',textShadowRadius:5},targetNameAfk:{color:'#C0AFFF',textShadowColor:'rgba(154,124,255,0.58)',textShadowRadius:5},targetLv:{width:30,color:C.red,fontSize:9,fontWeight:'900',textAlign:'right'},targetTotal:{width:68,color:C.text,fontSize:9,fontWeight:'900',textAlign:'right'},targetState:{width:51,fontSize:9,fontWeight:'900',textAlign:'right'},targetStateReady:{color:C.green},targetStateAfk:{color:'#B6A5FF'},
  targetLine2:{height:17,flexDirection:'row',alignItems:'center',paddingLeft:23},targetStat:{flex:1,color:C.muted,fontSize:8,fontWeight:'800'},targetStaticMeta:{color:'#7F7898',fontSize:8,fontWeight:'900',letterSpacing:.2,flex:1},targetStaticMetaLive:{color:'#9AB9A7'},targetVerify:{width:34,alignItems:'center',justifyContent:'center',borderLeftWidth:1,borderColor:'#30284A',backgroundColor:'#14101F'},targetVerifyBusy:{opacity:.55},targetVerifyText:{color:'#BBAAFF',fontSize:16,fontWeight:'900'},targetAttack:{width:40,alignItems:'center',justifyContent:'center',borderLeftWidth:1,borderColor:C.line,backgroundColor:C.surface2},targetAttackAfk:{backgroundColor:'#171226',borderLeftColor:'#30284A'},targetAttackOff:{opacity:.24},targetAttackText:{fontSize:17},
  targetExpanded:{marginLeft:14,marginTop:3,paddingTop:4,paddingBottom:2,borderTopWidth:1,borderColor:C.line},targetExpandedText:{color:C.muted,fontSize:8,fontWeight:'700'},targetEmpty:{padding:16,alignItems:'center'},targetEmptyTitle:{color:C.text,fontSize:10,fontWeight:'900',letterSpacing:.7},targetEmptyText:{color:C.muted,fontSize:9,lineHeight:14,textAlign:'center',marginTop:5},
  targetPageNav:{minHeight:36,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:6,borderTopWidth:1,borderColor:C.line,backgroundColor:C.bg},targetPageButton:{minWidth:64,paddingVertical:8,paddingHorizontal:6,alignItems:'center'},targetPageButtonOff:{opacity:.25},targetPageButtonText:{color:'#72C7FF',fontSize:8,fontWeight:'900',letterSpacing:.6},targetPageText:{color:C.muted,fontSize:8,fontWeight:'800'},
  targetDemoNote:{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:.55,textAlign:'center',paddingVertical:6,paddingHorizontal:8,borderTopWidth:1,borderColor:C.line}
`

if (!app.includes('targetListBar:{')) {
  const end = app.lastIndexOf('\n});');
  if (end < 0) throw new Error('TornPulse Target Assistant: styles end marker not found');
  app = app.slice(0,end) + ',' + targetStyles + app.slice(end);
}

setEmbedded('APP_JS',app);
fs.writeFileSync(FILE,src,'utf8');
console.log('\nTornPulse live Baldr-style Target Assistant applied successfully.');

})();
