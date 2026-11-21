export const TIERS = { platinum: 1, gold: 2, silver: 6, bronze: 46 };
export const SAVE_KEY = 'leonida-ledger-v2';
export const LEGACY_KEY = 'leonida-ledger-v1';
export const ORDERS = ['route', 'source', 'name', 'points', 'unlocked'];
export const ROUTE = [
  ['story', 'Main story', 'Turn cheats off to keep saves and trophies enabled. Take Lucia up on her Chapter 1 meditation invite.'],
  ['missions', 'Story jobs', 'The mission trophies arrive during the campaign. The supplied notes report no mission replay or New Game+.'],
  ['people', 'People & places', 'Check your texts for new jobs and switch protagonists if a contact only deals with one of them.'],
  ['activities', 'Challenges', 'Try each pastime early, then revisit the ranges, races and stunt spots to meet the higher completion targets.'],
  ['discoveries', 'Collections', 'Scan and collect as you travel. Discoveries made during the story carry over to the completion checklist.'],
  ['free-roam', 'Free roam', 'After the finale, open Progress → Stats → 100% Completion. The platinum also requires every standalone trophy. The notes estimate about 200 hours overall.'],
];

export function validateCatalogue(entries) {
  const counts = new Map();
  const ids = new Set();
  let score = 0;
  for (const entry of entries) {
    ids.add(entry.id);
    counts.set(entry.tier, (counts.get(entry.tier) ?? 0) + 1);
    score += entry.points;
  }
  if (entries.length !== 55 || ids.size !== 55 || score !== 1000 ||
      Object.entries(TIERS).some(([tier, total]) => counts.get(tier) !== total)) {
    throw new Error('The catalogue does not match the published reward totals.');
  }
}

export function newJournal() {
  return {
    earned: new Set(),
    revealed: new Set(),
    options: { spoilers: true, view: 'cards', sort: 'route' },
  };
}

export function updatePlatinum(entries, earned) {
  const platinum = entries.find(entry => entry.tier === 'platinum');
  if (!platinum) return;
  earned.delete(platinum.id);
  if (entries.every(entry => entry === platinum || earned.has(entry.id))) earned.add(platinum.id);
}

export function covered(entry, journal) {
  return entry.hidden && journal.options.spoilers &&
    !journal.earned.has(entry.id) && !journal.revealed.has(entry.id);
}

export function visibleName(entry, journal) {
  return covered(entry, journal) ? 'Hidden trophy' : entry.name;
}

export function searchCatalogue(entries, journal, { query, filter, tier, stage }) {
  const predicates = {
    all: () => true,
    story: entry => entry.story,
    hidden: entry => entry.hidden,
    missable: entry => entry.missable,
    earned: entry => journal.earned.has(entry.id),
  };
  const words = query.toLowerCase().match(/\S+/g) ?? [];
  const results = entries.filter(entry => {
    if ((tier && tier !== entry.tier) || (stage && stage !== entry.phase) || !predicates[filter](entry)) return false;
    const text = covered(entry, journal)
      ? ['hidden trophy', entry.tier, entry.phase]
      : [entry.name, entry.description, entry.guide, entry.category, entry.tier];
    const index = text.join(' ').toLowerCase();
    return words.every(word => index.includes(word));
  });

  const rank = Object.keys(TIERS);
  const compare = {
    route: (a, b) => rank.indexOf(a.tier) - rank.indexOf(b.tier),
    name: (a, b) => visibleName(a, journal).localeCompare(visibleName(b, journal)),
    points: (a, b) => b.points - a.points,
    unlocked: (a, b) => Number(journal.earned.has(a.id)) - Number(journal.earned.has(b.id)),
  }[journal.options.sort];
  return compare ? results.sort(compare) : results;
}

export function progressFor(entries, earned) {
  const tiers = Object.fromEntries(Object.keys(TIERS).map(tier => [tier, 0]));
  let count = 0;
  let score = 0;
  for (const entry of entries) {
    if (!earned.has(entry.id)) continue;
    count++;
    score += entry.points;
    tiers[entry.tier]++;
  }
  return { count, score, tiers, percent: entries.length ? count / entries.length * 100 : 0 };
}

export function packJournal({ earned, revealed, options }) {
  return {
    product: 'Leonida Ledger', version: 2, created: new Date().toISOString(),
    earned: Array.from(earned), revealed: Array.from(revealed), options: { ...options },
  };
}

export function readJournal(data, entries) {
  const envelope = Array.isArray(data) ? { product: 'Leonida Ledger', version: 1, earned: data } : data;
  if (envelope?.product !== 'Leonida Ledger' || ![1, 2].includes(envelope.version)) {
    throw new Error('Choose a Leonida Ledger backup.');
  }
  const lookup = new Map();
  entries.forEach(({ id, name }, index) => {
    lookup.set(index + 1, id);
    lookup.set(id, id);
    lookup.set(name.toLowerCase(), id);
  });

  function readIds(list) {
    if (!Array.isArray(list) || list.length > 500) throw new Error('The backup has an invalid trophy list.');
    const ids = new Set();
    for (const key of list) {
      const id = lookup.get(typeof key === 'string' ? key.toLowerCase() : key);
      if (!id) throw new Error('The backup refers to a trophy outside this catalogue.');
      ids.add(id);
    }
    return ids;
  }

  const journal = newJournal();
  journal.earned = readIds(envelope.earned);
  journal.revealed = readIds(envelope.revealed ?? []);
  const { protected: legacyCover, spoilers, view, sort } = envelope.options ?? envelope.preferences ?? {};
  if (typeof spoilers === 'boolean') journal.options.spoilers = spoilers;
  if (typeof legacyCover === 'boolean') journal.options.spoilers = legacyCover;
  if (view === 'cards' || view === 'list') journal.options.view = view;
  if (ORDERS.includes(sort)) journal.options.sort = sort;
  updatePlatinum(entries, journal.earned);
  return journal;
}
