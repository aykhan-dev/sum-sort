/* ================= meta game (pure, no rendering): combos, daily puzzle, streaks, sharing ================= */
import { generateWith, mulberry32 } from './logic.mjs';

/* Combo: jars sealed in a row with no wasted move between them. A tile from a stack into a numbered jar keeps the
   chain going, because that is the only kind of move a par game is made of. Anything else (a jar-to-jar move, the
   spare jar, an undo, a split) ends it. The first seal is its own reward; from the second on, a word rises from the
   jar, and the words climb with the chain. */
export const COMBO_WORDS = ['', '', 'Sweet!', 'Tasty!', 'Yummy!', 'Delicious!', 'Sugar rush!'];
export const comboWord = n => n < 2 ? '' : COMBO_WORDS[Math.min(n, COMBO_WORDS.length - 1)];
/* the chain after one move; `clean` = stack to numbered jar, `seals` = the move sealed that jar */
export const comboStep = (chain, { clean, seals }) => !clean ? 0 : seals ? chain + 1 : chain;

/* ---------------- daily puzzle ----------------
   One board per calendar day, the same for everyone who opens it on that date, wherever they are: the board is
   seeded from the date's text ("2026-10-03"), not from a clock. Monday is gentle and the week climbs to Sunday,
   the way newspaper puzzles do. Only rules every player has learned by the time the daily opens: sums, no frosted
   tiles, no ribbons. The model fail rate stays under the game's 65% cap. */
