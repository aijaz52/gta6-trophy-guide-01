export const STORAGE_KEY = 'leonida-ledger-v2';
export const OLD_STORAGE_KEY = 'leonida-ledger-v1';

export const STAGES = [
  { id: 'story', label: 'Main story', tip: 'Follow the chapters at your own pace. Cheats disable trophies and saving; keep them off during a trophy run.' },
  { id: 'missions', label: 'Story jobs', tip: 'Six mission rewards arrive as the story unfolds. The finale leaves the state open for free-roam pursuits.' },
  { id: 'people', label: 'People & places', tip: 'Optional characters text when new work is ready. Keep an eye on who you play as and on the game’s stranger-strand counter.' },
  { id: 'activities', label: 'Challenges', tip: 'Try races, ranges, stunts, hunting and the many diversions around the state. Some 100% targets go beyond trophy thresholds.' },
  { id: 'discoveries', label: 'Collections', tip: 'Scan, photograph, explore and pick up collectibles while you travel. Earlier discoveries count toward the final checklist.' },
  { id: 'free-roam', label: 'Free roam', tip: 'After the credits, use Progress → Stats → 100% Completion to see what remains. Platinum also asks for every separate trophy.' },
];

export function freshJournal() {
  return { earned: new Set(), revealed: new Set(), filter: 'all', tier: 'all', stage: '', search: '', sort: 'route', view: 'cards', spoilers: true };
}

export function isConcealed(item, journal) {
  return Boolean(item.hidden && journal.spoilers && !journal.earned.has(item.id) && !journal.revealed.has(item.id));
}

export function settlePlatinum(journal, trophies) {
  const platinum = trophies.find(item => item.tier === 'platinum');
  if (platinum) {
    const complete = trophies.filter(item => item.id !== platinum.id).every(item => journal.earned.has(item.id));
    journal.earned[complete ? 'add' : 'delete'](platinum.id);
  }
  return journal;
}

export function getProgress(trophies, earned) {
  const unlocked = trophies.filter(item => earned.has(item.id));
  return {
    count: unlocked.length,
    score: unlocked.reduce((sum, item) => sum + item.points, 0),
    percent: trophies.length ? (unlocked.length / trophies.length) * 100 : 0,
  };
}

export function getStages(trophies, journal) {
  const stages = STAGES.map(stage => {
    const entries = trophies.filter(item => item.phase === stage.id);
    return { ...stage, total: entries.length, done: entries.filter(item => journal.earned.has(item.id)).length,
      urgent: entries.some(item => item.missable && !journal.earned.has(item.id)) };
  });
  const next = stages.find(stage => stage.urgent) ?? stages.find(stage => stage.done < stage.total);
  return stages.map(stage => ({ ...stage, next: stage.id === next?.id }));
}

export function selectTrophies(trophies, journal) {
  const terms = journal.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const tierRank = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
  const order = journal.sort;
  const filtered = trophies.filter(item => {
    if (journal.tier !== 'all' && item.tier !== journal.tier) return false;
    if (journal.stage && journal.stage !== item.phase) return false;
    if (journal.filter === 'earned' && !journal.earned.has(item.id)) return false;
    if (journal.filter === 'story' && !item.story) return false;
    if (journal.filter === 'hidden' && !item.hidden) return false;
    if (journal.filter === 'missable' && !item.missable) return false;
    const concealed = isConcealed(item, journal);
    const searchable = concealed
      ? `hidden trophy ${item.tier} ${item.phase}`
      : `${item.name} ${item.description} ${item.guide} ${item.category} ${item.tier}`;
    return terms.every(term => searchable.toLocaleLowerCase().includes(term));
  });
  const base = trophies.indexOf.bind(trophies);
  return filtered.sort((a, b) => {
    if (order === 'name') return (isConcealed(a, journal) ? 'Hidden trophy' : a.name).localeCompare(isConcealed(b, journal) ? 'Hidden trophy' : b.name);
    if (order === 'points') return b.points - a.points || base(a) - base(b);
    if (order === 'unlocked') return Number(journal.earned.has(a.id)) - Number(journal.earned.has(b.id)) || base(a) - base(b);
    if (order === 'source') return base(a) - base(b);
    return tierRank[a.tier] - tierRank[b.tier] || base(a) - base(b);
  });
}

export function exportJournal(journal) {
  return { product: 'Leonida Ledger', version: 2, created: new Date().toISOString(), earned: [...journal.earned], revealed: [...journal.revealed], options: { spoilers: journal.spoilers, view: journal.view, sort: journal.sort } };
}

export function importJournal(value, trophies) {
  const isLegacy = Array.isArray(value);
  if (!isLegacy && (!value || value.product !== 'Leonida Ledger' || ![1, 2].includes(value.version))) {
    throw new Error('This file is not a Leonida Ledger backup.');
  }
  const ids = new Set(trophies.map(item => item.id));
  const names = new Map(trophies.map(item => [item.name.toLocaleLowerCase(), item.id]));
  const decode = list => {
    if (!Array.isArray(list) || list.length > 500) throw new Error('The backup contains an invalid trophy list.');
    return new Set(list.map(entry => {
      const id = typeof entry === 'string' ? (ids.has(entry) ? entry : names.get(entry.toLocaleLowerCase())) : Number.isInteger(entry) ? trophies[entry - 1]?.id : null;
      if (!id || !ids.has(id)) throw new Error('The backup includes an unknown trophy.');
      return id;
    }));
  };
  const journal = freshJournal();
  journal.earned = decode(isLegacy ? value : value.earned);
  journal.revealed = decode(isLegacy ? [] : value.revealed ?? []);
  const options = isLegacy ? {} : (value.options ?? value.preferences ?? {});
  if (typeof options.spoilers === 'boolean') journal.spoilers = options.spoilers;
  if (typeof options.protected === 'boolean') journal.spoilers = options.protected;
  if (['cards', 'list'].includes(options.view)) journal.view = options.view;
  if (['route', 'source', 'name', 'points', 'unlocked'].includes(options.sort)) journal.sort = options.sort;
  return settlePlatinum(journal, trophies);
}
