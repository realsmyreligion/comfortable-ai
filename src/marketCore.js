const COUNTRIES = {
  mex: { name: 'Mexico', city: 'Ciudad Juárez', flag: '🇲🇽', cost: 6500, times: { standard: 24, airstrip: 17, wlt: 12, business: 7 }, bookTimes: { standard: 18, airstrip: 13, wlt: 9, business: 5 } },
  cay: { name: 'Cayman Islands', city: 'George Town', flag: '🇰🇾', cost: 10000, times: { standard: 33, airstrip: 23, wlt: 17, business: 10 }, bookTimes: { standard: 25, airstrip: 17, wlt: 13, business: 8 } },
  can: { name: 'Canada', city: 'Toronto', flag: '🇨🇦', cost: 9000, times: { standard: 39, airstrip: 27, wlt: 19, business: 12 }, bookTimes: { standard: 29, airstrip: 20, wlt: 15, business: 9 } },
  haw: { name: 'Hawaii', city: 'Honolulu', flag: '🇺🇸', cost: 11000, times: { standard: 127, airstrip: 89, wlt: 63, business: 38 }, bookTimes: { standard: 95, airstrip: 67, wlt: 48, business: 29 } },
  uni: { name: 'United Kingdom', city: 'London', flag: '🇬🇧', cost: 18000, times: { standard: 151, airstrip: 106, wlt: 75, business: 45 }, bookTimes: { standard: 113, airstrip: 80, wlt: 57, business: 34 } },
  arg: { name: 'Argentina', city: 'Buenos Aires', flag: '🇦🇷', cost: 21000, times: { standard: 158, airstrip: 111, wlt: 79, business: 47 }, bookTimes: { standard: 119, airstrip: 83, wlt: 59, business: 35 } },
  swi: { name: 'Switzerland', city: 'Zurich', flag: '🇨🇭', cost: 27000, times: { standard: 166, airstrip: 116, wlt: 83, business: 50 }, bookTimes: { standard: 125, airstrip: 87, wlt: 62, business: 38 } },
  jap: { name: 'Japan', city: 'Tokyo', flag: '🇯🇵', cost: 32000, times: { standard: 213, airstrip: 149, wlt: 107, business: 64 }, bookTimes: { standard: 160, airstrip: 112, wlt: 80, business: 48 } },
  chi: { name: 'China', city: 'Beijing', flag: '🇨🇳', cost: 35000, times: { standard: 229, airstrip: 160, wlt: 115, business: 69 }, bookTimes: { standard: 172, airstrip: 120, wlt: 86, business: 52 } },
  uae: { name: 'United Arab Emirates', city: 'Dubai', flag: '🇦🇪', cost: 32000, times: { standard: 257, airstrip: 180, wlt: 129, business: 77 }, bookTimes: { standard: 193, airstrip: 135, wlt: 97, business: 58 } },
  sou: { name: 'South Africa', city: 'Johannesburg', flag: '🇿🇦', cost: 40000, times: { standard: 282, airstrip: 197, wlt: 141, business: 85 }, bookTimes: { standard: 212, airstrip: 148, wlt: 106, business: 64 } }
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeForeignStock(payload) {
  const rows = [];
  const root = payload && payload.stocks;
  if (!root || typeof root !== 'object') return rows;

  for (const [countryCode, countryPayload] of Object.entries(root)) {
    const meta = COUNTRIES[countryCode] || {
      name: String(countryCode).toUpperCase(), city: '', flag: '🌐', cost: 0,
      times: {standard: 0, airstrip: 0, wlt: 0, business: 0},
      bookTimes: {standard: 0, airstrip: 0, wlt: 0, business: 0}
    };
    const updated = toNumber(countryPayload && countryPayload.update, 0);
    const stocks = Array.isArray(countryPayload && countryPayload.stocks) ? countryPayload.stocks : [];

    for (const item of stocks) {
      const id = toNumber(item && item.id, NaN);
      if (!Number.isFinite(id)) continue;
      rows.push({
        countryCode,
        country: meta.name,
        city: meta.city,
        flag: meta.flag,
        travelCost: meta.cost,
        id,
        key: `${countryCode}:${id}`,
        name: String((item && item.name) || `Item #${id}`),
        quantity: Math.max(0, Math.trunc(toNumber(item && item.quantity, 0))),
        cost: Math.max(0, toNumber(item && item.cost, 0)),
        updated
      });
    }
  }
  return rows;
}

function groupForeignStock(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!map.has(row.countryCode)) {
      const meta = COUNTRIES[row.countryCode] || {};
      map.set(row.countryCode, {
        countryCode: row.countryCode,
        country: row.country,
        city: row.city,
        flag: row.flag,
        travelCost: meta.cost || row.travelCost || 0,
        updated: row.updated || 0,
        items: []
      });
    }
    const group = map.get(row.countryCode);
    group.updated = Math.max(group.updated || 0, row.updated || 0);
    group.items.push(row);
  }
  return Array.from(map.values()).map(group => ({
    ...group,
    inStockItems: group.items.filter(x => x.quantity > 0).length,
    totalUnits: group.items.reduce((sum, x) => sum + x.quantity, 0),
    items: group.items.slice().sort((a, b) => {
      if ((a.quantity > 0) !== (b.quantity > 0)) return a.quantity > 0 ? -1 : 1;
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      return a.name.localeCompare(b.name);
    })
  }));
}

