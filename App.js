import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {fetchForeignStock, fetchTornItemPrices} from './src/api';
import {
  DEFAULT_SETTINGS,
  loadApiKey,
  loadSettings,
  loadWatchlist,
  saveApiKey,
  saveSettings,
  saveWatchlist
} from './src/storage';

const {
  COUNTRIES,
  ageLabel,
  compactMoney,
  computeCandidate,
  countdownLabel,
  effectiveCapacity,
  freshnessState,
  groupForeignStock,
  mergeMarketPrice,
  money,
  nextQuarterHour,
  updateVelocityState
} = require('./src/marketCore');

const C = {
  bg: '#05090c',
  panel: '#0b1217',
  panel2: '#0e171d',
  line: '#1c2a33',
  text: '#f5f7f8',
  muted: '#8b9aa5',
  faint: '#53626c',
  cyan: '#2fd6ff',
  green: '#55e39f',
  amber: '#ffbf58',
  red: '#ff6675',
  blue: '#6f8cff'
};

function toneForFreshness(level) {
  if (level === 'live') return C.green;
  if (level === 'recent') return C.amber;
  return C.red;
}

function arrivalTone(value) {
  if (value === 'LIKELY') return C.green;
  if (value === 'AT RISK') return C.amber;
  if (value === 'SOLD OUT' || value === 'UNLIKELY') return C.red;
  return C.muted;
}

function SectionTitle({eyebrow, title, right}) {
  return <View style={styles.sectionTitle}>
    <View style={{flex: 1}}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionHeading}>{title}</Text>
    </View>
    {right}
  </View>;
}

function Pill({children, color=C.muted}) {
  return <View style={[styles.pill, {borderColor: color + '77'}]}><Text style={[styles.pillText, {color}]}>{children}</Text></View>;
}

function Header({page, syncing, priceReady, onRefresh}) {
  return <View style={styles.header}>
    <View style={styles.headerTop}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>TP</Text></View>
        <View>
          <Text style={styles.brand}>TORN <Text style={styles.brandAccent}>PULSE</Text></Text>
          <Text style={styles.brandSub}>FOREIGN MARKET • {page}</Text>
        </View>
      </View>
      <Pressable onPress={onRefresh} disabled={syncing} style={({pressed}) => [styles.refreshButton, pressed && styles.pressed]}>
        <Text style={styles.refreshText}>{syncing ? '•••' : '↻'}</Text>
      </Pressable>
    </View>
    <View style={styles.headerStatus}>
      <Pill color={C.green}>FOREIGN FEED</Pill>
      <Pill color={priceReady ? C.cyan : C.muted}>{priceReady ? 'TORN PRICES' : 'PRICES OFF'}</Pill>
    </View>
  </View>;
}

function BottomNav({active, onChange, watchCount}) {
  const tabs = [
    ['RADAR', '⌁', 'Radar'],
    ['TRIPS', '✈', 'Trips'],
    ['WATCH', '★', watchCount ? `Watch ${watchCount}` : 'Watch'],
    ['SETTINGS', '⚙', 'Settings']
  ];
  return <View style={styles.nav}>
    {tabs.map(([key, icon, label]) => {
      const selected = active === key;
      return <Pressable key={key} onPress={() => onChange(key)} style={({pressed}) => [styles.navItem, pressed && styles.pressed]}>
        {selected ? <View style={styles.navLine}/> : null}
        <Text style={[styles.navIcon, selected && styles.navActive]}>{icon}</Text>
        <Text style={[styles.navLabel, selected && styles.navActive]}>{label}</Text>
      </Pressable>;
    })}
  </View>;
}

function EmptyState({title, text}) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View>;
}

