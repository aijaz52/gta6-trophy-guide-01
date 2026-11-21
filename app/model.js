// The checklist's rules live here so storage, imports and the screen agree.
export const SAVE_SLOT = 'leonida-ledger-v1';
export const OLD_SLOT = 'gta6-trophy-checklist';
export const SETTINGS = Object.freeze({ protected: true, sort: 'recommended', view: 'grid' });
export const JOURNEY = [
  { key: 'story', label: 'Story', title: 'Follow the story', advice: 'Keep cheats off. Accept Lucia’s Chapter 1 balcony meditation after Down to Earth. The notes report one playthrough, no replay, no difficulty selection and no New Game+. Some chapter rewards arrive in the next chapter.' },
  { key: 'missions', label: 'Missions', title: 'Finish the headline jobs', advice: 'Collect the six mission rewards while progressing through Chapters 2–5. The finale leaves free roam available for the rest of your checklist.' },
  { key: 'characters', label: 'Characters', title: 'Answer those messages', advice: 'Follow optional contacts as their texts arrive. Andy requires Lucia; Tyrone requires Jason. Unlock Yasmani’s Snap Gun in Chapter 3. Check the game’s counter for qualifying stranger strands: not every contact counts.' },
  { key: 'challenges', label: 'Challenges', title: 'Practice around the state', advice: 'For 100%, aim for 300 stunts, 70 of 80 challenges, all 42 drone races, 42 range golds across 12 ranges and all 15 Bret jobs. The meditation trophy needs a counter of 18, beyond the completion checklist’s 15.' },
  { key: 'collections', label: 'Collections', title: 'Read the landscape', advice: 'Finish three card sets, record 100 WAiNK It locations and scan 100 vehicle models. Keep scanning to 200 for 100% completion. Flying helps uncover the map.' },
  { key: 'misc', label: 'Final sweep', title: 'Close the Ledger', advice: 'After the credits, consult Progress → Stats → 100% Completion. Earlier work counts. Finish all 8 vaults, 39 gang operations and underwater discoveries, plus the other listed categories. Platinum also requires every trophy outside the 100% checklist.' },
];
const priority = ['positive-mental-attitude', 'vice-got-a-price', 'a-long-road', 'cunning-stunts', 'the-shootist', 'master-of-none'];
const tierOrder = ['platinum', 'gold', 'silver', 'bronze'];
const nameKey = text => String(text).toLowerCase().replace(/[‘’]/g, "'").replace(/\.$/, '');

export function newLedger() {
  return { earned: new Set(), revealed: new Set(), prefs: { ...SETTINGS }, filter: 'all', tier: 'all', phase: '', query: '' };
}

export function shielded(trophy, ledger) {
  return Boolean(trophy.hidden && ledger.prefs.protected && !ledger.revealed.has(trophy.id) && !ledger.earned.has(trophy.id));
}

export function settlePlatinum(ledger, catalogue) {
  for (const trophy of catalogue.filter(item => item.tier === 'platinum')) {
    const ready = catalogue.filter(item => item.id !== trophy.id).every(item => ledger.earned.has(item.id));
    ledger.earned[ready ? 'add' : 'delete'](trophy.id);
  }
  return ledger;
}

export function totals(catalogue, earned) {
  const owned = catalogue.filter(item => earned.has(item.id));
  return { earned: owned.length, left: catalogue.length - owned.length, score: owned.reduce((sum, item) => sum + item.points, 0), percent: catalogue.length ? 100 * owned.length / catalogue.length : 0 };
}

export function itinerary(catalogue, ledger) {
  const stages = JOURNEY.map(stage => {
    const members = catalogue.filter(item => item.phase === stage.key);
    return { ...stage, total: members.length, done: members.filter(item => ledger.earned.has(item.id)).length, urgent: members.some(item => item.missable && !ledger.earned.has(item.id)) };
  });
  const next = stages.find(stage => stage.urgent) ?? stages.find(stage => stage.done > 0 && stage.done < stage.total) ?? stages.find(stage => stage.done < stage.total);
  return stages.map(stage => ({ ...stage, next: stage === next }));
}

export function visibleTrophies(catalogue, ledger) {
  const terms = ledger.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const rank = trophy => priority.includes(trophy.id) ? priority.indexOf(trophy.id) : catalogue.indexOf(trophy) + priority.length;
  const safeName = trophy => shielded(trophy, ledger) ? 'Hidden trophy' : trophy.name;
  const compare = {
    recommended: (a, b) => rank(a) - rank(b),
    source: (a, b) => catalogue.indexOf(a) - catalogue.indexOf(b),
    name: (a, b) => safeName(a).localeCompare(safeName(b)),
    tier: (a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier),
    points: (a, b) => b.points - a.points,
    unearned: (a, b) => Number(ledger.earned.has(a.id)) - Number(ledger.earned.has(b.id)) || rank(a) - rank(b),
  }[ledger.prefs.sort];
  return catalogue.filter(trophy => {
    const matches = { all: true, earned: ledger.earned.has(trophy.id), story: trophy.story, hidden: trophy.hidden, missable: trophy.missable };
    if (!matches[ledger.filter] || (ledger.tier !== 'all' && ledger.tier !== trophy.tier) || (ledger.phase && ledger.phase !== trophy.phase)) return false;
    const words = shielded(trophy, ledger)
      ? ['hidden trophy', trophy.tier, trophy.phase, trophy.story ? 'story' : '']
      : [trophy.name, trophy.description, ...trophy.guide, trophy.tier, trophy.phase, trophy.category, trophy.missable ? 'missable' : ''];
    const searchable = words.join(' ').toLocaleLowerCase();
    return terms.every(term => searchable.includes(term));
  }).sort((a, b) => (compare ?? ((x, y) => rank(x) - rank(y)))(a, b) || catalogue.indexOf(a) - catalogue.indexOf(b));
}

export function exportLedger(ledger) {
  return { game: 'Grand Theft Auto VI', version: 1, exportedAt: new Date().toISOString(), earned: Array.from(ledger.earned), revealed: Array.from(ledger.revealed), preferences: { ...ledger.prefs } };
}

export function readLedger(payload, catalogue) {
  const oldFormat = Array.isArray(payload);
  if (!oldFormat && (!payload || payload.game !== 'Grand Theft Auto VI' || payload.version !== 1)) throw new Error('Use a version 1 Ledger backup or an original checklist array.');
  const lookup = new Map(catalogue.flatMap(trophy => [[trophy.id, trophy.id], [nameKey(trophy.name), trophy.id]]));
  const decode = values => {
    if (!Array.isArray(values) || values.length > 1000) throw new Error('The backup needs a trophy array of at most 1,000 entries.');
    return new Set(values.map(value => {
      const id = typeof value === 'string' ? lookup.get(value) ?? lookup.get(nameKey(value)) : Number.isInteger(value) && value > 0 ? catalogue[value - 1]?.id : undefined;
      if (!id) throw new Error('The backup contains an unknown trophy.');
      return id;
    }));
  };
  const result = newLedger();
  result.earned = decode(oldFormat ? payload : payload.earned);
  result.revealed = decode(oldFormat ? [] : payload.revealed ?? []);
  const preferences = oldFormat ? {} : payload.preferences ?? {};
  if (typeof preferences.protected === 'boolean') result.prefs.protected = preferences.protected;
  if (['grid', 'list'].includes(preferences.view)) result.prefs.view = preferences.view;
  if (['recommended', 'source', 'name', 'tier', 'points', 'unearned'].includes(preferences.sort)) result.prefs.sort = preferences.sort;
  return settlePlatinum(result, catalogue);
}
