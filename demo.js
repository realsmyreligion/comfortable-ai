export function makeDemo() {
  const now = Math.floor(Date.now() / 1000);
  return {
    life: {current: 4850, maximum: 5000, increment: 50, interval: 300, tick_time: now + 120, full_time: now + 900},
    energy: {current: 125, maximum: 150, increment: 5, interval: 600, tick_time: now + 240, full_time: now + 3000},
    nerve: {current: 38, maximum: 45, increment: 1, interval: 300, tick_time: now + 120, full_time: now + 2100},
    happy: {current: 4200, maximum: 5000, increment: 0, interval: 0, tick_time: 0, full_time: 0},
    cooldowns: {drug: 3100, booster: 0, medical: 1100},
    profile: {id: 1234567, name: 'Mr. Comfortable'},
    status: {state:'Okay', description:'Everything looks good.', details:null, until:null, color:'green'},
    travel: {active:false, destination:'', origin:'Torn City', arrival:0, departed:0},
    attackAccess: true,
    lastIncomingAttack: null,
    fetchedAt: Date.now(),
    demo: true,
  };
}
