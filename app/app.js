import {
  TIERS, ROUTE, SAVE_KEY, LEGACY_KEY, newJournal, validateCatalogue, updatePlatinum,
  searchCatalogue, progressFor, covered, visibleName, packJournal, readJournal,
} from './model.js';

const find = id => document.getElementById(id);
const blankFilters = () => ({ query: '', tier: '', stage: '', filter: 'all' });
const filters = blankFilters();
let journal = newJournal();
let publication;
let entries;
let index;
let activeNote;
let backup;
let toastTimer;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, command, value = '', className) {
  const node = element('button', text, className);
  node.type = 'button';
  node.dataset.command = command;
  node.dataset.value = value;
  return node;
}

function pressed(node, on) {
  node.setAttribute('aria-pressed', String(on));
  return node;
}

function announce(message) {
  const toast = find('toast');
  toast.textContent = message;
  toast.classList.add('shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('shown'), 3500);
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(packJournal(journal)));
  } catch {
    announce('Local saving is unavailable. Export a backup to keep these changes.');
  }
}

function loadProgress() {
  try {
    const current = localStorage.getItem(SAVE_KEY);
    const saved = current ?? localStorage.getItem(LEGACY_KEY);
    if (saved === null) return;
    journal = readJournal(JSON.parse(saved), entries);
    if (current === null) save();
  } catch {
    announce('Saved progress could not be opened. You can import a backup.');
  }
}

function renderDashboard() {
  const { percent, score, count, tiers } = progressFor(entries, journal.earned);
  find('percent').textContent = `${Math.round(percent)}%`;
  find('dial').style.setProperty('--fill', `${percent}%`);
  find('earned-count').textContent = count;
  find('score').textContent = score.toLocaleString('en-US');
  find('score-bar').value = score;
  find('medals').replaceChildren(...Object.entries(TIERS).map(([tier, total]) => {
    const control = pressed(button(null, 'tier', tier, `medal ${tier}`), filters.tier === tier);
    control.append(element('span', tier), element('strong', `${tiers[tier]} / ${total}`));
    return control;
  }));
}

function renderRoute() {
  const stops = ROUTE.map(([id, title]) => {
    const batch = entries.filter(entry => entry.phase === id);
    const remaining = batch.filter(entry => !journal.earned.has(entry.id));
    return { id, title, total: batch.length, remaining };
  });
  const next = stops.find(stop => stop.remaining.some(entry => entry.missable)) ??
    stops.find(stop => stop.remaining.length);
  find('route-stages').replaceChildren(...stops.map(stop => {
    const control = pressed(button(null, 'stage', stop.id), filters.stage === stop.id);
    if (stop === next) control.setAttribute('aria-current', 'step');
    const status = stop === next ? ' · Next' : stop.remaining.length ? '' : ' · ✓';
    control.append(element('strong', stop.title), element('span', `${stop.total - stop.remaining.length} / ${stop.total}${status}`));
    return control;
  }));
}

function pointLabel(entry) {
  return entry.tier === 'platinum' ? 'Mythic' : `${entry.points} G`;
}

function card(entry) {
  const hidden = covered(entry, journal);
  const earned = journal.earned.has(entry.id);
  const title = visibleName(entry, journal);
  const article = element('article', null, `entry${earned ? ' collected' : ''}`);
  const meta = element('div', null, 'entry-meta');
  meta.append(element('span', `◆ ${entry.tier}`, `tier ${entry.tier}`), element('span', pointLabel(entry)));

  const check = element('input');
  check.type = 'checkbox';
  check.checked = earned;
  check.dataset.command = 'mark';
  check.dataset.value = entry.id;
  check.setAttribute('aria-label', `Mark ${title} collected`);
  meta.append(check);

  const copy = element('div', null, 'entry-copy');
  const heading = element('h3');
  heading.append(button(title, 'open', entry.id, 'entry-title'));
  copy.append(heading, element('p', hidden ? 'Reveal the name and unlock conditions when you’re ready.' : entry.description));

  const tags = [];
  if (earned) tags.push('Collected');
  if (entry.missable) tags.push('Potentially missable');
  if (entry.story) tags.push('Story');
  if (entry.hidden) tags.push('Hidden');
  const labels = element('div', null, 'tags');
  for (const tag of tags.length ? tags : [entry.category]) labels.append(element('span', tag));

  const foot = element('div', null, 'entry-foot');
  const chapter = !hidden && entry.chapter ? `Chapter ${entry.chapter}` : '';
  foot.append(element('span', chapter), button(hidden ? 'Reveal note ↗' : 'Field note ↗', 'open', entry.id, 'subtle'));
  article.append(meta, copy, labels, foot);
  return article;
}

