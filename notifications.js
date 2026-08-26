import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL = 'torn-alerts';
const SOURCE = 'comfortable-ai';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function prepareNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Torn Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 300, 150, 300],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function clearOurAlerts() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter(x => x.content.data?.source === SOURCE).map(x => Notifications.cancelScheduledNotificationAsync(x.identifier)));
}

async function schedule(title, body, date, kind) {
  if (!(date instanceof Date) || date.getTime() <= Date.now() + 5000) return;
  await Notifications.scheduleNotificationAsync({
    content: {title, body, sound: 'default', data: {source: SOURCE, kind}},
    trigger: {type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL},
  });
}

export async function scheduleSnapshotAlerts(snapshot, settings) {
  await clearOurAlerts();
  const warning = (unix, mins) => new Date(unix * 1000 - mins * 60_000);
  if (snapshot.energy.full_time > 0) await schedule('⚡ Energy warning', `Energy reaches cap in ${settings.energyWarningMinutes} minutes.`, warning(snapshot.energy.full_time, settings.energyWarningMinutes), 'energy');
  if (snapshot.nerve.full_time > 0) await schedule('🧠 Nerve warning', `Nerve reaches cap in ${settings.nerveWarningMinutes} minutes.`, warning(snapshot.nerve.full_time, settings.nerveWarningMinutes), 'nerve');
  if (settings.cooldownAlerts) {
    const now = Date.now();
    if (snapshot.cooldowns.drug > 5) await schedule('💊 Drug ready', 'Your drug cooldown is clear.', new Date(now + snapshot.cooldowns.drug * 1000), 'drug');
    if (snapshot.cooldowns.booster > 5) await schedule('🍬 Booster ready', 'Your booster cooldown is clear.', new Date(now + snapshot.cooldowns.booster * 1000), 'booster');
    if (snapshot.cooldowns.medical > 5) await schedule('🏥 Medical ready', 'Your medical cooldown is clear.', new Date(now + snapshot.cooldowns.medical * 1000), 'medical');
  }
}
