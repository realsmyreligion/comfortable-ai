function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function projectBar(bar, nowMs = Date.now()) {
  if (!bar) return null;
  const current = Number(bar.current || 0);
  const maximum = Number(bar.maximum || 0);
  const increment = Number(bar.increment || 0);
  const interval = Number(bar.interval || 0);
  const tickTimeMs = Number(bar.tick_time || 0) * 1000;
  const fullTimeMs = Number(bar.full_time || 0) * 1000;

  if (maximum <= 0) return {...bar, projected: current, percent: 0, capMs: null};
  if (current >= maximum) return {...bar, projected: maximum, percent: 100, capMs: nowMs};

  let projected = current;
  if (interval > 0 && increment > 0 && tickTimeMs > 0 && nowMs >= tickTimeMs) {
    const ticks = 1 + Math.floor((nowMs - tickTimeMs) / (interval * 1000));
    projected = clamp(current + ticks * increment, current, maximum);
  } else if (interval > 0 && increment > 0 && tickTimeMs <= 0 && fullTimeMs > nowMs) {
    const remainingTicks = Math.ceil((fullTimeMs - nowMs) / (interval * 1000));
    projected = clamp(maximum - remainingTicks * increment, current, maximum);
  }

  return {
    ...bar,
    projected,
    percent: clamp((projected / maximum) * 100, 0, 100),
    capMs: fullTimeMs > 0 ? fullTimeMs : null,
  };
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s === 0) return 'READY';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function timeUntil(ms, nowMs = Date.now()) {
  if (!ms) return 'UNKNOWN';
  return formatDuration(Math.max(0, Math.ceil((ms - nowMs) / 1000)));
}

function recommend(snapshot, nowMs = Date.now()) {
  const energy = projectBar(snapshot.energy, nowMs);
  const nerve = projectBar(snapshot.nerve, nowMs);
  const elapsed = Math.max(0, Math.floor((nowMs - Number(snapshot.fetchedAt || nowMs)) / 1000));
  const drug = Math.max(0, Number(snapshot.cooldowns?.drug || 0) - elapsed);

  if (nerve && nerve.percent >= 90) return {title: 'SPEND NERVE', detail: 'Your nerve is close to capping. Use it before natural regeneration is wasted.'};
  if (energy && energy.percent >= 90) return {title: 'SPEND ENERGY', detail: 'Your energy is close to capping. Train or use it before natural regeneration is wasted.'};
  if (drug === 0) return {title: 'DRUG READY', detail: 'Your drug cooldown is clear. Check whether using your planned drug fits your training strategy.'};
  if (energy && energy.percent >= 60) return {title: 'PLAN TRAINING', detail: 'You have a healthy energy bar. Consider your next gym session before it creeps toward cap.'};
  return {title: 'REGENERATING', detail: 'Nothing urgent right now. Let your bars regenerate and TornPulse will keep watch.'};
}

module.exports = {clamp, projectBar, formatDuration, timeUntil, recommend};
