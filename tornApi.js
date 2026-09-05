const BASE = 'https://api.torn.com/v2';
const TIMEOUT_MS = 12000;

async function getJson(path, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const joiner = path.includes('?') ? '&' : '?';
  try {
    const response = await fetch(`${BASE}${path}${joiner}comment=TornPulse`, {
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

function normalizeBar(raw, nowUnix = Math.floor(Date.now() / 1000)) {
  if (!raw) throw new Error('Missing Torn bar data.');
  const current = Number(raw.current);
  const maximum = Number(raw.maximum);
  const increment = Number(raw.increment || 0);
  const interval = Number(raw.interval || 0);
  const fullSeconds = Math.max(0, Number(raw.full_time || 0));
  const tickSeconds = Math.max(0, Number(raw.tick_time || 0));
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) throw new Error('Invalid Torn bar data.');
  return {
    ...raw,
    current,
    maximum,
    increment,
    interval,
    api_full_time_seconds: fullSeconds,
    api_tick_time_seconds: tickSeconds,
    full_time: fullSeconds > 0 ? nowUnix + fullSeconds : (current >= maximum ? nowUnix : 0),
    tick_time: tickSeconds > 0 ? nowUnix + tickSeconds : 0,
  };
}

function normalizeStatus(raw) {
  if (!raw) return {state:'Unknown', description:'Status unavailable', details:null, until:null, color:null};
  return {
    state: String(raw.state || 'Unknown'),
    description: String(raw.description || raw.state || 'Unknown'),
    details: raw.details == null ? null : String(raw.details),
    until: raw.until == null ? null : Number(raw.until),
    color: raw.color == null ? null : String(raw.color),
  };
}

function validateBars(payload) {
  const energyRaw = payload?.bars?.energy;
  const nerveRaw = payload?.bars?.nerve;
  const lifeRaw = payload?.bars?.life;
  const happyRaw = payload?.bars?.happy;
  if (!energyRaw || !nerveRaw || !lifeRaw || !happyRaw) throw new Error('Unexpected Torn bars response.');
  return {energy: normalizeBar(energyRaw), nerve: normalizeBar(nerveRaw), life: normalizeBar(lifeRaw), happy: normalizeBar(happyRaw)};
}

async function fetchLatestIncomingAttack(key) {
  try {
    const payload = await getJson('/user/attacks?filters=incoming&sort=DESC&limit=1', key);
    const attack = Array.isArray(payload?.attacks) ? payload.attacks[0] : null;
    if (!attack) return {attackAccess:true, lastIncomingAttack:null};
    return {
      attackAccess:true,
      lastIncomingAttack:{
        id: attack.id,
        started: Number(attack.started || 0),
        ended: Number(attack.ended || 0),
        result: String(attack.result || 'Unknown'),
        is_stealthed: Boolean(attack.is_stealthed),
        attacker: attack.attacker ? {id:attack.attacker.id, name:String(attack.attacker.name || 'Unknown')} : null,
      },
    };
  } catch (_) {
    return {attackAccess:false, lastIncomingAttack:null};
  }
}

async function fetchTravel(key) {
  try {
    const payload = await getJson('/user/travel', key);
    const raw = payload?.travel || payload || {};
    const now = Math.floor(Date.now() / 1000);
    const arrival = Number(raw.timestamp ?? raw.arrival ?? raw.arrival_time ?? (raw.time_left ? now + Number(raw.time_left) : 0));
    const destination = String(raw.destination ?? raw.destination_name ?? raw.country ?? '').trim();
    const origin = String(raw.origin ?? raw.origin_name ?? 'Torn').trim();
    return {active:Boolean(destination && arrival > now), destination, origin, arrival, departed:Number(raw.departed ?? raw.departure ?? 0)};
  } catch (_) {
    return null;
  }
}

async function fetchSnapshot(key) {
  const [barsPayload, cooldownPayload, basicPayload, attackInfo, travelPayload] = await Promise.all([
    getJson('/user/bars', key),
    getJson('/user/cooldowns', key),
    getJson('/user/basic', key),
    fetchLatestIncomingAttack(key),
    fetchTravel(key),
  ]);
  const {energy, nerve, life, happy} = validateBars(barsPayload);
  const cooldowns = cooldownPayload?.cooldowns;
  if (!cooldowns || !['drug', 'medical', 'booster'].every(k => Number.isFinite(cooldowns[k]))) throw new Error('Unexpected Torn cooldown response.');
  const profile = basicPayload?.profile || {};
  const status = normalizeStatus(profile.status);
  const statusTraveling = String(status.state).toLowerCase().includes('travel');
  const fallbackDestination = String(status.description || '').replace(/^travel(?:l)?ing\s+(?:to\s+)?/i, '').trim();
  const travel = travelPayload || (statusTraveling ? {active:Number(status.until || 0) > Math.floor(Date.now()/1000), destination:fallbackDestination || 'Destination', origin:'Torn', arrival:Number(status.until || 0), departed:0} : {active:false,destination:'',origin:'Torn',arrival:0,departed:0});
  return {
    energy,
    nerve,
    life,
    happy,
    cooldowns,
    profile:{id:profile.id ?? null, name:profile.name ?? null},
    status,
    travel,
    attackAccess:attackInfo.attackAccess,
    lastIncomingAttack:attackInfo.lastIncomingAttack,
    fetchedAt:Date.now(),
    demo:false,
  };
}

function normalizeItemCatalog(payload) {
  const raw = payload?.items;
  const values = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([id, item]) => ({id, ...item}));
  return values.map(item => ({id:Number(item.id), name:String(item.name || ''), type:String(item.type || '')})).filter(item => Number.isFinite(item.id) && item.name).sort((a,b)=>a.name.localeCompare(b.name));
}

async function fetchItemCatalog(key) {
  return normalizeItemCatalog(await getJson('/torn/items?sort=ASC', key));
}

async function fetchItemMarket(itemId, key) {
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid Torn item.');
  const payload = await getJson(`/market/${id}/itemmarket?offset=0`, key);
  const market = payload?.itemmarket || payload || {};
  const raw = Array.isArray(market) ? market : (Array.isArray(market.listings) ? market.listings : []);
  const listings = raw.map((listing,index) => ({
    id:listing.id ?? listing.listing_id ?? listing.item?.uid ?? index,
    price:Number(listing.price || 0),
    amount:Number(listing.amount ?? listing.quantity ?? listing.available ?? 1),
  })).filter(listing => Number.isFinite(listing.price) && listing.price > 0).sort((a,b)=>a.price-b.price || b.amount-a.amount);
  return {item:market.item || null, listings};
}

module.exports = {fetchItemCatalog, fetchItemMarket, fetchSnapshot, normalizeBar, normalizeStatus};