function renderCollection() {
  const result = searchCatalogue(entries, journal, filters);
  const items = find('trophy-grid');
  const activeStage = ROUTE.find(([id]) => id === filters.stage);
  const suffix = activeStage ? ` · ${activeStage[1]}` : '';
  find('result-count').textContent = `${result.length} of ${entries.length} trophies${suffix}`;
  find('empty').hidden = result.length !== 0;
  find('clear').hidden = !filters.query && !filters.stage && !filters.tier && filters.filter === 'all';
  find('tier').value = filters.tier;
  find('sort').value = journal.options.sort;
  find('cover').checked = journal.options.spoilers;
  for (const layout of document.querySelectorAll('[data-command="layout"]')) {
    pressed(layout, layout.dataset.value === journal.options.view);
  }
  const choices = [
    ['all', 'All', entries.length],
    ['story', 'Story', entries.filter(entry => entry.story).length],
    ['hidden', 'Hidden', entries.filter(entry => entry.hidden).length],
    ['missable', 'Missable', entries.filter(entry => entry.missable).length],
    ['earned', 'Collected', journal.earned.size],
  ];
  find('filters').replaceChildren(...choices.map(([key, label, count]) => {
    const control = pressed(button(null, 'filter', key), filters.filter === key);
    control.append(label, element('span', count));
    return control;
  }));
  items.classList.toggle('list-view', journal.options.view === 'list');
  items.replaceChildren(...result.map(card));
  items.setAttribute('aria-busy', 'false');
}

function refresh() {
  const previous = document.activeElement;
  renderDashboard();
  renderRoute();
  renderCollection();
  if (previous.isConnected || !previous.dataset.command) return;
  const match = Array.from(document.querySelectorAll('[data-command]')).find(node =>
    node.tagName === previous.tagName && node.className === previous.className &&
    node.dataset.command === previous.dataset.command && node.dataset.value === previous.dataset.value);
  (match ?? find('collection-title')).focus({ preventScroll: true });
}

function sourceLinks() {
  const list = element('ul', null, 'sources');
  for (const ref of publication.references) {
    const link = element('a', ref.title);
    link.href = ref.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    const item = element('li');
    item.append(link);
    list.append(item);
  }
  return list;
}

function detailTitle(text) {
  const heading = element('h2', text);
  heading.id = 'detail-title';
  return heading;
}

function renderNote(entry) {
  const body = find('detail-body');
  const actions = element('div', null, 'dialog-actions');
  const collected = journal.earned.has(entry.id);
  if (covered(entry, journal)) {
    actions.append(button('Reveal this note', 'reveal', entry.id, 'action'), button('Mark as collected', 'mark', entry.id, 'subtle'));
    body.replaceChildren(detailTitle('Hidden trophy'), element('p', 'This field note contains spoilers.'), actions);
    return;
  }

  if (entry.tier !== 'platinum') {
    actions.append(button(collected ? 'Undo checkmark' : 'Mark as collected', 'mark', entry.id, 'action'));
  } else {
    actions.append(element('p', collected ? '✓ Collected' : 'Awarded automatically after the other 54 trophies.'));
  }
  if (entry.hidden && journal.revealed.has(entry.id)) actions.append(button('Cover this note', 'conceal', entry.id, 'subtle'));
  body.replaceChildren(
    element('p', `${entry.tier} · ${pointLabel(entry)}`, `eyebrow tier ${entry.tier}`),
    detailTitle(entry.name), element('p', entry.description), actions,
    element('h3', 'Field note'), element('p', entry.guide),
  );
  if (entry.caveat) body.append(element('p', entry.caveat, 'note-caveat'));
  body.append(element('h3', 'Sources'), element('p', `Trophy source notes, ${publication.sourceDate}, lines ${entry.sourceLines}.`), sourceLinks());
}

function openNote(id) {
  activeNote = index.get(id);
  if (!activeNote) return;
  renderNote(activeNote);
  find('detail').showModal();
}

function showSources() {
  activeNote = null;
  find('detail-body').replaceChildren(
    detailTitle('About the Ledger'),
    element('p', 'This unofficial guide follows the supplied November 18, 2026 trophy notes. They list one platinum, two gold, six silver and 46 bronze trophies. The numbered Xbox rewards total 1,000 G.'),
    element('p', 'The source estimates about 28 hidden trophies. The Ledger uses editorial spoiler covers because the notes do not identify every official hidden reward. Positive Mental Attitude is flagged because the Chapter 1 meditation requirement is uncertain.'),
    element('p', 'Your checkmarks live in this browser. Export a backup to move them to another device.'),
    sourceLinks(),
  );
  find('detail').showModal();
}

