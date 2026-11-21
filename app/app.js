import {
  OLD_STORAGE_KEY, STORAGE_KEY, STAGES, exportJournal, freshJournal, getProgress,
  getStages, importJournal, isConcealed, selectTrophies, settlePlatinum,
} from './model.js';

const byId = name => document.getElementById(name);
const escapeText = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const journal = freshJournal();
let catalogue;
let pendingImport;
let lastFocus;
let toastTimer;

function say(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3400);
}

function store() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exportJournal(journal)));
  } catch {
    say('This browser cannot save locally. Export a copy before leaving.');
  }
}

function restoreSaved() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = current ? null : localStorage.getItem(OLD_STORAGE_KEY);
    if (!current && !legacy) return;
    const saved = importJournal(JSON.parse(current ?? legacy), catalogue);
    Object.assign(journal, saved);
    if (legacy) {
      store();
      say('Your earlier checklist is ready in the Ledger.');
    }
  } catch {
    say('Saved notes could not be read. You can import a backup or start fresh.');
  }
}

function renderProgress() {
  const progress = getProgress(catalogue, journal.earned);
  byId('earned-count').textContent = progress.count;
  byId('percent').textContent = `${Math.round(progress.percent)}%`;
  byId('progress-ring').style.setProperty('--progress', `${progress.percent}%`);
  byId('score').textContent = progress.score.toLocaleString('en-US');
  byId('score-progress').value = progress.score;
  byId('progress-message').textContent = progress.count === 55
    ? 'Leonida Legend. Every entry is yours.'
    : progress.count === 0 ? 'Every trip starts somewhere.' : `${55 - progress.count} more little victories ahead.`;
  byId('medal-counts').innerHTML = ['platinum', 'gold', 'silver', 'bronze'].map(tier => {
    const group = catalogue.filter(item => item.tier === tier);
    const count = group.filter(item => journal.earned.has(item.id)).length;
    return `<button class="medal-chip" type="button" data-medal="${tier}" aria-pressed="${journal.tier === tier}" aria-label="${tier}: ${count} of ${group.length}; filter collection"><span class="medal-dot ${tier}"></span><span>${count}<small> / ${group.length}</small><b>${tier}</b></span></button>`;
  }).join('');
}

function renderRoute() {
  const route = getStages(catalogue, journal);
  byId('route-stages').innerHTML = route.map((stage, index) => `<button class="route-stage ${stage.done === stage.total ? 'complete' : ''}" type="button" data-stage="${stage.id}" aria-pressed="${journal.stage === stage.id}" ${stage.next ? 'aria-current="step"' : ''}><span class="route-number">${stage.done === stage.total ? '✓' : String(index + 1).padStart(2, '0')}</span><span class="route-name">${escapeText(stage.label)}<small>${stage.done} / ${stage.total}</small></span></button>`).join('');
  if (!byId('route-notes').hidden) renderRouteNotes();
}

function renderRouteNotes() {
  byId('route-notes').innerHTML = `<h3>Take the long way, one chapter at a time.</h3><ol>${STAGES.map(stage => `<li><b>${escapeText(stage.label)}.</b> ${escapeText(stage.tip)}</li>`).join('')}</ol><p class="source-credit">The source notes estimate about 200 hours and report no mission replay or New Game+. Treat the in-game completion screen as your final checklist.</p>`;
}

