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

// Linking only hands a selected player to Torn. TornPulse never automates the attack itself.
app = replaceOnce(
  app,
  'NativeModules, Platform, Pressable,',
  'Linking, NativeModules, Platform, Pressable,',
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
  if (status === 'hospital') return '✚';
  if (status === 'jail') return '▣';
  if (status === 'travel') return '✈';
  if (status === 'checking') return '◌';
  if (status === 'error') return '!';
  return '•';
}

function targetStatusColor(status) {
  if (status === 'okay') return C.green;
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

function TargetRow({target, demo, clock}) {
  const [expanded,setExpanded] = useState(false);
  const attackable = target.status === 'okay';
  const attack = async () => {
    if (demo) return Alert.alert('Target Assistant demo','Live mode opens this player directly on Torn’s attack screen.');
    if (!attackable) return Alert.alert('Target unavailable','Refresh the target scan and choose a player marked READY.');
    const url = 'https://www.torn.com/loader.php?sid=attack&user2ID=' + encodeURIComponent(target.id);
    try { await Linking.openURL(url); } catch (_) { Alert.alert('Could not open Torn','Open this target from TornPulse again.'); }
  };
  const statusText = targetStatusText(target,clock);
  return <View style={styles.targetRow}>
    <Pressable onPress={() => setExpanded(v=>!v)} style={styles.targetBody}>
      <View style={styles.targetLine1}>
        <Text style={[styles.targetStatus,{color:targetStatusColor(target.status)}]}>{targetStatusGlyph(target.status)}</Text>
        <Text numberOfLines={1} style={styles.targetName}>{target.name}</Text>
        <Text style={styles.targetLv}>L{target.level || '?'}</Text>
        <Text style={styles.targetTotal}>T {compactStat(target.total)}</Text>
        <Text style={[styles.targetState,attackable&&styles.targetStateReady]}>{statusText}</Text>
      </View>
      <View style={styles.targetLine2}>
        <Text style={styles.targetStat}>S {compactStat(target.strength)}</Text>
        <Text style={styles.targetStat}>D {compactStat(target.defense)}</Text>
        <Text style={styles.targetStat}>Sp {compactStat(target.speed)}</Text>
        <Text style={styles.targetStat}>Dx {compactStat(target.dexterity)}</Text>
      </View>
      {expanded ? <View style={styles.targetExpanded}>
        <Text style={styles.targetExpandedText}>ID {target.id}  •  BALDR LIST INTEL  •  {target.statusDescription || statusText}</Text>
      </View> : null}
    </Pressable>
    <Pressable onPress={attack} disabled={!demo && !attackable} style={[styles.targetAttack,!demo&&!attackable&&styles.targetAttackOff]} accessibilityLabel={'Attack ' + target.name}>
      <Text style={styles.targetAttackText}>⚔</Text>
    </Pressable>
  </View>;
}

function TargetAssistant({demo=false, clock=Date.now()}) {
  const [tab,setTab] = useState('READY');
  const [lists,setLists] = useState(demo ? {'Demo Targets':TARGET_DEMO} : {});
  const [listName,setListName] = useState(demo ? 'Demo Targets' : '');
  const [page,setPage] = useState(0);
  const [statusById,setStatusById] = useState({});
  const [loadingLists,setLoadingLists] = useState(!demo);
  const [scanning,setScanning] = useState(false);
  const [message,setMessage] = useState('');
  const [scanVersion,setScanVersion] = useState(0);
  const scanLogRef = useRef([]);
  const autoScanRef = useRef(false);

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
        setPage(0);
        setMessage('Targets loaded • checking availability');
      } catch (e) {
        if (live) setMessage(e && e.message ? e.message : 'Could not load the target list.');
      } finally { if (live) setLoadingLists(false); }
    })();
    return () => { live = false; };
  }, [demo]);

  const listNames = Object.keys(lists);
  const baseTargets = (lists[listName] || []).map(t => ({...t,...(statusById[t.id] || {status:'unknown',until:0,statusDescription:''})}));
  const pageCount = Math.max(1,Math.ceil(baseTargets.length/TARGET_PAGE_SIZE));
  const safePage = Math.min(page,pageCount-1);
  const pageStart = safePage*TARGET_PAGE_SIZE;
  const pageTargets = baseTargets.slice(pageStart,pageStart+TARGET_PAGE_SIZE);
  const nowMs = Number(clock || Date.now());
  const recentCalls = scanLogRef.current.filter(ts => nowMs-ts < TARGET_API_WINDOW_MS);
  scanLogRef.current = recentCalls;
  const apiBudget = Math.max(0,TARGET_API_BUDGET-recentCalls.length);
  const readyOnPage = pageTargets.filter(t => t.status === 'okay').length;
  const checkedOnPage = pageTargets.filter(t => t.status && t.status !== 'unknown' && t.status !== 'checking').length;

  let shown = [...pageTargets];
  if (tab === 'READY') shown = shown.filter(t => t.status === 'okay');
  if (tab === 'LOW') shown.sort((a,b) => (a.status==='okay'?0:1)-(b.status==='okay'?0:1) || a.total-b.total || b.level-a.level);
  if (tab === 'LEVEL') shown.sort((a,b) => b.level-a.level || a.total-b.total);

  async function scanPage(auto=false) {
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

  useEffect(() => {
    if (demo || !listName || autoScanRef.current) return;
    autoScanRef.current = true;
    const id = setTimeout(() => scanPage(true).catch(()=>{}),350);
    return () => clearTimeout(id);
  }, [demo,listName]);

  function changeList(delta) {
    if (!listNames.length) return;
    const current = Math.max(0,listNames.indexOf(listName));
    const nextIndex = (current+delta+listNames.length)%listNames.length;
    setListName(listNames[nextIndex]);
    setPage(0);
    setTab('READY');
    autoScanRef.current = false;
    setMessage('List changed • refresh to check status');
  }

  function changePage(delta) {
    const nextPage = Math.max(0,Math.min(pageCount-1,safePage+delta));
    if (nextPage === safePage) return;
    setPage(nextPage);
    setTab('READY');
    setMessage('Page ' + (nextPage+1) + ' • refresh to check status');
  }

  const emptyTitle = loadingLists ? 'LOADING TARGET INTEL…' : scanning ? 'SCANNING…' : tab==='READY' && checkedOnPage===0 ? 'CHECKING AVAILABILITY…' : tab==='READY' ? 'NO READY TARGETS ON THIS PAGE' : 'NO TARGETS';
  const emptyText = loadingLists ? 'Pulling the current Baldr target lists.' : tab==='READY' ? 'Tap refresh to re-check this page, or switch to LOW BS / LEVEL / ALL.' : 'Choose another list or page.';

  return <View style={styles.targetPanel}>
    <View style={styles.targetHead}>
      <View style={{flex:1,minWidth:0}}><Text style={styles.targetEyebrow}>TARGET ASSISTANT</Text><Text style={styles.targetCount}>{readyOnPage} READY <Text style={styles.targetCountMuted}>• {checkedOnPage}/{pageTargets.length} CHECKED • API {apiBudget}/{TARGET_API_BUDGET}</Text></Text></View>
      <Pressable onPress={()=>scanPage(false).catch(()=>{})} disabled={scanning||loadingLists||!pageTargets.length} style={[styles.targetRefresh,(scanning||loadingLists)&&styles.targetRefreshOff]}><Text style={styles.targetRefreshText}>{scanning?'…':'↻'}</Text></Pressable>
    </View>
    <View style={styles.targetListBar}>
      <Pressable onPress={()=>changeList(-1)} style={styles.targetListArrow}><Text style={styles.targetListArrowText}>‹</Text></Pressable>
      <View style={styles.targetListNameWrap}><Text numberOfLines={1} style={styles.targetListName}>{targetListShortName(listName)}</Text><Text style={styles.targetListMeta}>{baseTargets.length} TARGETS • PAGE {safePage+1}/{pageCount}</Text></View>
      <Pressable onPress={()=>changeList(1)} style={styles.targetListArrow}><Text style={styles.targetListArrowText}>›</Text></Pressable>
    </View>
    <View style={styles.targetTabs}>
      {[['READY','READY'],['LOW','LOW BS'],['LEVEL','LEVEL'],['ALL','ALL']].map(([key,label]) => <Pressable key={key} onPress={()=>setTab(key)} style={[styles.targetTab,tab===key&&styles.targetTabOn]}><Text style={[styles.targetTabText,tab===key&&styles.targetTabTextOn]}>{label}</Text></Pressable>)}
    </View>
    <View style={styles.targetColumns}><Text style={styles.targetColumnsText}>TARGET                 LV     TOTAL          STATUS</Text></View>
    {shown.length ? shown.map(t => <TargetRow key={t.id} target={t} demo={demo} clock={clock}/>) : <View style={styles.targetEmpty}><Text style={styles.targetEmptyTitle}>{emptyTitle}</Text><Text style={styles.targetEmptyText}>{emptyText}</Text></View>}
    {pageCount>1 ? <View style={styles.targetPageNav}>
      <Pressable onPress={()=>changePage(-1)} disabled={safePage<=0} style={[styles.targetPageButton,safePage<=0&&styles.targetPageButtonOff]}><Text style={styles.targetPageButtonText}>‹ PREV</Text></Pressable>
      <Text style={styles.targetPageText}>{pageStart+1}-{Math.min(pageStart+TARGET_PAGE_SIZE,baseTargets.length)} / {baseTargets.length}</Text>
      <Pressable onPress={()=>changePage(1)} disabled={safePage>=pageCount-1} style={[styles.targetPageButton,safePage>=pageCount-1&&styles.targetPageButtonOff]}><Text style={styles.targetPageButtonText}>NEXT ›</Text></Pressable>
    </View> : null}
    <Text style={styles.targetDemoNote}>{demo ? 'DEMO DATA • layout preview only' : (message || 'BALDR LIST INTEL • LIVE TORN STATUS')}</Text>
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

const sectionMarker = '<Text style={styles.section}>NEXT MOVE</Text>';
if (app.includes('<TargetAssistant demo={Boolean(snapshot.demo)}/>')) {
  app = app.replace('<TargetAssistant demo={Boolean(snapshot.demo)}/>', '<TargetAssistant demo={Boolean(snapshot.demo)} clock={clock}/>');
} else if (!app.includes('<TargetAssistant demo={Boolean(snapshot.demo)} clock={clock}/>')) {
  app = replaceOnce(
    app,
    sectionMarker,
    '<Text style={styles.section}>TARGETS</Text><TargetAssistant demo={Boolean(snapshot.demo)} clock={clock}/>\n    ' + sectionMarker,
    'Target Assistant dashboard placement'
  );
}

const targetStyles = `
  targetPanel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line,borderRadius:6,overflow:'hidden'},
  targetHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingHorizontal:10,paddingTop:9,paddingBottom:7},targetEyebrow:{color:C.text,fontSize:11,fontWeight:'900',letterSpacing:1.2},targetCount:{color:C.green,fontSize:9,fontWeight:'900',marginTop:2},targetCountMuted:{color:C.muted},targetRefresh:{width:34,height:34,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.line2,borderRadius:4,backgroundColor:C.surface2},targetRefreshOff:{opacity:.45},targetRefreshText:{color:C.text,fontSize:18,fontWeight:'900'},
  targetListBar:{minHeight:38,flexDirection:'row',alignItems:'center',borderTopWidth:1,borderColor:C.line,backgroundColor:C.bg},targetListArrow:{width:38,height:38,alignItems:'center',justifyContent:'center'},targetListArrowText:{color:C.text,fontSize:24,fontWeight:'900'},targetListNameWrap:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center'},targetListName:{color:C.text,fontSize:10,fontWeight:'900',letterSpacing:1},targetListMeta:{color:C.muted,fontSize:8,fontWeight:'800',marginTop:1},
  targetTabs:{flexDirection:'row',borderTopWidth:1,borderBottomWidth:1,borderColor:C.line},targetTab:{flex:1,paddingVertical:7,alignItems:'center',backgroundColor:C.surface2},targetTabOn:{backgroundColor:C.bg},targetTabText:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:.65},targetTabTextOn:{color:C.text},
  targetColumns:{paddingHorizontal:9,paddingVertical:4,backgroundColor:C.bg},targetColumnsText:{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:.25},
  targetRow:{minHeight:48,flexDirection:'row',borderTopWidth:1,borderColor:C.line,backgroundColor:C.surface},targetBody:{flex:1,paddingLeft:8,paddingTop:4,paddingBottom:4,paddingRight:4},targetLine1:{height:20,flexDirection:'row',alignItems:'center'},targetStatus:{width:14,fontSize:10,fontWeight:'900'},targetName:{flex:1,color:C.text,fontSize:11,fontWeight:'900'},targetLv:{width:31,color:C.muted,fontSize:9,fontWeight:'800',textAlign:'right'},targetTotal:{width:66,color:C.text,fontSize:9,fontWeight:'900',textAlign:'right'},targetState:{width:51,color:C.amber,fontSize:9,fontWeight:'900',textAlign:'right'},targetStateReady:{color:C.green},
  targetLine2:{height:17,flexDirection:'row',alignItems:'center',paddingLeft:14},targetStat:{flex:1,color:C.muted,fontSize:8,fontWeight:'800'},targetAttack:{width:38,alignItems:'center',justifyContent:'center',borderLeftWidth:1,borderColor:C.line,backgroundColor:C.surface2},targetAttackOff:{opacity:.24},targetAttackText:{fontSize:17},
  targetExpanded:{marginLeft:14,marginTop:3,paddingTop:4,paddingBottom:2,borderTopWidth:1,borderColor:C.line},targetExpandedText:{color:C.muted,fontSize:8,fontWeight:'700'},targetEmpty:{padding:14,alignItems:'center'},targetEmptyTitle:{color:C.text,fontSize:10,fontWeight:'900',letterSpacing:.7},targetEmptyText:{color:C.muted,fontSize:9,lineHeight:14,textAlign:'center',marginTop:5},
  targetPageNav:{minHeight:36,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:6,borderTopWidth:1,borderColor:C.line,backgroundColor:C.bg},targetPageButton:{minWidth:64,paddingVertical:8,paddingHorizontal:6,alignItems:'center'},targetPageButtonOff:{opacity:.25},targetPageButtonText:{color:C.text,fontSize:8,fontWeight:'900',letterSpacing:.6},targetPageText:{color:C.muted,fontSize:8,fontWeight:'800'},
  targetDemoNote:{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:.55,textAlign:'center',paddingVertical:5,paddingHorizontal:8,borderTopWidth:1,borderColor:C.line}
`;

if (!app.includes('targetListBar:{')) {
  const end = app.lastIndexOf('\n});');
  if (end < 0) throw new Error('TornPulse Target Assistant: styles end marker not found');
  app = app.slice(0,end) + ',' + targetStyles + app.slice(end);
}

setEmbedded('APP_JS',app);
fs.writeFileSync(FILE,src,'utf8');
console.log('\nTornPulse live Baldr-style Target Assistant applied successfully.');

})();