function freshnessState(updatedSeconds, nowMs = Date.now()) {
  if (!updatedSeconds) return { label: 'NO DATA', level: 'stale', ageSeconds: Infinity };
  const ageSeconds = Math.max(0, Math.floor(nowMs / 1000) - Number(updatedSeconds));
  if (ageSeconds <= 60) return { label: 'LIVE', level: 'live', ageSeconds };
  if (ageSeconds <= 300) return { label: 'RECENT', level: 'recent', ageSeconds };
  return { label: 'STALE', level: 'stale', ageSeconds };
}

function ageLabel(seconds) {
  if (!Number.isFinite(seconds)) return 'unknown';
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function nextQuarterHour(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const minutes = d.getUTCMinutes();
  const nextMinutes = Math.floor(minutes / 15) * 15 + 15;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), nextMinutes, 0, 0);
}

function countdownLabel(targetMs, nowMs = Date.now()) {
  const s = Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function money(value) {
  const v = Math.round(toNumber(value, 0));
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString()}`;
}

function compactMoney(value) {
  const v = toNumber(value, 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}b`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}m`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}k`;
  return money(v);
}

function effectiveCapacity(baseCapacity, tourismMode) {
  const base = Math.max(1, Math.trunc(toNumber(baseCapacity, 10)));
  return tourismMode ? base * 2 : base;
}

function flightMinutes(countryCode, flightMode = 'standard', mailingBook = false) {
  const meta = COUNTRIES[countryCode];
  if (!meta) return 0;
  const table = mailingBook ? meta.bookTimes : meta.times;
  return toNumber(table[flightMode], table.standard || 0);
}

function mergeMarketPrice(row, priceMap) {
  const info = priceMap && priceMap[String(row.id)];
  const marketPrice = toNumber(info && info.marketPrice, 0);
  return {...row, marketPrice, marketName: (info && info.name) || row.name};
}

function computeCandidate(row, options = {}) {
  const capacity = Math.max(1, toNumber(options.capacity, 10));
  const flightMode = options.flightMode || 'standard';
  const mailingBook = Boolean(options.mailingBook);
  const velocity = Math.max(0, toNumber(options.velocity, 0));
  const marketPrice = Math.max(0, toNumber(row.marketPrice, 0));
  const minutes = flightMinutes(row.countryCode, flightMode, mailingBook);
  const currentUnits = Math.min(capacity, Math.max(0, row.quantity));
  const profitEach = marketPrice > 0 ? marketPrice - row.cost : 0;
  const projectedQuantity = velocity > 0 ? Math.max(0, Math.floor(row.quantity - velocity * minutes)) : null;
  const projectedUnits = projectedQuantity == null ? currentUnits : Math.min(capacity, projectedQuantity);
  const standardFare = flightMode === 'standard' ? (row.travelCost || 0) * 2 : 0;
  const loadProfit = marketPrice > 0 ? currentUnits * profitEach - standardFare : null;
  const projectedProfit = marketPrice > 0 ? projectedUnits * profitEach - standardFare : null;
  const roundTripMinutes = minutes * 2;
  const profitPerMinute = projectedProfit != null && roundTripMinutes > 0 ? projectedProfit / roundTripMinutes : null;

  let arrival = 'UNKNOWN';
  if (row.quantity <= 0) arrival = 'SOLD OUT';
  else if (projectedQuantity == null) arrival = 'NO TREND';
  else if (projectedQuantity >= capacity) arrival = 'LIKELY';
  else if (projectedQuantity > 0) arrival = 'AT RISK';
  else arrival = 'UNLIKELY';

  return {
    ...row,
    capacity,
    minutes,
    velocity,
    currentUnits,
    projectedQuantity,
    projectedUnits,
    profitEach,
    loadProfit,
    projectedProfit,
    profitPerMinute,
    arrival
  };
}

function updateVelocityState(previousRows, currentRows, velocityState = {}) {
  const previous = previousRows || {};
  const nextPrevious = {...previous};
  const nextVelocity = {...velocityState};
  const restocks = [];

  for (const row of currentRows || []) {
    const prev = previous[row.key];
    if (prev && row.updated > prev.updated) {
      const minutes = (row.updated - prev.updated) / 60;
      if (minutes > 0) {
        if (row.quantity < prev.quantity) {
          const observed = (prev.quantity - row.quantity) / minutes;
          const old = toNumber(nextVelocity[row.key] && nextVelocity[row.key].rate, 0);
          nextVelocity[row.key] = {
            rate: old > 0 ? old * 0.45 + observed * 0.55 : observed,
            measuredAt: row.updated,
            samples: (nextVelocity[row.key] && nextVelocity[row.key].samples || 0) + 1
          };
        } else if (row.quantity > prev.quantity) {
          restocks.push({key: row.key, item: row.name, country: row.country, quantity: row.quantity, at: row.updated});
          nextVelocity[row.key] = { rate: 0, measuredAt: row.updated, samples: 0, restockedAt: row.updated };
        }
      }
    }
    nextPrevious[row.key] = {quantity: row.quantity, updated: row.updated};
  }
  return {previousRows: nextPrevious, velocityState: nextVelocity, restocks};
}

module.exports = {
  COUNTRIES,
  normalizeForeignStock,
  groupForeignStock,
  freshnessState,
  ageLabel,
  nextQuarterHour,
  countdownLabel,
  money,
  compactMoney,
  effectiveCapacity,
  flightMinutes,
  mergeMarketPrice,
  computeCandidate,
  updateVelocityState
};