function trophyMarkup(item) {
  const hidden = isConcealed(item, journal);
  const earned = journal.earned.has(item.id);
  const name = hidden ? 'Hidden trophy' : item.name;
  const summary = hidden ? 'A story still under cover. Reveal it whenever you like.' : item.description;
  const markers = [earned ? '<span class="tag earned-tag">✓ Collected</span>' : '', item.missable ? '<span class="tag caution-tag">Potentially missable</span>' : '', item.story ? '<span class="tag">Story</span>' : '', item.hidden ? '<span class="tag secret-tag">Hidden</span>' : ''].filter(Boolean).join('');
  return `<article class="trophy ${earned ? 'is-earned' : ''} ${hidden ? 'is-hidden' : ''}" data-card="${item.id}">
    <div class="trophy-top"><span class="tier-symbol ${item.tier}" aria-hidden="true">${hidden ? '✦' : '◆'}</span><span class="tier-name">${item.tier}</span><span class="points">${item.tier === 'platinum' ? 'MYTHIC' : `${item.points} G`}</span><label class="check-wrap"><span class="sr-only">Mark ${escapeText(name)} earned</span><input type="checkbox" data-earned="${item.id}" ${earned ? 'checked' : ''}></label></div>
    <button class="trophy-copy" type="button" data-open="${item.id}"><h3>${escapeText(name)}</h3><p>${escapeText(summary)}</p></button>
    <div class="tags">${markers || `<span class="tag">${escapeText(item.category)}</span>`}</div>
    <div class="trophy-bottom"><span>${item.chapter ? `CHAPTER ${item.chapter} ONWARD` : item.tier === 'platinum' ? 'THE FINAL MILESTONE' : 'AT YOUR OWN PACE'}</span><button type="button" data-open="${item.id}">${hidden ? 'Reveal note' : 'Field note'} ↗</button></div>
  </article>`;
}

function renderFilters() {
  const choices = [
    ['all', 'Everything', catalogue.length],
    ['story', 'Story', catalogue.filter(item => item.story).length],
    ['hidden', 'Under cover', catalogue.filter(item => item.hidden).length],
    ['missable', 'Missable', catalogue.filter(item => item.missable).length],
    ['earned', 'Collected', journal.earned.size],
  ];
  byId('filters').innerHTML = choices.map(([id, label, count]) => `<button type="button" data-filter="${id}" aria-pressed="${journal.filter === id}">${label}<span>${count}</span></button>`).join('');
}

function renderCards() {
  const result = selectTrophies(catalogue, journal);
  const grid = byId('trophy-grid');
  grid.classList.toggle('compact', journal.view === 'list');
  grid.innerHTML = result.map(trophyMarkup).join('');
  grid.setAttribute('aria-busy', 'false');
  byId('empty-state').hidden = result.length > 0;
  const activeStage = STAGES.find(item => item.id === journal.stage);
  byId('result-count').textContent = `Showing ${result.length} of ${catalogue.length}${activeStage ? ` · ${activeStage.label}` : ''}`;
  byId('clear-filters').hidden = journal.filter === 'all' && journal.tier === 'all' && !journal.stage && !journal.search;
  byId('tier').value = journal.tier;
  byId('sort').value = journal.sort;
  byId('spoiler-switch').setAttribute('aria-checked', String(journal.spoilers));
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === journal.view)));
  renderFilters();
}

function renderAll() {
  renderProgress();
  renderRoute();
  renderCards();
}

function revealOrEarn(id, earn) {
  const item = catalogue.find(entry => entry.id === id);
  if (!item) return;
  if (earn) {
    if (item.tier === 'platinum') {
      say('The platinum entry follows the other 54 trophies automatically.');
      return;
    }
    journal.earned[earn === 'yes' ? 'add' : 'delete'](id);
    settlePlatinum(journal, catalogue);
    say(earn === 'yes' ? 'Added to your journey.' : 'Checkmark removed.');
  } else {
    journal.revealed.add(id);
  }
  store();
  renderAll();
  if (byId('guide').open) showGuide(id);
}

function openDialog(dialog) {
  lastFocus = document.activeElement;
  dialog.showModal();
}

