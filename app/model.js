// Pure state helpers, shared by the interface and the local regression checks.
export const STORAGE_KEY = 'leonida-ledger-v1';
export const LEGACY_KEY = 'gta6-trophy-checklist';
export const PHASES = [
  { id: 'story', title: 'Story chapters', short: 'Story', detail: 'Play the five story chapters at your own pace. Before advancing in Chapter 1, accept the morning meditation invitation. Keep cheats disabled: the notes say they disable trophies and saving.' },
  { id: 'missions', title: 'Key missions', short: 'Missions', detail: 'Collect the mission-specific story trophies along the way. Several chapter trophies unlock after the beginning of the next chapter, so keep playing if a chapter notification seems delayed.' },
  { id: 'characters', title: 'Character strands', short: 'Characters', detail: 'Follow character texts and optional mission chains as they open. Some jobs require a specific protagonist. In Chapter 3, follow Yasmani’s missions for the Snap Gun needed for an undetected jewelry robbery. In Chapter 4, complete the optional bank-vault unlock mission. Use the in-game counter for the eight qualifying stranger strands; not every character chain counts.' },
  { id: 'challenges', title: 'Activities & challenges', short: 'Challenges', detail: 'Mix races, range practice, stunts, and activities into your travels. Aim beyond the trophy minimums: 300 stunts, 70 of 80 challenges, and all 42 drone races contribute to 100% completion. Earn all 42 shooting-range gold medals across 12 ranges and finish Bret’s 15 hunting tasks. The completion checklist needs 15 of 18 meditations, but the meditation trophy needs the full counter of 18; protect the early Chapter 1 invitation.' },
  { id: 'collections', title: 'Explore & collect', short: 'Collections', detail: 'Finish three card sets, register 100 WAiNK It locations, and scan 100 vehicle models. Continue to 200 vehicle models for 100%, and use flights to clear remaining map fog.' },
  { id: 'misc', title: 'The final sweep', short: 'Miscellaneous', detail: 'Use post-story free roam to finish robberies, purchases, partner activities, and the remaining checklist. For 100%, escape from all 8 bank vault robberies and complete all 39 gang operations, beyond the trophy minimums of 5 vaults and one operation from each of the 9 gangs. Find the underwater discoveries too. After the story, open Progress → Stats → 100% Completion for the authoritative requirements; earlier progress already counts. Reaching 100% is one requirement: earn all other 54 trophies to claim platinum.' },
];

export const DEFAULT_PREFS = { protected: true, view: 'grid', sort: 'recommended' };
const normalizeName = (value) => String(value).replace(/[’‘]/g, "'").replace(/\.$/, '').toLowerCase();

/** Check whether a trophy's details should be hidden from the current view. */
export function isConcealed(trophy, state) {
  return state.prefs.protected && trophy.hidden && !state.earned.has(trophy.id) && !state.revealed.has(trophy.id);
}

/** Summarize earned trophy counts and points. */
export function getTrophyProgress(trophies, earned) {
  let count = 0;
  let points = 0;
  for (const trophy of trophies) {
    if (!earned.has(trophy.id)) continue;
    count++;
    points += trophy.points;
  }
  return {
    count,
    points,
    remaining: trophies.length - count,
    percent: trophies.length ? count / trophies.length * 100 : 0,
  };
}

/** Build phase totals and completion status for the roadmap. */
export function getRoadmapSteps(trophies, earned) {
  const steps = PHASES.map((phase, index) => ({ ...phase, number: index + 1, total: 0, count: 0 }));
  const stepsByPhase = new Map(steps.map(step => [step.id, step]));
  const counted = new Set();
  for (const trophy of trophies) {
    const step = stepsByPhase.get(trophy.phase);
    if (!step || counted.has(trophy.id)) continue;
    counted.add(trophy.id);
    step.total++;
    if (earned.has(trophy.id)) step.count++;
  }
  return steps.map(step => ({ ...step, complete: step.total > 0 && step.count === step.total }));
}

/** Keep platinum earned only when every other trophy is earned. */
export function reconcilePlatinum(earned, trophies) {
  const platinum = trophies.find(t => t.tier === 'platinum');
  if (!platinum) return earned;
  const allOthers = trophies.every(t => t.id === platinum.id || earned.has(t.id));
  if (allOthers) earned.add(platinum.id);
  else earned.delete(platinum.id);
  return earned;
}