function updateNote(id, command) {
  const entry = index.get(id);
  if (command === 'mark') {
    if (entry.tier === 'platinum') {
      refresh();
      announce('Platinum follows the other 54 checkmarks automatically.');
      return;
    }
    const removed = journal.earned.delete(id);
    if (!removed) journal.earned.add(id);
    updatePlatinum(entries, journal.earned);
    announce(removed ? 'Checkmark removed.' : 'Trophy collected.');
  } else if (command === 'reveal') {
    journal.revealed.add(id);
  } else {
    journal.revealed.delete(id);
  }
  save();
  refresh();
  if (find('detail').open && activeNote) {
    renderNote(activeNote);
    (find('detail-body').querySelector('.action') ?? find('detail').querySelector('.close')).focus();
  }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(packJournal(journal), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = element('a');
  link.href = url;
  link.download = `leonida-ledger-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Progress backup downloaded.');
}

async function inspectBackup(event) {
  const input = event.currentTarget;
  const [file] = input.files;
  input.value = '';
  if (!file) return;
  try {
    if (file.size > 1024 ** 2) throw new Error('Choose a backup smaller than 1 MB.');
    backup = readJournal(JSON.parse(await file.text()), entries);
    find('restore-message').textContent = `Backup: ${backup.earned.size} collected. This browser: ${journal.earned.size} collected.`;
    find('restore').showModal();
  } catch (error) {
    announce(error.message);
  }
}

function restoreBackup(mode) {
  if (!backup) return;
  for (const key of ['earned', 'revealed']) {
    journal[key] = mode === 'merge' ? new Set([...journal[key], ...backup[key]]) : backup[key];
  }
  updatePlatinum(entries, journal.earned);
  find('restore').close();
  announce(mode === 'merge' ? 'Progress merged.' : 'Checklist replaced.');
  save();
  refresh();
}

function toggleFilter(key, value) {
  filters[key] = filters[key] === value ? '' : value;
  refresh();
}

const commands = {
  open: openNote,
  about: showSources,
  tier: value => toggleFilter('tier', value),
  stage(value) {
    toggleFilter('stage', value);
    find('collection').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  },
  filter(value) {
    filters.filter = value;
    filters.stage = '';
    refresh();
  },
  clear() {
    Object.assign(filters, blankFilters());
    find('search').value = '';
    refresh();
  },
  layout(value) {
    journal.options.view = value;
    save();
    refresh();
  },
  mark: id => updateNote(id, 'mark'),
  reveal: id => updateNote(id, 'reveal'),
  conceal: id => updateNote(id, 'conceal'),
  export: exportBackup,
  import: () => find('backup').click(),
  restore: restoreBackup,
  reload: () => location.reload(),
};

function bindControls() {
  document.addEventListener('click', event => {
    const control = event.target.closest('button[data-command]');
    if (control) commands[control.dataset.command](control.dataset.value);
  });
  find('trophy-grid').addEventListener('change', event => updateNote(event.target.dataset.value, 'mark'));
  find('search').addEventListener('input', event => {
    filters.query = event.target.value;
    renderCollection();
  });
  find('tier').addEventListener('change', event => {
    filters.tier = event.target.value;
    refresh();
  });
  find('sort').addEventListener('change', event => {
    journal.options.sort = event.target.value;
    save();
    renderCollection();
  });
  find('cover').addEventListener('change', event => {
    journal.options.spoilers = event.target.checked;
    save();
    renderCollection();
  });
  find('backup').addEventListener('change', inspectBackup);

  document.addEventListener('keydown', event => {
    const search = find('search');
    if (event.key === 'Escape' && event.target === search && search.value) {
      event.preventDefault();
      search.value = '';
      filters.query = '';
      renderCollection();
    }
    if (event.key === '/' && !event.target.closest('input, select, textarea, [contenteditable]') && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      search.focus();
    }
  });
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const { left, right, top, bottom } = dialog.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
    });
  }
  find('restore').addEventListener('close', () => { backup = null; });
  find('detail').addEventListener('close', () => {
    if (document.activeElement === document.body) find('collection-title').focus({ preventScroll: true });
  });
  window.addEventListener('storage', event => {
    if (event.key !== SAVE_KEY && event.key !== null) return;
    try {
      journal = event.newValue ? readJournal(JSON.parse(event.newValue), entries) : newJournal();
      refresh();
      if (find('detail').open && activeNote) renderNote(activeNote);
      announce('Progress synced from another tab.');
    } catch {
      announce('Could not read the update from another tab.');
    }
  });
}

async function enableOffline() {
  if (!navigator.serviceWorker) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    find('connection').textContent = 'Offline ready';
  } catch {
    // Saving and backups still work without service worker support.
  }
}

async function boot() {
  try {
    const response = await fetch('./data/trophies.json');
    if (!response.ok) throw new Error(`Catalogue request failed (${response.status}).`);
    publication = await response.json();
    entries = publication.trophies;
    validateCatalogue(entries);
    index = new Map(entries.map(entry => [entry.id, entry]));
    loadProgress();
    find('route-tips').replaceChildren(...ROUTE.map(([, label, tip]) => {
      const item = element('li');
      item.append(element('strong', `${label}. `), tip);
      return item;
    }));
    refresh();
    bindControls();
    for (const control of document.querySelectorAll('[data-needs-data]')) control.disabled = false;
    void enableOffline();
  } catch (error) {
    find('result-count').textContent = 'Catalogue unavailable';
    find('trophy-grid').setAttribute('aria-busy', 'false');
    find('failure').hidden = false;
    find('failure').querySelector('button').onclick = commands.reload;
    console.error(error);
  }
}

void boot();
