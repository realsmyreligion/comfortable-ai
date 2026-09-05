import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL = 'torn-alerts';
const SOURCE = 'tornpulse';
const OUR_SOURCES = new Set(['tornpulse', 'comfortable-ai']);

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
  await Promise.all(
    scheduled
      .filter(x => OUR_SOURCES.has(x.content.data?.source))
      .map(x => Notifications.cancelScheduledNotificationAsync(x.identifier))
  );
}

async function schedule(title, body, date, kind) {
  if (!(date instanceof Date) || date.getTime() <= Date.now() + 5000) return;
  await Notifications.scheduleNotificationAsync({
    content: {title, body, sound: 'default', data: {source: SOURCE, kind}},
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: CHANNEL,
    },
  });
}

function atUnix(unixSeconds) {
  return new Date(Number(unixSeconds || 0) * 1000);
}

function warningAt(unixSeconds, minutes) {
  return new Date(Number(unixSeconds || 0) * 1000 - Number(minutes || 0) * 60_000);
}

export async function scheduleSnapshotAlerts(snapshot, settings) {
  await clearOurAlerts();

  if (snapshot.energy.full_time > 0) {
    await schedule('ϟ Energy warning', `Energy reaches cap in ${settings.energyWarningMinutes} minutes.`, warningAt(snapshot.energy.full_time, settings.energyWarningMinutes), 'energy-warning');
    await schedule('ϟ Energy full', 'Your Energy is full.', atUnix(snapshot.energy.full_time), 'energy-full');
  }

  if (snapshot.nerve.full_time > 0) {
    await schedule('✺ Nerve warning', `Nerve reaches cap in ${settings.nerveWarningMinutes} minutes.`, warningAt(snapshot.nerve.full_time, settings.nerveWarningMinutes), 'nerve-warning');
    await schedule('✺ Nerve full', 'Your Nerve is full.', atUnix(snapshot.nerve.full_time), 'nerve-full');
  }

  if (settings.cooldownAlerts) {
    const now = Date.now();
    if (snapshot.cooldowns.drug > 5) await schedule('💊 Drug ready', 'Your drug cooldown is clear.', new Date(now + snapshot.cooldowns.drug * 1000), 'drug');
    if (snapshot.cooldowns.booster > 5) await schedule('🥤 Booster ready', 'Your booster cooldown is clear.', new Date(now + snapshot.cooldowns.booster * 1000), 'booster');
    if (snapshot.cooldowns.medical > 5) await schedule('✚ Medical ready', 'Your medical cooldown is clear.', new Date(now + snapshot.cooldowns.medical * 1000), 'medical');
  }

  const travel = snapshot.travel;
  if (travel?.active && Number(travel.arrival) > Math.floor(Date.now() / 1000)) {
    const destination = travel.destination || 'your destination';
    await schedule('✈ Landing soon', `You land in ${destination} in 5 minutes. Get ready to act.`, warningAt(travel.arrival, 5), 'travel-warning');
    await schedule('✈ Expected arrival', `Your scheduled arrival time in ${destination} has been reached. Open Torn to confirm your status.`, atUnix(travel.arrival), 'travel-arrival');
  }
}
