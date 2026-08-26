const BASE = 'https://api.torn.com/v2';
const TIMEOUT_MS = 12000;

async function getJson(path, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}?comment=ComfortableAI`, {
      headers: {Authorization: `ApiKey ${key}`, Accept: 'application/json'},
      signal: controller.signal,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.error) {
      const msg = json?.error?.error || json?.error?.message || `Torn API error (${response.status})`;
      throw new Error(msg);
    }
    return json;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Torn API timed out. Check your connection and try again.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function validateBars(payload) {
  const energy = payload?.bars?.energy;
  const nerve = payload?.bars?.nerve;
  if (!energy || !nerve) throw new Error('Unexpected Torn bars response.');
  for (const [name, bar] of [['energy', energy], ['nerve', nerve]]) {
    if (!Number.isFinite(bar.current) || !Number.isFinite(bar.maximum)) throw new Error(`Invalid ${name} data from Torn.`);
  }
  return {energy, nerve};
}

async function fetchSnapshot(key) {
  const [barsPayload, cooldownPayload] = await Promise.all([
    getJson('/user/bars', key),
    getJson('/user/cooldowns', key),
  ]);
  const {energy, nerve} = validateBars(barsPayload);
  const cooldowns = cooldownPayload?.cooldowns;
  if (!cooldowns || !['drug', 'medical', 'booster'].every(k => Number.isFinite(cooldowns[k]))) {
    throw new Error('Unexpected Torn cooldown response.');
  }
  return {energy, nerve, cooldowns, fetchedAt: Date.now(), demo: false};
}

module.exports = {fetchSnapshot};