function showGuide(id) {
  const item = catalogue.find(entry => entry.id === id);
  if (!item) return;
  const body = byId('guide-content');
  if (isConcealed(item, journal)) {
    body.innerHTML = `<div class="locked"><span aria-hidden="true">✦</span><h2 id="guide-title">A story for another day.</h2><p>This note is under the spoiler cover. Reveal it when you’re ready, or mark it collected.</p><button class="button" type="button" data-reveal="${item.id}">Reveal this note</button> <button class="button button-outline" type="button" data-mark="${item.id}">I’ve collected it</button></div>`;
  } else {
    const refs = window.publication.references.map(ref => `<a href="${escapeText(ref.url)}" target="_blank" rel="noreferrer">${escapeText(ref.title)}</a>`).join(' · ');
    body.innerHTML = `<div class="guide-heading"><span class="tier-symbol ${item.tier}">◆</span><span>${item.tier}</span><span class="points">${item.tier === 'platinum' ? 'MYTHIC' : `${item.points} G`}</span></div><h2 id="guide-title">${escapeText(item.name)}</h2><p class="guide-description">${escapeText(item.description)}</p><div class="guide-actions"><button class="button" type="button" data-mark="${item.id}">${journal.earned.has(item.id) ? '✓ Collected · undo' : 'Mark as collected'}</button>${item.hidden && journal.revealed.has(item.id) ? `<button class="quiet-button" type="button" data-conceal="${item.id}">Cover this note</button>` : ''}</div>${item.missable ? '<aside class="caveat"><b>KEEP IN MIND</b> The Chapter 1 balcony meditation may be missable. The notes do not confirm whether it is required.' : ''}${item.caveat ? `<aside class="caveat"><b>SOURCE NOTE</b> ${escapeText(item.caveat)}</aside>` : ''}<h3 class="subheading">Field route</h3><p class="guide-description">${escapeText(item.guide)}</p><div class="citations"><b>Source trail</b><p>${refs}</p><small>Based on the supplied notes, dated November 18, 2026. Source lines: ${escapeText(item.sourceLines ?? 'see trophy source notes')}.</small></div>`;
  }
  openDialog(byId('guide'));
}

function showAbout() {
  byId('about-copy').innerHTML = `<p>This fan-made journal is based on the supplied November 18, 2026 notes. It lists 55 rewards: 1 platinum, 2 gold, 6 silver and 46 bronze. The 54 numerical Xbox rewards total 1,000G; the Mythic equivalent has no number given.</p><p>The notes describe about 28 hidden rewards but do not provide a per-trophy list. The hidden labels here are editorial spoiler covers. Positive Mental Attitude is flagged as potentially missable because the early meditation requirement is uncertain.</p><p>The 100% completion trophy and platinum have different requirements. Story progress remains available in free roam after the credits, according to the supplied source. No account is needed: your checklist is stored in this browser, and you can export a JSON backup.</p><div class="citations"><b>References named in the notes</b><p>${window.publication.references.map(ref => `<a href="${escapeText(ref.url)}" target="_blank" rel="noreferrer">${escapeText(ref.title)}</a>`).join('<br>')}</p><small>Source claims are presented as supplied rather than independently verified.</small></div>`;
  openDialog(byId('about'));
}

function downloadBackup() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportJournal(journal), null, 2)], { type: 'application/json' }));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: `leonida-ledger-${new Date().toISOString().slice(0, 10)}.json` });
  anchor.click();
  URL.revokeObjectURL(url);
  say('Your Ledger backup is ready.');
}

async function inspectBackup(file) {
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('Choose a backup smaller than 1 MB.');
    pendingImport = importJournal(JSON.parse(await file.text()), catalogue);
    byId('restore-message').textContent = `This file has ${pendingImport.earned.size} collected trophies. This browser has ${journal.earned.size}.`;
    openDialog(byId('restore'));
  } catch (error) {
    say(error.message || 'That file could not be read.');
  } finally {
    byId('backup-file').value = '';
  }
}

function restoreBackup(mode) {
  if (!pendingImport) return;
  journal.earned = mode === 'merge' ? new Set([...journal.earned, ...pendingImport.earned]) : new Set(pendingImport.earned);
  journal.revealed = mode === 'merge' ? new Set([...journal.revealed, ...pendingImport.revealed]) : new Set(pendingImport.revealed);
  settlePlatinum(journal, catalogue);
  pendingImport = null;
  store();
  byId('restore').close();
  renderAll();
  say(mode === 'merge' ? 'The two checklists are together.' : 'Your checklist has been replaced.');
}

function handleClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const data = button.dataset;
  if (data.open) showGuide(data.open);
  if (data.reveal) revealOrEarn(data.reveal, false);
  if (data.mark) revealOrEarn(data.mark, journal.earned.has(data.mark) ? 'no' : 'yes');
  if (data.conceal) { journal.revealed.delete(data.conceal); store(); renderAll(); showGuide(data.conceal); }
  if (data.filter) { journal.filter = data.filter; journal.stage = ''; renderAll(); }
  if (data.medal) { journal.tier = journal.tier === data.medal ? 'all' : data.medal; renderAll(); }
  if (data.stage) { journal.stage = journal.stage === data.stage ? '' : data.stage; renderAll(); byId('collection').scrollIntoView({ behavior: 'smooth' }); }
  if (data.view) { journal.view = data.view; store(); renderAll(); }
  if (data.close) byId(data.close).close();
  if (data.restore) restoreBackup(data.restore);
  if (button.id === 'source-open') showAbout();
  if (button.id === 'export') downloadBackup();
  if (button.id === 'import') byId('backup-file').click();
  if (button.id === 'clear-filters' || button.id === 'show-all') {
    Object.assign(journal, { filter: 'all', tier: 'all', stage: '', search: '' });
    byId('search').value = '';
    renderAll();
  }
  if (button.id === 'route-toggle') {
    const notes = byId('route-notes');
    notes.hidden = !notes.hidden;
    button.setAttribute('aria-expanded', String(!notes.hidden));
    button.innerHTML = notes.hidden ? 'Open route notes <span aria-hidden="true">↗</span>' : 'Close route notes <span aria-hidden="true">×</span>';
    if (!notes.hidden) renderRouteNotes();
  }
  if (button.id === 'spoiler-switch') {
    journal.spoilers = !journal.spoilers;
    store();
    renderAll();
  }
  if (button.id === 'reload') location.reload();
}

function connectControls() {
  document.addEventListener('click', handleClick);
  byId('search').addEventListener('input', event => { journal.search = event.target.value; renderCards(); });
  byId('search').addEventListener('keydown', event => {
    if (event.key === 'Escape' && event.currentTarget.value) {
      event.currentTarget.value = '';
      journal.search = '';
      renderCards();
    }
  });
  byId('tier').addEventListener('change', event => { journal.tier = event.target.value; renderAll(); });
  byId('sort').addEventListener('change', event => { journal.sort = event.target.value; store(); renderCards(); });
  byId('trophy-grid').addEventListener('change', event => {
    const id = event.target.dataset.earned;
    if (!id) return;
    revealOrEarn(id, event.target.checked ? 'yes' : 'no');
  });
  byId('backup-file').addEventListener('change', event => inspectBackup(event.target.files[0]));
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('close', () => {
      if (dialog.id === 'restore') pendingImport = null;
      const focus = lastFocus?.isConnected ? lastFocus : byId('collection-title');
      focus?.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
  }
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.target.closest('input,select,textarea,[contenteditable="true"]') && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      byId('search').focus();
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try {
      Object.assign(journal, event.newValue ? importJournal(JSON.parse(event.newValue), catalogue) : freshJournal());
      renderAll();
      say('Another tab updated your checklist.');
    } catch {
      say('A different tab saved notes this page could not read.');
    }
  });
}

async function start() {
  try {
    const response = await fetch('./data/trophies.json');
    if (!response.ok) throw new Error(`Catalogue returned ${response.status}`);
    window.publication = await response.json();
    catalogue = window.publication.trophies;
    const tierTotals = catalogue.reduce((counts, item) => ({ ...counts, [item.tier]: (counts[item.tier] ?? 0) + 1 }), {});
    const points = catalogue.reduce((sum, item) => sum + item.points, 0);
    if (catalogue.length !== 55 || new Set(catalogue.map(item => item.id)).size !== 55 || points !== 1000 || tierTotals.platinum !== 1 || tierTotals.gold !== 2 || tierTotals.silver !== 6 || tierTotals.bronze !== 46) {
      throw new Error('The supplied trophy catalogue does not match its 55-entry reward summary.');
    }
    restoreSaved();
    connectControls();
    renderAll();
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
        await navigator.serviceWorker.ready;
        byId('connection').textContent = 'OFFLINE NOTES READY';
      } catch {
        byId('connection').title = 'Offline caching is unavailable in this browser.';
      }
    }
  } catch (error) {
    byId('load-error').hidden = false;
    byId('trophy-grid').setAttribute('aria-busy', 'false');
    byId('result-count').textContent = 'Trophy notes unavailable';
    document.querySelectorAll('button').forEach(button => { button.disabled = button.id !== 'reload'; });
    console.error('Leonida Ledger could not start:', error);
  }
}

void start();
