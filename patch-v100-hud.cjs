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

setEmbedded('APP_JS', app);

setEmbedded('OVERLAY_SERVICE_KT', kt);
fs.writeFileSync(FILE, src, 'utf8');
console.log('\nTornPulse v1.0 final HUD polish applied successfully.');
