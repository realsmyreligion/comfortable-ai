export function makeDemo() {
  const now = Math.floor(Date.now() / 1000);
  return {
    energy: {current: 105, maximum: 150, increment: 5, interval: 600, tick_time: now + 240, full_time: now + 5400},
    nerve: {current: 44, maximum: 52, increment: 1, interval: 300, tick_time: now + 120, full_time: now + 2400},
    cooldowns: {drug: 3100, booster: 9000, medical: 0},
    fetchedAt: Date.now(),
    demo: true,
  };
}
