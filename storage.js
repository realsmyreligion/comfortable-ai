import * as SecureStore from 'expo-secure-store';

const API_KEY = 'comfortable_ai_torn_api_key';
const SETTINGS_KEY = 'comfortable_ai_settings';

export const DEFAULT_SETTINGS = {energyWarningMinutes: 15, nerveWarningMinutes: 15, cooldownAlerts: true};

export async function saveApiKey(value) { await SecureStore.setItemAsync(API_KEY, value); }
export async function getApiKey() { return SecureStore.getItemAsync(API_KEY); }
export async function clearApiKey() { await SecureStore.deleteItemAsync(API_KEY); }
export async function loadSettings() {
  try {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    return raw ? {...DEFAULT_SETTINGS, ...JSON.parse(raw)} : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}
export async function saveSettings(settings) { await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings)); }
