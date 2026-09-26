import * as SecureStore from 'expo-secure-store';

const KEY_API =
  'tp_market_api_key_v1';

const KEY_SETTINGS =
  'tp_market_settings_v1';

const KEY_WATCHLIST =
  'tp_market_watchlist_v1';

export const DEFAULT_SETTINGS = {
  baseCapacity: 22,
  tourismMode: true,
  flightMode: 'standard',
  mailingBook: false,
  refreshSeconds: 15,
  hideSoldOut: true
};

async function readJson(
  key,
  fallback
) {
  try {
    const raw =
      await SecureStore.getItemAsync(
        key
      );

    return raw
      ? {
          ...fallback,
          ...JSON.parse(raw)
        }
      : fallback;
  } catch (_) {
    return fallback;
  }
}

export async function loadSettings() {
  return readJson(
    KEY_SETTINGS,
    DEFAULT_SETTINGS
  );
}

export async function saveSettings(
  settings
) {
  await SecureStore.setItemAsync(
    KEY_SETTINGS,
    JSON.stringify(settings)
  );
}

export async function loadWatchlist() {
  try {
    const raw =
      await SecureStore.getItemAsync(
        KEY_WATCHLIST
      );

    const parsed =
      raw
        ? JSON.parse(raw)
        : [];

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch (_) {
    return [];
  }
}

export async function saveWatchlist(
  list
) {
  await SecureStore.setItemAsync(
    KEY_WATCHLIST,
    JSON.stringify(
      Array.isArray(list)
        ? list
        : []
    )
  );
}

export async function loadApiKey() {
  return (
    await SecureStore.getItemAsync(
      KEY_API
    )
  ) || '';
}

export async function saveApiKey(
  value
) {
  const key =
    String(value || '').trim();

  if (key) {
    await SecureStore.setItemAsync(
      KEY_API,
      key
    );
  } else {
    await SecureStore.deleteItemAsync(
      KEY_API
    );
  }
}
