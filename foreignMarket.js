const YATA_EXPORT_URL = 'https://yata.yt/api/v1/travel/export/';

export const FOREIGN_COUNTRIES = {
  mex: { name: 'Mexico', city: 'Ciudad Juarez', flag: '🇲🇽', standardMinutes: 24 },
  cay: { name: 'Cayman Islands', city: 'George Town', flag: '🇰🇾', standardMinutes: 33 },
  can: { name: 'Canada', city: 'Toronto', flag: '🇨🇦', standardMinutes: 39 },
  haw: { name: 'Hawaii', city: 'Honolulu', flag: '🇺🇸', standardMinutes: 127 },
  uni: { name: 'United Kingdom', city: 'London', flag: '🇬🇧', standardMinutes: 151 },
  arg: { name: 'Argentina', city: 'Buenos Aires', flag: '🇦🇷', standardMinutes: 158 },
  swi: { name: 'Switzerland', city: 'Zurich', flag: '🇨🇭', standardMinutes: 166 },
  jap: { name: 'Japan', city: 'Tokyo', flag: '🇯🇵', standardMinutes: 213 },
  chi: { name: 'China', city: 'Beijing', flag: '🇨🇳', standardMinutes: 229 },
  uae: { name: 'United Arab Emirates', city: 'Dubai', flag: '🇦🇪', standardMinutes: 257 },
  sou: { name: 'South Africa', city: 'Johannesburg', flag: '🇿🇦', standardMinutes: 282 },
};

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeForeignStock(payload) {
  const result = [];
  const root = payload?.stocks;
  if (!root || typeof root !== 'object') return result;

  for (const [code, countryPayload] of Object.entries(root)) {
    const meta = FOREIGN_COUNTRIES[code] || {
      name: String(code || '').toUpperCase(),
      city: '',
      flag: '🌐',
      standardMinutes: null,
    };
    const updated = number(countryPayload?.update, 0);
    const stocks = Array.isArray(countryPayload?.stocks) ? countryPayload.stocks : [];

    for (const item of stocks) {
      const id = number(item?.id, NaN);
      if (!Number.isFinite(id)) continue;
      result.push({
        countryCode: code,
        country: meta.name,
        city: meta.city,
        flag: meta.flag,
        standardMinutes: meta.standardMinutes,
        id,
        name: String(item?.name || `Item #${id}`),
        quantity: Math.max(0, Math.trunc(number(item?.quantity, 0))),
        cost: Math.max(0, number(item?.cost, 0)),
        updated,
      });
    }
  }

  return result;
}

export async function fetchForeignStock() {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
  try {
    const response = await fetch(YATA_EXPORT_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!response.ok) throw new Error(`Foreign stock feed returned ${response.status}.`);
    const payload = await response.json();
    const rows = normalizeForeignStock(payload);
    if (!rows.length) throw new Error('Foreign stock feed returned no usable stock rows.');
    return { rows, fetchedAt: Date.now() };
  } catch (error) {
    if (String(error?.name) === 'AbortError') throw new Error('Foreign stock feed timed out.');
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function groupForeignStock(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!map.has(row.countryCode)) {
      map.set(row.countryCode, {
        countryCode: row.countryCode,
        country: row.country,
        city: row.city,
        flag: row.flag,
        standardMinutes: row.standardMinutes,
        updated: row.updated,
        items: [],
      });
    }
    const group = map.get(row.countryCode);
    group.updated = Math.max(group.updated || 0, row.updated || 0);
    group.items.push(row);
  }

  return Array.from(map.values())
    .map(group => ({
      ...group,
      inStockItems: group.items.filter(item => item.quantity > 0).length,
      totalUnits: group.items.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0),
      items: group.items.slice().sort((a, b) => {
        if ((a.quantity > 0) !== (b.quantity > 0)) return a.quantity > 0 ? -1 : 1;
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return a.name.localeCompare(b.name);
      }),
    }))
    .sort((a, b) => {
      if ((b.inStockItems || 0) !== (a.inStockItems || 0)) return (b.inStockItems || 0) - (a.inStockItems || 0);
      return a.country.localeCompare(b.country);
    });
}

export function freshnessState(updatedSeconds, nowMs = Date.now()) {
  if (!updatedSeconds) return { label: 'NO DATA', level: 'stale', ageSeconds: Infinity };
  const ageSeconds = Math.max(0, Math.floor(nowMs / 1000) - Number(updatedSeconds));
  if (ageSeconds <= 60) return { label: 'LIVE', level: 'fresh', ageSeconds };
  if (ageSeconds <= 300) return { label: 'RECENT', level: 'recent', ageSeconds };
  return { label: 'STALE', level: 'stale', ageSeconds };
}

export function nextQuarterHour(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const utcMinutes = d.getUTCMinutes();
  const nextMinutes = Math.floor(utcMinutes / 15) * 15 + 15;
  const next = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    nextMinutes,
    0,
    0,
  );
  return next;
}

export function formatMoney(value) {
  return '$' + Math.max(0, Number(value || 0)).toLocaleString();
}