function BestMoveCard({candidate, priceReady, capacity}) {
  if (!priceReady) {
    return <View style={[styles.hero, {borderColor: C.cyan + '55'}]}>
      <Text style={styles.heroKicker}>BEST MOVE ENGINE</Text>
      <Text style={styles.heroTitle}>Connect Torn prices</Text>
      <Text style={styles.heroCopy}>Foreign stock is live. Add your Torn API key in Settings and Pulse can compare profit per slot and profit per travel minute.</Text>
    </View>;
  }
  if (!candidate) {
    return <View style={[styles.hero, {borderColor: C.amber + '55'}]}>
      <Text style={styles.heroKicker}>BEST MOVE ENGINE</Text>
      <Text style={styles.heroTitle}>No profitable stocked run found</Text>
      <Text style={styles.heroCopy}>Pulse is not seeing a positive-profit item with usable stock in the current feed.</Text>
    </View>;
  }
  return <View style={[styles.hero, {borderColor: C.green + '66'}]}>
    <View style={styles.heroTop}><Text style={styles.heroKicker}>BEST CURRENT RUN</Text><Pill color={arrivalTone(candidate.arrival)}>{candidate.arrival}</Pill></View>
    <Text style={styles.heroTitle}>{candidate.flag} {candidate.country}</Text>
    <Text style={styles.heroItem}>{candidate.name}</Text>
    <View style={styles.heroMetrics}>
      <View style={styles.heroMetric}><Text style={styles.heroMetricLabel}>LOAD</Text><Text style={styles.heroMetricValue}>{Math.min(capacity, candidate.quantity)} / {capacity}</Text></View>
      <View style={styles.heroMetric}><Text style={styles.heroMetricLabel}>EST. PROFIT</Text><Text style={[styles.heroMetricValue,{color:C.green}]}>{compactMoney(candidate.projectedProfit ?? candidate.loadProfit)}</Text></View>
      <View style={styles.heroMetric}><Text style={styles.heroMetricLabel}>ONE WAY</Text><Text style={styles.heroMetricValue}>{candidate.minutes}m</Text></View>
    </View>
    <Text style={styles.heroCopy}>Market {money(candidate.marketPrice)} • Buy {money(candidate.cost)} • {candidate.velocity > 0 ? `${Math.round(candidate.velocity)} units/min observed` : 'depletion trend not learned yet'}</Text>
  </View>;
}

function ItemRow({row, priceMap, capacity, settings, velocity, watched, onToggleWatch}) {
  const merged = mergeMarketPrice(row, priceMap);
  const candidate = computeCandidate(merged, {capacity, flightMode: settings.flightMode, mailingBook: settings.mailingBook, velocity});
  const fresh = freshnessState(row.updated);
  return <View style={styles.itemRow}>
    <Pressable onPress={() => onToggleWatch(row.key)} hitSlop={8} style={styles.starButton}>
      <Text style={[styles.star, watched && {color:C.amber}]}>{watched ? '★' : '☆'}</Text>
    </Pressable>
    <View style={{flex:1,minWidth:0}}>
      <View style={styles.itemTop}>
        <Text numberOfLines={1} style={styles.itemName}>{row.name}</Text>
        <Text style={[styles.qty, {color: row.quantity > 0 ? C.text : C.red}]}>{row.quantity.toLocaleString()}</Text>
      </View>
      <View style={styles.itemMetaLine}>
        <Text style={styles.itemMeta}>Buy {money(row.cost)}</Text>
        {candidate.marketPrice > 0 ? <Text style={styles.itemMeta}>Market {money(candidate.marketPrice)}</Text> : null}
        {candidate.marketPrice > 0 ? <Text style={[styles.itemMeta,{color:candidate.profitEach >= 0 ? C.green : C.red}]}>{candidate.profitEach >= 0 ? '+' : ''}{money(candidate.profitEach)}/slot</Text> : null}
      </View>
      <View style={styles.itemMetaLine}>
        <Text style={[styles.itemMeta,{color:toneForFreshness(fresh.level)}]}>{fresh.label} • {ageLabel(fresh.ageSeconds)}</Text>
        {velocity > 0 ? <Text style={styles.itemMeta}>{Math.round(velocity)}/min</Text> : <Text style={styles.itemMeta}>trend learning</Text>}
        {row.quantity > 0 ? <Text style={[styles.itemMeta,{color:arrivalTone(candidate.arrival)}]}>{candidate.arrival}</Text> : null}
      </View>
    </View>
  </View>;
}

function CountryCard({group, priceMap, capacity, settings, velocityState, watchlist, onToggleWatch, search}) {
  const fresh = freshnessState(group.updated);
  const q = search.trim().toLowerCase();
  const items = group.items.filter(item => {
    if (settings.hideSoldOut && item.quantity <= 0) return false;
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || group.country.toLowerCase().includes(q) || group.city.toLowerCase().includes(q);
  });
  if (!items.length && q) return null;

  return <View style={styles.countryCard}>
    <View style={styles.countryHead}>
      <View style={styles.countryIdentity}>
        <Text style={styles.flag}>{group.flag}</Text>
        <View style={{flex:1,minWidth:0}}><Text style={styles.countryName}>{group.country}</Text><Text style={styles.city}>{group.city}</Text></View>
      </View>
      <View style={{alignItems:'flex-end'}}><Pill color={toneForFreshness(fresh.level)}>{fresh.label}</Pill><Text style={styles.updated}>{ageLabel(fresh.ageSeconds)}</Text></View>
    </View>
    <View style={styles.countryStats}>
      <Text style={styles.countryStat}><Text style={styles.countryStatStrong}>{group.inStockItems}</Text> items stocked</Text>
      <Text style={styles.countryStat}><Text style={styles.countryStatStrong}>{group.totalUnits.toLocaleString()}</Text> units</Text>
      <Text style={styles.countryStat}><Text style={styles.countryStatStrong}>{COUNTRIES[group.countryCode]?.times?.[settings.flightMode] || 0}m</Text> base flight</Text>
    </View>
    <View style={styles.divider}/>
    {items.map(item => <ItemRow key={item.key} row={item} priceMap={priceMap} capacity={capacity} settings={settings} velocity={velocityState[item.key]?.rate || 0} watched={watchlist.includes(item.key)} onToggleWatch={onToggleWatch}/>) }
    {!items.length ? <Text style={styles.noItems}>No visible items with the current filters.</Text> : null}
  </View>;
}

