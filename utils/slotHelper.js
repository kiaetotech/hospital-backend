// Convert "HH:MM AM/PM" to minutes since midnight
const toMinutes = (t) => {
  if (!t) return 0;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
};

// Minutes since midnight → "HH:MM AM/PM"
const fromMinutes = (mins) => {
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`;
};

const expandSessionsToSlots = (sessions, durationMin = 30, maxPerSlot = 1) => {
  const slots = [];
  const seen = new Set();

  for (const s of sessions || []) {
    const startM = toMinutes(s.start);
    const endM = toMinutes(s.end);
    if (!startM || !endM || endM <= startM) continue;

    for (let t = startM; t + durationMin <= endM; t += durationMin) {
      const startTime = fromMinutes(t);
      const endTime = fromMinutes(t + durationMin);
      const key = `${startTime}-${endTime}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({
        startTime,
        endTime,
        maxBookings: Math.max(1, Math.min(5, Number(maxPerSlot) || 1)),
        currentBookings: 0
      });
    }
  }

  slots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return slots;
};

module.exports = { expandSessionsToSlots, toMinutes, fromMinutes };