export const DAILY_OPENS = 19;            // the first Sums level: everything a daily asks for has been taught
export const DAILY_FIRST = '2026-10-01';   // daily #1; the pool in src/dailies.json starts here
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAILY_RECIPES = [   // Monday first; `want` is the model fail rate, measured offline (scripts/generate-dailies.mjs)
  { level: 'Easy', jars: 4, stacks: 3, parts: [2, 2], minT: 5, maxT: 11, want: 0.20 },
  { level: 'Easy', jars: 4, stacks: 3, parts: [2, 3], minT: 6, maxT: 12, want: 0.28 },
  { level: 'Medium', jars: 5, stacks: 4, parts: [2, 3], minT: 6, maxT: 14, want: 0.36 },
  { level: 'Medium', jars: 5, stacks: 4, parts: [2, 3], minT: 7, maxT: 15, want: 0.42 },
  { level: 'Tricky', jars: 5, stacks: 4, parts: [2, 3], minT: 7, maxT: 16, want: 0.48 },
  { level: 'Hard', jars: 6, stacks: 5, parts: [2, 3], minT: 7, maxT: 16, want: 0.54 },
  { level: 'Hard', jars: 6, stacks: 5, parts: [2, 3], minT: 7, maxT: 17, want: 0.60 }
];
export const DAILY_CAP = 0.65;
const pad2 = n => String(n).padStart(2, '0');
/* the player's own calendar date, as text */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const keyUTC = key => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const DAILY_EPOCH = keyUTC(DAILY_FIRST);
export const addDays = (key, n) => { const d = new Date(keyUTC(key) + n * 86400000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; };
export const dailyNumber = key => Math.round((keyUTC(key) - DAILY_EPOCH) / 86400000) + 1;
export const weekdayOf = key => (new Date(keyUTC(key)).getUTCDay() + 6) % 7;   // 0 = Monday
export const weekOf = key => Array.from({ length: 7 }, (_, i) => addDays(key, i - weekdayOf(key)));   // Monday to Sunday
/* every daily of a week, Monday to Sunday, earns a bonus once, on the win that completes it */
export const WEEK_BONUS = 5;
export const fullWeek = (key, has) => weekOf(key).every(has);
/* the full week is still open on `key` if no earlier day of its week was missed (or came before the first daily) */
export const weekStillOpen = (key, has) => weekOf(key).every(k => k >= key || (k >= DAILY_FIRST && has(k)));
export const dailyLabel = key => { const d = new Date(keyUTC(key)); return `${WEEKDAYS[weekdayOf(key)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
export const dailyRecipe = key => ({ ch: 'daily', ...DAILY_RECIPES[weekdayOf(key)] });
/* FNV-1a over the date text: a different, stable seed for every day */
export function dailySeed(key) {
  let h = 0x811C9DC5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/* Dailies come from a pool made offline and checked by the solver (src/dailies.json, one per day from daily #1).
   Past the end of the pool the device makes its own: the same seed on every device, cheaper settings. */
export function dailyFromPool(pool, key) {
  const raw = pool[dailyNumber(key) - 1];
  return raw ? { jars: raw.j, stacks: raw.s, par: raw.p, daily: key } : null;
}
export function generateDaily(key, opts = { tries: 60, runs: 400, tol: 0.06 }) {
  const r = dailyRecipe(key), seed = dailySeed(key);
  let pick = null, easiest = null;   // the board nearest the target within the cap; failing that, the easiest one made
  for (let salt = 0; salt < 16 && !(pick && Math.abs(pick.fail - r.want) <= 0.05); salt++) {
    const d = generateWith(r, mulberry32(seed + salt * 0x9E3779B1), opts);
    if (!d) continue;
    if (!easiest || d.fail < easiest.fail) easiest = d;
    if (d.fail <= DAILY_CAP && (!pick || Math.abs(d.fail - r.want) < Math.abs(pick.fail - r.want))) pick = d;
  }
  const def = pick || easiest;
  return def && { ...def, daily: key };
}
/* days from one date key to another (1 = the next day); Infinity without a first date */
export const dayGap = (from, to) => from ? Math.round((keyUTC(to) - keyUTC(from)) / 86400000) : Infinity;
/* Streak: dailies finished on consecutive days. Finishing today's again changes nothing; a missed day starts over,
   unless a freeze covers it. A freeze is earned on each milestone from a week up (at most two held), and spent by
   itself the day it saves the streak: `saved` says the last daily used one, `earned` that it brought one. */
export const FREEZE_MAX = 2;
export function streakAfter(streak, key) {
  const s = { count: 0, best: 0, last: null, freezes: 0, ...(streak || {}) };
  const gap = dayGap(s.last, key);
  if (gap <= 0) return s;   // today's again, or an older day's board finished later (another timezone, a second tab)
  let freezes = s.freezes || 0, saved = false, count = 1;
  if (gap === 1) count = s.count + 1;
  else if (gap === 2 && freezes > 0) { count = s.count + 1; freezes--; saved = true; }
  const earned = count >= 7 && STREAK_MILESTONES.includes(count) && freezes < FREEZE_MAX;
  if (earned) freezes++;
  return { count, best: Math.max(s.best, count), last: key, freezes, saved, earned };
}
/* Days in a row worth a celebration of their own, like finishing a chapter. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];
export const streakMilestone = n => STREAK_MILESTONES.includes(n) ? n : 0;
/* Bonus stars on a daily won on a streak: +1 from three days in a row, +2 from a week, +3 from two weeks */
export const streakBonus = n => n >= 14 ? 3 : n >= 7 ? 2 : n >= 3 ? 1 : 0;
/* the streak as it stands today: still alive if the last daily was today or yesterday, or the day before with a freeze */
export const streakNow = (streak, today) => {
  if (!streak) return 0;
  const gap = dayGap(streak.last, today);
  // today or yesterday (or later: a clock set back, which streakAfter leaves alone too), or a missed day with a freeze in hand
  return gap <= 1 || (gap === 2 && streak.freezes > 0) ? streak.count : 0;
};
export const msToNextDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d;
/* A streak of two days or more is at risk in the day's last six hours, unless a freeze would cover the miss */
export const RISK_HOURS = 6;
export const streakAtRisk = (count, freezes, msLeft) => count >= 2 && !freezes && msLeft < RISK_HOURS * 3600000;
export const hoursMinutes = ms => { const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60; return `${h ? h + 'h ' : ''}${m}m`; };

/* ---------------- sharing ----------------
   A result anyone can paste anywhere, with nothing given away about the board: stars, moves against par, one square
   per jar in the order it sealed (green: a clean seal, yellow: part of a combo, purple: sealed after a reshuffle),
   the streak, and the link. */
export const SEAL_SQUARES = { clean: '🟩', combo: '🟨', messy: '🟪' };
export const sealSquare = chainAtSeal => chainAtSeal >= 2 ? SEAL_SQUARES.combo : chainAtSeal === 1 ? SEAL_SQUARES.clean : SEAL_SQUARES.messy;
export function shareText({ title, stars, moves, par, seals = [], boosters = 0, streak = 0, url = '' }) {
  const lines = [`${title} ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}`];
  lines.push(`${moves} moves, par ${par}${boosters ? ` · ${boosters} booster${boosters === 1 ? '' : 's'}` : ' · no boosters'}`);
  if (seals.length) lines.push(seals.map(sealSquare).join(''));
  if (streak > 1) lines.push(`🔥 ${streak}-day streak`);
  if (url) lines.push(url);
  return lines.join('\n');
}
/* the page's own address, fit for sharing: no query, no hash, nothing for a local file */
export const shareUrl = loc => loc && /^https?:$/.test(loc.protocol) ? loc.origin + loc.pathname.replace(/index\.html$/, '') : '';

/* ---------------- the journey ----------------
   Near goals pull harder than far ones, so home always names the next thing a player is working towards:
   where they stand in the chapter, and what opens next (a booster, a new rule, the daily) and how far it is. */
export const MILESTONES = [
  { at: 11, what: 'two-tile jars' }, { at: 11, what: 'the Undo booster' }, { at: 13, what: 'the Hint booster' },
  { at: 15, what: 'the +1 Jar booster' }, { at: 19, what: 'bigger sums' }, { at: 19, what: 'the daily puzzle' },
  { at: 21, what: 'the Split booster' }, { at: 25, what: 'Sugar Rush' }, { at: 31, what: 'frosted tiles' }, { at: 39, what: 'ribbon-tied jars' },
  { at: 47, what: 'endless mixed levels' }
];
/* what opens next for a player about to play level n: { at, left, what } with everything opening at that level, or null */
export function upNext(n, list = MILESTONES) {
  const ahead = list.filter(m => m.at > n);
  if (!ahead.length) return null;
  const at = Math.min(...ahead.map(m => m.at)), what = ahead.filter(m => m.at === at).map(m => m.what);
  return { at, left: at - n, what: what.length > 1 ? what.slice(0, -1).join(', ') + ' and ' + what.at(-1) : what[0] };
}
/* where level n sits in its stretch of the journey: a chapter, or a run of ten in the endless levels */
export function stretchOf(n, chapter) {
  if (chapter.to !== Infinity) return { from: chapter.from, to: chapter.to, done: n - chapter.from, size: chapter.to - chapter.from + 1 };
  const from = chapter.from + Math.floor((n - chapter.from) / 10) * 10;
  return { from, to: from + 9, done: n - from, size: 10 };
}

/* ---------------- candy boxes ----------------
   Stars buy nothing in a shop; they open boxes. Each box holds a new counter for the candy shop: the room around the
   board changes colour. Boxes come further apart as the stars pile up, about one every ten levels at first.
   Every counter is a light pastel, so ink keeps its contrast on all of them. */
export const THEMES = [
  { id: 'strawberry', name: 'Strawberry', at: 0, sky: ['#E9DCFF', '#FFE0D2', '#FFD3C2'], counter: '#F6D8CF', stage: '#F7DAD0', wash: 'rgba(250,225,216,.66)' },
  { id: 'mint', name: 'Mint Parlour', at: 15, sky: ['#D6F2EA', '#E6F6EE', '#C7ECDF'], counter: '#CBEADF', stage: '#D0EDE2', wash: 'rgba(212,238,228,.7)' },
  { id: 'lemon', name: 'Lemon Drop', at: 40, sky: ['#FFF4C7', '#FFEFD5', '#FAE0A8'], counter: '#F6E4B2', stage: '#F8E8BA', wash: 'rgba(250,238,198,.7)' },
  { id: 'blueberry', name: 'Blueberry Milk', at: 70, sky: ['#D9E3FF', '#E6EBFF', '#C9D6F6'], counter: '#CFDAF4', stage: '#D3DDF5', wash: 'rgba(218,226,248,.7)' },
  { id: 'cotton', name: 'Cotton Candy', at: 105, sky: ['#FFD6EC', '#E8DFFF', '#D3E5FF'], counter: '#F0D3E8', stage: '#F0D7EA', wash: 'rgba(244,220,236,.7)' },
  { id: 'caramel', name: 'Salted Caramel', at: 145, sky: ['#FBE4CF', '#F5DAC1', '#F2D5B9'], counter: '#EACFB2', stage: '#ECD3BA', wash: 'rgba(240,218,196,.7)' },
  { id: 'grape', name: 'Grape Soda', at: 190, sky: ['#E4D7FF', '#EDE2FF', '#DED2F7'], counter: '#D9CAF2', stage: '#E2D6F6', wash: 'rgba(226,216,246,.7)' },
  { id: 'peach', name: 'Peach Fizz', at: 240, sky: ['#FFE1D3', '#FFEADB', '#FFCDB4'], counter: '#F9D0BA', stage: '#FAD5C2', wash: 'rgba(250,224,210,.7)' }
];
export const themeById = id => THEMES.find(t => t.id === id) || THEMES[0];
export const themesOwned = stars => THEMES.filter(t => stars >= t.at);
/* the next box: { at, left, theme } or null once every box is open */
export function nextBox(stars) {
  const t = THEMES.find(x => x.at > stars);
  return t ? { at: t.at, left: t.at - stars, theme: t } : null;
}
/* boxes a win just opened: the themes between the star totals before and after it */
export const boxesOpened = (before, after) => THEMES.filter(t => t.at > before && t.at <= after);
/* how far the stars are from the last box to the next, 0..1, for the progress ring */
export function boxProgress(stars) {
  const n = nextBox(stars); if (!n) return 1;
  const prev = [...THEMES].reverse().find(t => t.at <= stars);
  return (stars - prev.at) / (n.at - prev.at);
}

/* ---------------- Sugar Rush ----------------
   A timed run of small boards, for when one level at a time is not enough. A minute on the clock; every board
   cleared adds time back. A seal scores more inside a combo, so clean play beats fast mistakes. Boards grow as the run
   goes on, and every run is new. It opens once the daily and every booster are known, and uses no boosters. */
export const RUSH_OPENS = 25;
export const RUSH = { start: 60, perBoard: 8, cap: 90, seal: 10, clear: 25, skip: 5 };
const RUSH_STEPS = [   // [from round, recipe]: small and kind first, a little bigger as the run goes on
  [0, { jars: 3, stacks: 3, parts: [2, 2], minT: 5, maxT: 11, want: 0.20 }],
  [2, { jars: 3, stacks: 3, parts: [2, 3], minT: 5, maxT: 12, want: 0.25 }],
  [5, { jars: 4, stacks: 3, parts: [2, 2], minT: 5, maxT: 12, want: 0.30 }],
  [9, { jars: 4, stacks: 4, parts: [2, 3], minT: 6, maxT: 13, want: 0.35 }]
];
export const rushRecipe = round => ({ ch: 'rush', ...RUSH_STEPS.filter(([from]) => round >= from).at(-1)[1] });
/* One attempt at a board for this run, round and salt: { def, good } where good = within 10 points of the target.
   An attempt takes a few ms, rarely a quarter second, so the page can spread attempts over idle moments. */
export const RUSH_SALTS = 8;
export function rushTry(seed, round, salt) {
  const r = rushRecipe(round), def = generateWith(r, mulberry32((seed + round * 7919 + salt * 104729) >>> 0), { tries: 80, runs: 120, tol: 0.08 });
  return { def, good: !!def && Math.abs(def.fail - r.want) <= 0.1 };
}
/* a board for this run and round, all at once: the first good attempt, or failing that the first board made */
export function rushBoard(seed, round) {
  let any = null;
  for (let salt = 0; salt < RUSH_SALTS; salt++) {
    const { def, good } = rushTry(seed, round, salt);
    if (good) return def;
    any = any || def;
  }
  return any;
}
export const rushSealPoints = chain => RUSH.seal * Math.max(1, chain);
/* seconds on the clock after a board is cleared, never past the cap */
export const rushTimeAfterClear = left => Math.min(RUSH.cap, left + RUSH.perBoard);
export function rushShareText({ score, boards, newBest = false, beat = null, url = '' }) {
  const lines = [`Sum Sort Sugar Rush ⚡ ${score}`, `${boards} board${boards === 1 ? '' : 's'} in the rush${newBest ? ' · new best' : ''}`];
  if (beat != null) lines.push(score > beat ? `Beat the challenge of ${beat}!` : `Challenge: ${beat} to beat`);
  if (url) lines.push(`Same boards, your turn: ${url}`);
  return lines.join('\n');
}

/* ---------------- challenge links ----------------
   A shared Sugar Rush result carries its run: the seed and the score. Boards come from the seed alone, so whoever
   opens the link plays the same boards against the same clock, and has a number to beat. */
export function challengeUrl(base, seed, score) {
  return base ? `${base}?rush=${seed >>> 0}&beat=${Math.max(0, Math.floor(score))}` : '';
}
/* ---------------- the daily treat ----------------
   One treat a day from home, just for coming back: stars that count toward the candy boxes. Days in a row climb a
   week of treats to the big one on day 7, then a new week starts; a missed day starts the week over. */
export const TREATS = [1, 1, 2, 2, 3, 3, 6];   // stars, day 1 to day 7
export const TREAT_OPENS = 3;                  // after the first two lessons
export const treatReady = (t, today) => !t || dayGap(t.last, today) >= 1;
/* the day of the week of treats that today is (or was, once opened): the day after yesterday's, day 1 after a gap */
export function treatDay(t, today) {
  if (!t) return 1;
  const gap = dayGap(t.last, today);
  return gap <= 0 ? t.day : gap === 1 ? t.day % 7 + 1 : 1;
}
export function treatAfter(t, today) {
  if (!treatReady(t, today)) return t;
  const day = treatDay(t, today);
  return { day, last: today, stars: (t && t.stars || 0) + TREATS[day - 1], weeks: (t && t.weeks || 0) + (day === 7 ? 1 : 0) };
}

/* A shared daily is a link to the daily: whoever opens it gets a card to play today's board, even before level 19.
   It carries the date it was played and the sharer's moves, for the card to name. */
export function dailyUrl(base, key, moves) {
  return base ? `${base}?daily=${key}${moves > 0 ? `&moves=${Math.floor(moves)}` : ''}` : '';
}
/* the daily in a page address, or null: a real calendar date from the first daily on; moves only when sane */
export function parseDailyLink(search) {
  const q = new URLSearchParams(search || ''), key = q.get('daily'), moves = q.get('moves');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '') || addDays(key, 0) !== key || key < DAILY_FIRST) return null;
  return { key, moves: /^\d{1,3}$/.test(moves || '') && Number(moves) > 0 ? Number(moves) : null };
}
/* the challenge in a page address, or null; anything malformed is ignored */
export function parseChallenge(search) {
  const q = new URLSearchParams(search || ''), seed = q.get('rush'), beat = q.get('beat');
  if (!/^\d{1,10}$/.test(seed || '') || !/^\d{1,6}$/.test(beat || '')) return null;
  const s = Number(seed);
  return s <= 0xFFFFFFFF ? { seed: s, beat: Number(beat) } : null;
}