function TripCard({trip, rank}) {
  const hasProfit = trip && trip.projectedProfit != null;
  return <View style={styles.tripCard}>
    <View style={styles.tripRank}><Text style={styles.tripRankText}>{rank}</Text></View>
    <View style={{flex:1,minWidth:0}}>
      <View style={styles.tripTop}><Text style={styles.tripCountry}>{trip.flag} {trip.country}</Text><Pill color={arrivalTone(trip.arrival)}>{trip.arrival}</Pill></View>
      <Text numberOfLines={1} style={styles.tripItem}>{trip.name}</Text>
      <View style={styles.tripMetrics}>
        <Text style={styles.tripMeta}>{trip.minutes}m one-way</Text>
        <Text style={styles.tripMeta}>{trip.projectedUnits} est. units</Text>
        {hasProfit ? <Text style={[styles.tripMeta,{color:C.green}]}>{compactMoney(trip.projectedProfit)}</Text> : <Text style={styles.tripMeta}>price unavailable</Text>}
      </View>
    </View>
  </View>;
}

function Toggle({label, detail, value, onPress}) {
  return <Pressable onPress={onPress} style={({pressed}) => [styles.settingRow, pressed && styles.pressed]}>
    <View style={{flex:1}}><Text style={styles.settingLabel}>{label}</Text><Text style={styles.settingDetail}>{detail}</Text></View>
    <View style={[styles.toggle, value && styles.toggleOn]}><Text style={[styles.toggleText, value && styles.toggleTextOn]}>{value ? 'ON' : 'OFF'}</Text></View>
  </Pressable>;
}

function ChoiceRow({label, value, options, onChange}) {
  return <View style={styles.settingBlock}>
    <Text style={styles.settingLabel}>{label}</Text>
    <View style={styles.choiceWrap}>{options.map(option => {
      const selected = value === option.value;
      return <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.choice, selected && styles.choiceActive]}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{option.label}</Text></Pressable>;
    })}</View>
  </View>;
}