/** Validate a backup and convert its progress into current application state. */
export function parseProgress(input, trophies) {
  const legacy = Array.isArray(input);
  if (!legacy && (!input || typeof input !== 'object' || input.version !== 1 || input.game !== 'Grand Theft Auto VI')) {
    throw new Error('Choose a Leonida Ledger version 1 backup or an original checklist export.');
  }
  const entries = legacy ? input : input.earned;
  if (!Array.isArray(entries)) throw new Error('This backup needs an earned-trophy array.');
  const ids = new Set(trophies.map(t => t.id));
  const names = new Map(trophies.map(t => [normalizeName(t.name), t.id]));
  function convert(items) {
    if (!Array.isArray(items) || items.length > 1000) throw new Error('This trophy list is invalid or too large.');
    const result = new Set();
    for (const value of items) {
      let id;
      if (typeof value === 'string') id = ids.has(value) ? value : names.get(normalizeName(value));
      else if (Number.isInteger(value) && value > 0) id = trophies[value - 1]?.id;
      if (!id) throw new Error('This backup contains an unknown trophy. No progress was changed.');
      result.add(id);
    }
    return result;
  }
  const earned = convert(entries);
  const revealed = convert(legacy ? [] : (input.revealed ?? []));
  const prefs = { ...DEFAULT_PREFS };
  if (!legacy && input.preferences && typeof input.preferences === 'object') {
    if (typeof input.preferences.protected === 'boolean') prefs.protected = input.preferences.protected;
    if (['grid', 'list'].includes(input.preferences.view)) prefs.view = input.preferences.view;
    if (['recommended', 'source', 'name', 'tier', 'points', 'unearned'].includes(input.preferences.sort)) prefs.sort = input.preferences.sort;
  }
  return { earned: reconcilePlatinum(earned, trophies), revealed, prefs };
}

/** Create a timestamped export of progress, reveals, and preferences. */
export function makeBackup(state) {
  return { version: 1, game: 'Grand Theft Auto VI', exportedAt: new Date().toISOString(), earned: [...state.earned], revealed: [...state.revealed], preferences: { ...state.prefs } };
}

/** Filter and sort trophies according to the current view state. */
export function selectTrophies(trophies, state) {
  const query = state.query.trim().toLowerCase();
  const selected = trophies.filter(t => {
    if (state.filter === 'story' && !t.story) return false;
    if (state.filter === 'hidden' && !t.hidden) return false;
    if (state.filter === 'missable' && !t.missable) return false;
    if (state.filter === 'earned' && !state.earned.has(t.id)) return false;
    if (state.tier !== 'all' && t.tier !== state.tier) return false;
    if (state.phase && t.phase !== state.phase) return false;
    if (!query) return true;
    // An unrevealed name/description/guide must not become a search spoiler.
    const searchable = isConcealed(t, state)
      ? `hidden trophy ${t.tier} ${t.category} ${t.phase} ${t.story ? 'story' : ''}`
      : `${t.name} ${t.description} ${t.steps.join(' ')} ${t.tier} ${t.category} ${t.phase} ${t.story ? 'story' : ''} ${t.missable ? 'missable' : ''}`;
    return searchable.toLowerCase().includes(query);
  });
  const order = new Map(trophies.map((t, i) => [t.id, i]));
  const tiers = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
  const priority = ['positive-mental-attitude', 'vice-got-a-price', 'a-long-road', 'cunning-stunts', 'the-shootist', 'master-of-none'];
  const recommended = (t) => priority.includes(t.id) ? priority.indexOf(t.id) : order.get(t.id) + priority.length;
  const displayName = (t) => isConcealed(t, state) ? 'Hidden trophy' : t.name;
  return selected.sort((a, b) => {
    switch (state.prefs.sort) {
      case 'name': return displayName(a).localeCompare(displayName(b)) || order.get(a.id) - order.get(b.id);
      case 'tier': return tiers[a.tier] - tiers[b.tier] || order.get(a.id) - order.get(b.id);
      case 'points': return b.points - a.points || order.get(a.id) - order.get(b.id);
      case 'unearned': return Number(state.earned.has(a.id)) - Number(state.earned.has(b.id)) || recommended(a) - recommended(b);
      case 'source': return order.get(a.id) - order.get(b.id);
      default: return recommended(a) - recommended(b);
    }
  });
}