export default function App() {
  const [page, setPage] = useState('RADAR');
  const [rows, setRows] = useState([]);
  const [priceMap, setPriceMap] = useState({});
  const [priceFetchedAt, setPriceFetchedAt] = useState(0);
  const [feedFetchedAt, setFeedFetchedAt] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [apiKey, setApiKeyState] = useState('');
  const [apiInput, setApiInput] = useState('');
  const [watchlist, setWatchlist] = useState([]);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(true);
  const [priceSyncing, setPriceSyncing] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [velocityState, setVelocityState] = useState({});
  const previousRowsRef = useRef({});
  const velocityRef = useRef({});
  const mountedRef = useRef(true);

  const capacity = effectiveCapacity(settings.baseCapacity, settings.tourismMode);
  const priceReady = Object.keys(priceMap).length > 0;

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const [savedSettings, savedKey, savedWatch] = await Promise.all([loadSettings(), loadApiKey(), loadWatchlist()]);
      if (!mountedRef.current) return;
      setSettings(savedSettings);
      setApiKeyState(savedKey);
      setApiInput(savedKey);
      setWatchlist(savedWatch);
      await refreshForeign();
      if (savedKey) refreshPrices(savedKey).catch(() => {});
    })().catch(e => setError(e.message || String(e)));
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const seconds = Math.max(15, Number(settings.refreshSeconds || 15));
    const id = setInterval(() => refreshForeign(false), seconds * 1000);
    return () => clearInterval(id);
  }, [settings.refreshSeconds]);

  async function refreshForeign(showSpinner=true) {
    if (showSpinner) setSyncing(true);
    try {
      const result = await fetchForeignStock();
      const velocityUpdate = updateVelocityState(previousRowsRef.current, result.rows, velocityRef.current);
      previousRowsRef.current = velocityUpdate.previousRows;
      velocityRef.current = velocityUpdate.velocityState;
      if (mountedRef.current) {
        setRows(result.rows);
        setFeedFetchedAt(result.fetchedAt);
        setVelocityState(velocityUpdate.velocityState);
        setError('');
      }
    } catch (e) {
      if (mountedRef.current) setError(e.message || String(e));
    } finally {
      if (mountedRef.current && showSpinner) setSyncing(false);
    }
  }

  async function refreshPrices(key=apiKey) {
    setPriceSyncing(true);
    try {
      const result = await fetchTornItemPrices(key);
      if (mountedRef.current) {
        setPriceMap(result.map);
        setPriceFetchedAt(result.fetchedAt);
      }
      return result;
    } catch (e) {
      if (mountedRef.current) Alert.alert('Price sync', e.message || String(e));
      throw e;
    } finally {
      if (mountedRef.current) setPriceSyncing(false);
    }
  }

  async function updateSettings(patch) {
    const next = {...settings, ...patch};
    setSettings(next);
    await saveSettings(next).catch(() => {});
  }

  async function toggleWatch(key) {
    const next = watchlist.includes(key) ? watchlist.filter(x => x !== key) : [...watchlist, key];
    setWatchlist(next);
    await saveWatchlist(next).catch(() => {});
  }

  async function commitApiKey() {
    Keyboard.dismiss();
    const key = apiInput.trim();
    await saveApiKey(key);
    setApiKeyState(key);
    if (!key) {
      setPriceMap({});
      setPriceFetchedAt(0);
      Alert.alert('Torn prices disconnected', 'Foreign stock still works. Profit calculations are now disabled.');
      return;
    }
    await refreshPrices(key).catch(() => {});
  }

  const groups = useMemo(() => groupForeignStock(rows), [rows]);

  const candidates = useMemo(() => rows.map(row => {
    const merged = mergeMarketPrice(row, priceMap);
    return computeCandidate(merged, {
      capacity,
      flightMode: settings.flightMode,
      mailingBook: settings.mailingBook,
      velocity: velocityState[row.key]?.rate || 0
    });
  }), [rows, priceMap, capacity, settings.flightMode, settings.mailingBook, velocityState]);

  const bestMove = useMemo(() => candidates
    .filter(x => x.quantity > 0 && x.marketPrice > 0 && x.profitEach > 0 && (x.projectedProfit ?? x.loadProfit ?? 0) > 0)
    .sort((a,b) => {
      const aScore = a.profitPerMinute ?? -Infinity;
      const bScore = b.profitPerMinute ?? -Infinity;
      if (bScore !== aScore) return bScore - aScore;
      return (b.projectedProfit || 0) - (a.projectedProfit || 0);
    })[0] || null, [candidates]);

  const tripLeaders = useMemo(() => {
    const map = new Map();
    for (const c of candidates) {
      if (c.quantity <= 0) continue;
      const old = map.get(c.countryCode);
      const cScore = c.profitPerMinute ?? -Infinity;
      const oScore = old ? (old.profitPerMinute ?? -Infinity) : -Infinity;
      if (!old || cScore > oScore || (cScore === oScore && c.quantity > old.quantity)) map.set(c.countryCode, c);
    }
    return Array.from(map.values()).sort((a,b) => {
      if (priceReady) return (b.profitPerMinute ?? -Infinity) - (a.profitPerMinute ?? -Infinity);
      return b.quantity - a.quantity;
    });
  }, [candidates, priceReady]);

  const watchedRows = useMemo(() => rows.filter(x => watchlist.includes(x.key)), [rows, watchlist]);
  const nextQuarter = nextQuarterHour(clock);

  function RadarPage() {
    const filteredGroups = groups.filter(group => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return group.country.toLowerCase().includes(q) || group.city.toLowerCase().includes(q) || group.items.some(x => x.name.toLowerCase().includes(q));
    });
    return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <BestMoveCard candidate={bestMove} priceReady={priceReady} capacity={capacity}/>
      <View style={styles.pulseStrip}>
        <View><Text style={styles.pulseStripLabel}>CAPACITY</Text><Text style={styles.pulseStripValue}>{capacity}</Text></View>
        <View><Text style={styles.pulseStripLabel}>NEXT :15 MARK</Text><Text style={[styles.pulseStripValue,{color:C.cyan}]}>{countdownLabel(nextQuarter, clock)}</Text></View>
        <View><Text style={styles.pulseStripLabel}>COUNTRIES</Text><Text style={styles.pulseStripValue}>{groups.length}</Text></View>
      </View>
      <Text style={styles.disclaimer}>Quarter-hour timing is context only — it is not a guaranteed restock timer. Foreign quantities are crowdsourced observations.</Text>
      <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search country or item" placeholderTextColor={C.faint} style={styles.searchInput}/>{search ? <Pressable onPress={() => setSearch('')}><Text style={styles.clear}>×</Text></Pressable> : null}</View>
      <SectionTitle eyebrow="WORLD STOCK" title="Foreign radar" right={<Pill color={C.muted}>{feedFetchedAt ? `SYNC ${ageLabel(Math.floor((clock-feedFetchedAt)/1000))}` : 'CONNECTING'}</Pill>}/>
      {error ? <View style={styles.errorBox}><Text style={styles.errorTitle}>FEED ISSUE</Text><Text style={styles.errorText}>{error}</Text></View> : null}
      {syncing && !rows.length ? <ActivityIndicator color={C.cyan} size="large" style={{marginTop:30}}/> : null}
      {filteredGroups.map(group => <CountryCard key={group.countryCode} group={group} priceMap={priceMap} capacity={capacity} settings={settings} velocityState={velocityState} watchlist={watchlist} onToggleWatch={toggleWatch} search={search}/>) }
    </ScrollView>;
  }

  function TripsPage() {
    return <ScrollView contentContainerStyle={styles.scroll}>
      <SectionTitle eyebrow="DECISION ENGINE" title="Trip ranking" right={<Pill color={priceReady ? C.green : C.amber}>{priceReady ? 'PROFIT ON' : 'STOCK ONLY'}</Pill>}/>
      <Text style={styles.pageCopy}>{priceReady ? 'Ranks each country by the strongest currently stocked item using projected load profit per round-trip minute.' : 'Add a Torn API key in Settings to rank by current market value. Until then, countries are ordered by visible stock.'}</Text>
      <View style={styles.infoCard}><Text style={styles.infoLabel}>YOUR TRIP PROFILE</Text><Text style={styles.infoBig}>{capacity} items • {settings.flightMode.toUpperCase()}</Text><Text style={styles.infoSmall}>{settings.mailingBook ? 'Mailing Yourself Abroad active' : 'Normal travel times'}{settings.tourismMode ? ' • Tourism multiplier ON' : ''}</Text></View>
      {tripLeaders.length ? tripLeaders.map((trip, i) => <TripCard key={trip.countryCode} trip={trip} rank={i+1}/>) : <EmptyState title="No trip data yet" text="Wait for the first foreign-stock sync."/>}
      <Text style={styles.disclaimer}>Business-class ticket opportunity cost is not subtracted. Standard-flight cash fare is subtracted from estimated round-trip profit.</Text>
    </ScrollView>;
  }

  function WatchPage() {
    return <ScrollView contentContainerStyle={styles.scroll}>
      <SectionTitle eyebrow="PERSONAL RADAR" title="Watchlist" right={<Pill color={watchlist.length ? C.amber : C.muted}>{watchlist.length} WATCHED</Pill>}/>
      <Text style={styles.pageCopy}>Star anything in Radar. Pulse keeps those foreign items together here so you can check them without scanning every country.</Text>
      {!watchlist.length ? <EmptyState title="Nothing watched yet" text="Tap ☆ next to an item in Radar to add it here."/> : null}
      {watchedRows.map(row => <View key={row.key} style={styles.watchCard}>
        <View style={styles.watchHead}><Text style={styles.watchCountry}>{row.flag} {row.country}</Text><Pressable onPress={() => toggleWatch(row.key)}><Text style={[styles.star,{color:C.amber}]}>★</Text></Pressable></View>
        <ItemRow row={row} priceMap={priceMap} capacity={capacity} settings={settings} velocity={velocityState[row.key]?.rate || 0} watched onToggleWatch={toggleWatch}/>
      </View>)}
      {watchlist.length && watchedRows.length < watchlist.length ? <Text style={styles.disclaimer}>Some watched items are not present in the current feed yet.</Text> : null}
    </ScrollView>;
  }

  function SettingsPage() {
    return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <SectionTitle eyebrow="MARKET PROFILE" title="Settings"/>
      <Text style={styles.settingGroupTitle}>TORN MARKET VALUES</Text>
      <View style={styles.settingsCard}>
        <Text style={styles.settingLabel}>Torn API key</Text>
        <Text style={styles.settingDetail}>Stored locally with SecureStore. Used only to fetch Torn item market values for profit calculations.</Text>
        <TextInput value={apiInput} onChangeText={setApiInput} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Paste API key" placeholderTextColor={C.faint} style={styles.apiInput}/>
        <View style={styles.actionRow}>
          <Pressable onPress={commitApiKey} style={({pressed}) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{apiKey ? 'SAVE & SYNC' : 'CONNECT PRICES'}</Text></Pressable>
          {apiKey ? <Pressable onPress={() => {setApiInput(''); saveApiKey('').then(()=>{setApiKeyState('');setPriceMap({});setPriceFetchedAt(0);});}} style={({pressed}) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>REMOVE</Text></Pressable> : null}
        </View>
        <Text style={styles.settingDetail}>{priceSyncing ? 'Syncing Torn item prices…' : priceFetchedAt ? `Prices synced ${ageLabel(Math.floor((clock-priceFetchedAt)/1000))}` : 'No Torn market-price sync yet.'}</Text>
      </View>

      <Text style={styles.settingGroupTitle}>CAPACITY</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingRowStatic}><View style={{flex:1}}><Text style={styles.settingLabel}>Normal carrying capacity</Text><Text style={styles.settingDetail}>Set your normal maximum before event multipliers.</Text></View><View style={styles.numberControl}><Pressable onPress={() => updateSettings({baseCapacity: Math.max(1, settings.baseCapacity-1)})} style={styles.numberButton}><Text style={styles.numberButtonText}>−</Text></Pressable><Text style={styles.numberValue}>{settings.baseCapacity}</Text><Pressable onPress={() => updateSettings({baseCapacity: settings.baseCapacity+1})} style={styles.numberButton}><Text style={styles.numberButtonText}>+</Text></Pressable></View></View>
        <Toggle label="Tourism multiplier" detail={`Effective app capacity: ${capacity}`} value={settings.tourismMode} onPress={() => updateSettings({tourismMode: !settings.tourismMode})}/>
      </View>

      <Text style={styles.settingGroupTitle}>TRAVEL</Text>
      <View style={styles.settingsCard}>
        <ChoiceRow label="Flight method" value={settings.flightMode} onChange={value => updateSettings({flightMode:value})} options={[{value:'standard',label:'Standard'},{value:'airstrip',label:'Airstrip'},{value:'wlt',label:'WLT'},{value:'business',label:'Business'}]}/>
        <Toggle label="Mailing Yourself Abroad" detail="Use the book-reduced flight-time table." value={settings.mailingBook} onPress={() => updateSettings({mailingBook: !settings.mailingBook})}/>
      </View>

      <Text style={styles.settingGroupTitle}>RADAR</Text>
      <View style={styles.settingsCard}>
        <ChoiceRow label="Foreign feed refresh" value={settings.refreshSeconds} onChange={value => updateSettings({refreshSeconds:value})} options={[{value:15,label:'15 sec'},{value:30,label:'30 sec'},{value:60,label:'60 sec'}]}/>
        <Toggle label="Hide sold-out items" detail="Keep zero-stock items out of country cards." value={settings.hideSoldOut} onPress={() => updateSettings({hideSoldOut: !settings.hideSoldOut})}/>
      </View>

      <View style={styles.sourceCard}><Text style={styles.sourceTitle}>DATA MODEL</Text><Text style={styles.sourceText}>Foreign quantities come from YATA's crowdsourced travel export. Torn item market values come from the official Torn API when you connect a key. Pulse never claims a crowdsourced observation is a direct live shop feed.</Text></View>
      <Pressable onPress={() => Linking.openURL('https://www.torn.com/travelagency.php')} style={({pressed}) => [styles.openTorn, pressed && styles.pressed]}><Text style={styles.openTornText}>OPEN TORN TRAVEL AGENCY ↗</Text></Pressable>
    </ScrollView>;
  }

  const content = page === 'TRIPS' ? <TripsPage/> : page === 'WATCH' ? <WatchPage/> : page === 'SETTINGS' ? <SettingsPage/> : <RadarPage/>;

  return <SafeAreaView style={styles.safe}>
    <StatusBar style="light" backgroundColor={C.bg}/>
    <Header page={page} syncing={syncing} priceReady={priceReady} onRefresh={() => {refreshForeign(true); if (apiKey) refreshPrices(apiKey).catch(()=>{});}}/>
    <View style={styles.content}>{content}</View>
    <BottomNav active={page} onChange={setPage} watchCount={watchlist.length}/>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.bg},
  content:{flex:1},
  scroll:{paddingHorizontal:16,paddingTop:12,paddingBottom:28,gap:12},
  pressed:{opacity:.7},
  header:{paddingHorizontal:16,paddingTop:10,paddingBottom:10,borderBottomWidth:1,borderBottomColor:C.line,backgroundColor:'#071015'},
  headerTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  brandRow:{flexDirection:'row',alignItems:'center',gap:10},
  brandMark:{width:38,height:38,borderRadius:11,borderWidth:1,borderColor:C.cyan+'88',backgroundColor:'#0b1c24',alignItems:'center',justifyContent:'center'},
  brandMarkText:{color:C.cyan,fontSize:14,fontWeight:'900',letterSpacing:1},
  brand:{color:C.text,fontSize:18,fontWeight:'900',letterSpacing:1.1},
  brandAccent:{color:C.cyan},
  brandSub:{color:C.muted,fontSize:10,fontWeight:'700',letterSpacing:1.1,marginTop:2},
  refreshButton:{width:42,height:42,borderRadius:12,borderWidth:1,borderColor:C.line,backgroundColor:C.panel,alignItems:'center',justifyContent:'center'},
  refreshText:{color:C.cyan,fontSize:23,fontWeight:'700'},
  headerStatus:{flexDirection:'row',gap:7,marginTop:9},
  pill:{borderWidth:1,borderRadius:999,paddingHorizontal:8,paddingVertical:4,backgroundColor:'#081015'},
  pillText:{fontSize:9,fontWeight:'900',letterSpacing:.8},
  nav:{height:68,flexDirection:'row',borderTopWidth:1,borderTopColor:C.line,backgroundColor:'#071015'},
  navItem:{flex:1,alignItems:'center',justifyContent:'center',position:'relative'},
  navLine:{position:'absolute',top:0,width:28,height:2,borderRadius:2,backgroundColor:C.cyan},
  navIcon:{color:C.muted,fontSize:18,fontWeight:'800'},
  navLabel:{color:C.muted,fontSize:9,fontWeight:'800',marginTop:3,letterSpacing:.4},
  navActive:{color:C.cyan},
  sectionTitle:{flexDirection:'row',alignItems:'center',marginTop:5,marginBottom:1},
  eyebrow:{color:C.cyan,fontSize:9,fontWeight:'900',letterSpacing:1.6,marginBottom:3},
  sectionHeading:{color:C.text,fontSize:22,fontWeight:'900'},
  hero:{backgroundColor:C.panel,borderWidth:1,borderRadius:18,padding:16},
  heroTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  heroKicker:{color:C.cyan,fontSize:9,fontWeight:'900',letterSpacing:1.5},
  heroTitle:{color:C.text,fontSize:25,fontWeight:'900',marginTop:8},
  heroItem:{color:C.muted,fontSize:15,fontWeight:'700',marginTop:3},
  heroCopy:{color:C.muted,fontSize:11,lineHeight:16,marginTop:10},
  heroMetrics:{flexDirection:'row',gap:8,marginTop:14},
  heroMetric:{flex:1,backgroundColor:C.panel2,borderRadius:12,padding:10,borderWidth:1,borderColor:C.line},
  heroMetricLabel:{color:C.faint,fontSize:8,fontWeight:'900',letterSpacing:1},
  heroMetricValue:{color:C.text,fontSize:15,fontWeight:'900',marginTop:5},
  pulseStrip:{flexDirection:'row',backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:14,padding:12,justifyContent:'space-between'},
  pulseStripLabel:{color:C.faint,fontSize:8,fontWeight:'900',letterSpacing:1},
  pulseStripValue:{color:C.text,fontSize:18,fontWeight:'900',marginTop:3},
  disclaimer:{color:C.faint,fontSize:10,lineHeight:15},
  searchBox:{height:46,flexDirection:'row',alignItems:'center',backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:13,paddingHorizontal:12},
  searchIcon:{color:C.cyan,fontSize:20,marginRight:8},
  searchInput:{flex:1,color:C.text,fontSize:14},
  clear:{color:C.muted,fontSize:24,paddingLeft:8},
  countryCard:{backgroundColor:C.panel,borderRadius:17,borderWidth:1,borderColor:C.line,padding:14},
  countryHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  countryIdentity:{flex:1,flexDirection:'row',alignItems:'center',gap:10},
  flag:{fontSize:29},
  countryName:{color:C.text,fontSize:18,fontWeight:'900'},
  city:{color:C.muted,fontSize:11,marginTop:2},
  updated:{color:C.faint,fontSize:9,marginTop:5},
  countryStats:{flexDirection:'row',gap:13,marginTop:13,flexWrap:'wrap'},
  countryStat:{color:C.muted,fontSize:10},
  countryStatStrong:{color:C.text,fontWeight:'900'},
  divider:{height:1,backgroundColor:C.line,marginVertical:11},
  noItems:{color:C.faint,fontSize:11,paddingVertical:12,textAlign:'center'},
  itemRow:{flexDirection:'row',gap:8,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#142028'},
  starButton:{width:27,alignItems:'center',paddingTop:1},
  star:{color:C.muted,fontSize:21},
  itemTop:{flexDirection:'row',gap:10,alignItems:'center'},
  itemName:{flex:1,color:C.text,fontSize:13,fontWeight:'800'},
  qty:{fontSize:14,fontWeight:'900'},
  itemMetaLine:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:5},
  itemMeta:{color:C.muted,fontSize:9,fontWeight:'600'},
  pageCopy:{color:C.muted,fontSize:12,lineHeight:18,marginBottom:4},
  infoCard:{backgroundColor:C.panel,borderWidth:1,borderColor:C.cyan+'33',borderRadius:16,padding:15},
  infoLabel:{color:C.cyan,fontSize:9,fontWeight:'900',letterSpacing:1.4},
  infoBig:{color:C.text,fontSize:20,fontWeight:'900',marginTop:7},
  infoSmall:{color:C.muted,fontSize:10,marginTop:5},
  tripCard:{flexDirection:'row',gap:11,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:15,padding:13,alignItems:'center'},
  tripRank:{width:31,height:31,borderRadius:10,backgroundColor:'#0b1c24',borderWidth:1,borderColor:C.cyan+'55',alignItems:'center',justifyContent:'center'},
  tripRankText:{color:C.cyan,fontWeight:'900'},
  tripTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  tripCountry:{flex:1,color:C.text,fontSize:14,fontWeight:'900'},
  tripItem:{color:C.muted,fontSize:11,marginTop:4},
  tripMetrics:{flexDirection:'row',flexWrap:'wrap',gap:11,marginTop:7},
  tripMeta:{color:C.muted,fontSize:10,fontWeight:'700'},
  watchCard:{backgroundColor:C.panel,borderRadius:16,borderWidth:1,borderColor:C.line,paddingHorizontal:12},
  watchHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:11},
  watchCountry:{color:C.cyan,fontSize:11,fontWeight:'900',letterSpacing:.4},
  empty:{borderWidth:1,borderStyle:'dashed',borderColor:C.line,borderRadius:16,padding:22,alignItems:'center'},
  emptyTitle:{color:C.text,fontSize:16,fontWeight:'900'},
  emptyText:{color:C.muted,fontSize:11,lineHeight:17,textAlign:'center',marginTop:6},
  errorBox:{backgroundColor:'#1a0b10',borderWidth:1,borderColor:C.red+'66',borderRadius:13,padding:12},
  errorTitle:{color:C.red,fontSize:9,fontWeight:'900',letterSpacing:1.2},
  errorText:{color:'#f3a7af',fontSize:11,marginTop:5},
  settingGroupTitle:{color:C.cyan,fontSize:9,fontWeight:'900',letterSpacing:1.4,marginTop:6},
  settingsCard:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:16,padding:14,gap:12},
  settingLabel:{color:C.text,fontSize:13,fontWeight:'900'},
  settingDetail:{color:C.muted,fontSize:10,lineHeight:15,marginTop:4},
  apiInput:{height:44,borderRadius:11,borderWidth:1,borderColor:C.line,backgroundColor:'#071015',paddingHorizontal:12,color:C.text,fontSize:12},
  actionRow:{flexDirection:'row',gap:8},
  primaryButton:{flex:1,height:42,borderRadius:11,backgroundColor:C.cyan,alignItems:'center',justifyContent:'center'},
  primaryButtonText:{color:'#00131a',fontSize:10,fontWeight:'900',letterSpacing:.7},
  secondaryButton:{height:42,paddingHorizontal:15,borderRadius:11,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},
  secondaryButtonText:{color:C.muted,fontSize:10,fontWeight:'900'},
  settingRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:4},
  settingRowStatic:{flexDirection:'row',alignItems:'center',gap:12},
  toggle:{width:48,height:28,borderRadius:14,borderWidth:1,borderColor:C.line,backgroundColor:'#071015',alignItems:'center',justifyContent:'center'},
  toggleOn:{backgroundColor:'#0d3028',borderColor:C.green+'77'},
  toggleText:{color:C.faint,fontSize:8,fontWeight:'900'},
  toggleTextOn:{color:C.green},
  numberControl:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.line,borderRadius:11,overflow:'hidden'},
  numberButton:{width:34,height:34,alignItems:'center',justifyContent:'center',backgroundColor:'#071015'},
  numberButtonText:{color:C.cyan,fontSize:20,fontWeight:'700'},
  numberValue:{minWidth:40,textAlign:'center',color:C.text,fontSize:14,fontWeight:'900'},
  settingBlock:{gap:8},
  choiceWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},
  choice:{paddingHorizontal:11,paddingVertical:8,borderRadius:10,borderWidth:1,borderColor:C.line,backgroundColor:'#071015'},
  choiceActive:{borderColor:C.cyan+'88',backgroundColor:'#0b1c24'},
  choiceText:{color:C.muted,fontSize:9,fontWeight:'800'},
  choiceTextActive:{color:C.cyan},
  sourceCard:{backgroundColor:'#091116',borderWidth:1,borderColor:C.blue+'44',borderRadius:15,padding:14},
  sourceTitle:{color:C.blue,fontSize:9,fontWeight:'900',letterSpacing:1.2},
  sourceText:{color:C.muted,fontSize:10,lineHeight:16,marginTop:6},
  openTorn:{height:45,borderRadius:12,borderWidth:1,borderColor:C.cyan+'55',alignItems:'center',justifyContent:'center'},
  openTornText:{color:C.cyan,fontSize:10,fontWeight:'900',letterSpacing:.8}
});
