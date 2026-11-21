import { SAVE_SLOT, OLD_SLOT, JOURNEY, newLedger, shielded, settlePlatinum, totals, itinerary, visibleTrophies, exportLedger, readLedger } from './model.js';

const element = id => document.getElementById(id);
const html = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const cup = '<i class="cup" aria-hidden="true"></i>';
const ledger = newLedger();
let catalogue = [];
let publication;
let openTrophy = '';
let incoming = null;
let returnFocus = null;
let noticeTimeout;
let canSave = true;

function announce(message) {
  window.clearTimeout(noticeTimeout);
  element('notice').textContent = message;
  element('notice').classList.add('show');
  noticeTimeout = window.setTimeout(() => element('notice').classList.remove('show'), 5000);
}

function saveLabel() {
  element('save-state').textContent = canSave ? '● Saved locally. Always yours.' : 'Session only. Export to keep progress.';
}

function commit() {
  try {
    localStorage.setItem(SAVE_SLOT, JSON.stringify(exportLedger(ledger)));
    canSave = true;
  } catch {
    canSave = false;
    announce('Storage is unavailable. Export your checklist before leaving.');
  }
  saveLabel();
}

function recover() {
  try {
    const current = localStorage.getItem(SAVE_SLOT);
    const previous = current ? null : localStorage.getItem(OLD_SLOT);
    if (current || previous) {
      const restored = readLedger(JSON.parse(current ?? previous), catalogue);
      Object.assign(ledger, { earned: restored.earned, revealed: restored.revealed, prefs: restored.prefs });
      if (previous) { commit(); announce('Your original checklist is now in the Ledger.'); }
    }
  } catch (error) {
    canSave = !['SecurityError', 'QuotaExceededError'].includes(error.name);
    announce('Saved progress could not be read. Export this session to keep a backup.');
  }
  saveLabel();
}

function drawDashboard() {
  const progress = totals(catalogue, ledger.earned);
  element('earned-number').textContent = progress.earned;
  element('nav-count').textContent = progress.earned;
  element('percentage').textContent = `${Math.round(progress.percent)}%`;
  element('completion-dial').style.setProperty('--fill', `${progress.percent}%`);
  element('completion-dial').setAttribute('aria-label', `${Math.round(progress.percent)} percent complete`);
  element('encouragement').textContent = progress.earned === 0 ? 'A fresh start. A whole state of possibilities.' : progress.left ? `${progress.left} little victories left on the road to platinum.` : 'Leonida Legend. The full collection is yours.';
  element('score-number').textContent = progress.score.toLocaleString('en-US');
  element('score-bar').value = progress.score;
  element('tier-summary').innerHTML = ['platinum', 'gold', 'silver', 'bronze'].map(metal => {
    const group = catalogue.filter(trophy => trophy.tier === metal);
    const count = group.filter(trophy => ledger.earned.has(trophy.id)).length;
    return `<button class="metal-total" data-metal="${metal}" data-tier="${metal}" aria-pressed="${ledger.tier === metal}" aria-label="${metal}: ${count} of ${group.length} earned; filter this tier">${cup}<strong>${count}<span> / ${group.length}</span></strong><span>${metal}</span></button>`;
  }).join('');
  element('route-stages').innerHTML = itinerary(catalogue, ledger).map((stage, index) => `<button class="route-stage ${stage.done === stage.total ? 'complete' : ''}" data-stage="${stage.key}" aria-pressed="${ledger.phase === stage.key}" ${stage.next ? 'aria-current="step"' : ''} aria-label="${html(stage.title)}: ${stage.done} of ${stage.total} earned${stage.next ? '; suggested next stage' : ''}"><b>${stage.done === stage.total ? '✓' : String(index + 1).padStart(2, '0')}</b><span>${stage.label}<small>${stage.done} / ${stage.total} earned</small></span></button>`).join('');
}

function badges(trophy, concealed) {
  const labels = [];
  if (ledger.earned.has(trophy.id)) labels.push('<span class="badge owned">✓ Earned</span>');
  if (trophy.missable) labels.push('<span class="badge caution">! Potentially missable</span>');
  if (trophy.story) labels.push('<span class="badge">Story</span>');
  if (trophy.hidden) labels.push('<span class="badge secret">Hidden</span>');
  if (!labels.length) labels.push(`<span class="badge">${html(trophy.tier === 'platinum' ? 'The ultimate goal' : trophy.category)}</span>`);
  if (trophy.caveat && !concealed && !trophy.missable && trophy.tier !== 'platinum') labels.push('<span class="badge caution">Source note</span>');
  return labels.join('');
}

function trophyCard(trophy) {
  const concealed = shielded(trophy, ledger);
  const owned = ledger.earned.has(trophy.id);
  const name = concealed ? 'Hidden trophy' : trophy.name;
  const description = concealed ? 'A story still waiting to be told. Reveal when you’re ready.' : trophy.description;
  const caption = concealed ? 'Spoiler protected' : trophy.tier === 'platinum' ? '54 trophies. One legend.' : trophy.chapter ? `Chapter ${trophy.chapter} onward` : 'Take it at your pace';
  return `<article class="entry ${owned ? 'is-earned' : ''} ${concealed ? 'concealed' : ''}" data-metal="${trophy.tier}" data-entry="${trophy.id}">
    <div class="entry-head"><span class="emblem" aria-hidden="true">${concealed ? '?' : cup}</span><span class="metal-label">${trophy.tier}</span><span class="reward">${trophy.tier === 'platinum' ? 'MYTHIC' : `${trophy.points} G`}</span><input type="checkbox" data-check="${trophy.id}" ${owned ? 'checked' : ''} aria-label="Mark ${html(name)} ${owned ? 'not earned' : 'earned'}"></div>
    <button class="entry-title" data-guide="${trophy.id}" aria-label="Open guide: ${html(name)}"><h3>${html(name)}</h3><p>${html(description)}</p></button>
    <div class="labels">${badges(trophy, concealed)}</div>
    <div class="entry-foot"><span>${caption}</span><button ${concealed ? 'data-reveal' : 'data-guide'}="${trophy.id}">${concealed ? 'Reveal trophy' : 'View guide'} ↗</button></div>
  </article>`;
}

function drawCollection() {
  const selected = visibleTrophies(catalogue, ledger);
  element('cards').classList.toggle('rows', ledger.prefs.view === 'list');
  element('cards').innerHTML = selected.map(trophyCard).join('');
  element('cards').setAttribute('aria-busy', 'false');
  element('no-results').hidden = selected.length > 0;
  const stage = JOURNEY.find(item => item.key === ledger.phase);
  element('result-label').textContent = `Showing ${selected.length} of ${catalogue.length} trophies${stage ? ` · ${stage.title}` : ''}${ledger.filter === 'hidden' ? ' · Editorial spoiler flags' : ''}`;
  element('clear').hidden = ledger.filter === 'all' && ledger.tier === 'all' && !ledger.phase && !ledger.query.trim();
  const groups = [['all', 'All trophies', catalogue.length], ['story', 'Story', catalogue.filter(item => item.story).length], ['hidden', 'Hidden', catalogue.filter(item => item.hidden).length], ['missable', 'Missable', catalogue.filter(item => item.missable).length], ['earned', 'Earned', ledger.earned.size]];
  element('collection-filters').innerHTML = groups.map(([key, label, count]) => `<button data-filter="${key}" aria-pressed="${ledger.filter === key}">${label}<span>${count}</span></button>`).join('');
  element('tier').value = ledger.tier;
  element('ordering').value = ledger.prefs.sort;
  element('spoilers').setAttribute('aria-checked', String(ledger.prefs.protected));
  document.querySelectorAll('[data-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === ledger.prefs.view)));
  document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('selected', link.dataset.nav === (ledger.phase ? 'roadmap' : ledger.filter === 'earned' ? 'earned' : 'all')));
}

function redraw() {
  const before = document.activeElement;
  const attribute = ['data-check', 'data-tier', 'data-stage', 'data-filter'].find(key => before?.hasAttribute(key));
  const value = attribute && before.getAttribute(attribute);
  const checks = [...element('cards').querySelectorAll('[data-check]')];
  const index = checks.indexOf(before);
  drawDashboard();
  drawCollection();
  if (attribute) {
    const matching = [...document.querySelectorAll(`[${attribute}]`)].find(node => node.getAttribute(attribute) === value);
    const fallback = index >= 0 ? [...element('cards').querySelectorAll('[data-check]')][Math.min(index, element('cards').querySelectorAll('[data-check]').length - 1)] : null;
    (matching ?? fallback ?? element('collection-title')).focus({ preventScroll: true });
  }
}

function resetView(overrides = {}) {
  Object.assign(ledger, { query: '', phase: '', tier: 'all', filter: 'all' }, overrides);
  element('find').value = ledger.query;
  redraw();
}

function changeCheck(id, requested) {
  const trophy = catalogue.find(item => item.id === id);
  if (!trophy) return;
  if (trophy.tier === 'platinum') {
    redraw();
    announce('Platinum follows the other 54 trophies automatically. Change a prerequisite to update it.');
    return;
  }
  const previouslyComplete = ledger.earned.size === catalogue.length;
  ledger.earned[requested ? 'add' : 'delete'](id);
  settlePlatinum(ledger, catalogue);
  commit();
  redraw();
  if (openTrophy) drawGuide();
  if (canSave) announce(!previouslyComplete && ledger.earned.size === catalogue.length ? 'Leonida Legend! All 55 trophies are yours.' : requested ? 'Another little victory. Progress saved.' : 'Checkmark removed. Progress saved.');
}

function revealTrophy(id, reveal = true) {
  if (!catalogue.some(item => item.id === id)) return;
  ledger.revealed[reveal ? 'add' : 'delete'](id);
  commit();
  redraw();
  if (openTrophy) drawGuide();
}

function showDialog(dialog) {
  returnFocus = document.activeElement;
  dialog.showModal();
  dialog.scrollTop = 0;
}

function citations() {
  return publication.references.map(reference => `<div class="citation"><strong>${html(reference.title)}</strong><code>${html(reference.address)}</code><span>${html(reference.note)}</span></div>`).join('');
}

function drawGuide() {
  const trophy = catalogue.find(item => item.id === openTrophy);
  if (!trophy) return;
  element('guide-kicker').textContent = 'THE TROPHY FIELD GUIDE';
  if (shielded(trophy, ledger)) {
    element('guide-body').innerHTML = `<div class="locked-guide"><span aria-hidden="true">?</span><h2 id="guide-title">Some stories are<br>better discovered.</h2><p>This entry is spoiler protected. Reveal this guide when you’re ready,<br>or check it off after earning it in the game.</p><div class="guide-actions"><button class="solid-button" data-reveal="${trophy.id}">Reveal this trophy</button><button class="outline-button" data-toggle="${trophy.id}">I’ve earned this trophy</button></div></div>`;
    return;
  }
  const owned = ledger.earned.has(trophy.id);
  element('guide-body').innerHTML = `<div class="guide-metal" data-metal="${trophy.tier}"><span class="emblem">${cup}</span><span class="metal-label">${trophy.tier}</span><span class="reward">${trophy.tier === 'platinum' ? 'MYTHIC · NO G SPECIFIED' : `${trophy.points} XBOX G`}</span></div>
    <h2 id="guide-title">${html(trophy.name)}</h2><p class="guide-description"><small>Unlock condition · based on supplied notes</small>${html(trophy.description)}</p>
    <div class="guide-actions"><button class="solid-button" data-toggle="${trophy.id}" aria-pressed="${owned}">${owned ? '✓ Earned · undo' : 'Mark as earned +'}</button>${trophy.hidden && ledger.revealed.has(trophy.id) && !owned ? `<button class="text-link" data-hide="${trophy.id}">Hide again</button>` : ''}</div>
    ${trophy.missable ? '<aside class="missable-note"><strong>! CHAPTER 1 · POTENTIALLY MISSABLE</strong>Accept the balcony meditation invitation the morning after Down to Earth. The source has not confirmed whether it is required, and reports no mission replay.</aside>' : ''}
    <h3 class="guide-subtitle">Your route to the unlock</h3><ol class="guide-steps">${trophy.guide.map(instruction => `<li>${html(instruction)}</li>`).join('')}</ol>
    ${trophy.caveat ? `<aside class="source-note"><strong>SOURCE CAVEAT</strong>${html(trophy.caveat)}</aside>` : ''}
    <section class="citations" aria-label="Guide citations"><strong>From the field notes</strong>${citations()}<p>Local document: ${html(publication.sourceFile)}, lines ${html(trophy.sourceLines)}. Dated November 18, 2026. These citations are available offline.${trophy.hidden ? ' Hidden status is an editorial spoiler flag.' : ''}</p></section>`;
}

function openGuide(id) {
  if (!catalogue.some(item => item.id === id)) return;
  openTrophy = id;
  drawGuide();
  showDialog(element('guide'));
}

function sourceGuide() {
  openTrophy = '';
  element('guide-kicker').textContent = 'A NOTE FROM THE LEDGER';
  element('guide-body').innerHTML = `<h2 id="guide-title">A guide with<br>its sources in view.</h2><div class="prose"><p>This fan companion follows the supplied November 18, 2026 trophy notes: 55 rewards, with 1 platinum, 2 gold, 6 silver and 46 bronze.</p><h3>How to read the guide</h3>${publication.methodology.map(note => `<p>${html(note)}</p>`).join('')}<h3>The source trail</h3>${citations()}<h3>The long road</h3><p>The notes attribute an approximately 200-hour route to GTABase and report no mission replays, difficulty options or New Game+. Free roam remains after the story. Keep cheats disabled, protect the early meditation opportunity and use the in-game completion checklist for the final requirements.</p><h3>Your own checklist</h3><p>Progress and preferences stay in browser storage. Export a JSON backup to move devices or preserve a copy. Clearing browser data removes local progress. No account, analytics, remote fonts or third-party requests are required.</p><p>Press / to search, Tab to navigate, Space to check an entry and Escape to close a guide. Arrow keys, Home and End move among the displayed checkboxes. Individual trophy reveals persist separately from the global spoiler switch.</p><p>After the first successful cache installation, the app can reload offline in browsers that support service workers.</p></div>`;
  showDialog(element('guide'));
}

function togglePlan() {
  const notes = element('route-notes');
  notes.hidden = !notes.hidden;
  document.querySelector('[data-action="plan"]').setAttribute('aria-expanded', String(!notes.hidden));
  if (!notes.hidden) notes.innerHTML = `<h3>About 200 hours. A route worth taking.</h3><p>Mix optional tasks into the story as they become available.</p><ol>${JOURNEY.map(stage => `<li><strong>${html(stage.title)}.</strong> ${html(stage.advice)}</li>`).join('')}</ol><p>The estimate and replay limits come from the supplied notes. The game's 100% checklist is the final reference.</p>`;
}

function downloadBackup() {
  const address = URL.createObjectURL(new Blob([JSON.stringify(exportLedger(ledger), null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = address;
  link.download = `leonida-ledger-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(address), 1000);
  announce('Your progress backup is ready.');
}

async function inspectBackup(file) {
  if (!file) return;
  try {
    if (file.size > 1048576) throw new Error('Choose a JSON backup smaller than 1 MB.');
    incoming = readLedger(JSON.parse(await file.text()), catalogue);
    element('restore-message').textContent = `This backup has ${incoming.earned.size} earned trophies and ${incoming.revealed.size} individual reveals. This device currently has ${ledger.earned.size} earned.`;
    showDialog(element('restore'));
  } catch (error) {
    incoming = null;
    announce(error instanceof SyntaxError ? 'That file is not valid JSON. Your checklist is unchanged.' : error.message);
  } finally {
    element('backup-file').value = '';
  }
}

function restoreBackup(mode) {
  if (!incoming) return;
  for (const collection of ['earned', 'revealed']) ledger[collection] = new Set(mode === 'merge' ? [...ledger[collection], ...incoming[collection]] : incoming[collection]);
  settlePlatinum(ledger, catalogue);
  commit();
  redraw();
  element('restore').close();
  if (canSave) announce(`Progress ${mode === 'merge' ? 'merged' : 'replaced'} and saved.`);
}

function handleClick(event) {
  const control = event.target.closest('button, a[data-nav]');
  if (!control || control.disabled) return;
  const data = control.dataset;
  if (data.guide) openGuide(data.guide);
  if (data.reveal || data.hide) {
    const id = data.reveal ?? data.hide;
    revealTrophy(id, Boolean(data.reveal));
    const target = element('guide').open ? element('guide-body').querySelector('button') : document.querySelector(`[data-entry="${id}"] .entry-title`);
    target?.focus({ preventScroll: true });
  }
  if (data.toggle) {
    changeCheck(data.toggle, !ledger.earned.has(data.toggle));
    element('guide-body').querySelector('[data-toggle]')?.focus({ preventScroll: true });
  }
  if (data.filter) { ledger.filter = data.filter; ledger.phase = ''; redraw(); }
  if (data.tier) { ledger.tier = ledger.tier === data.tier ? 'all' : data.tier; redraw(); element('collection').scrollIntoView(); }
  if (data.stage) { resetView({ phase: ledger.phase === data.stage ? '' : data.stage }); element('collection').scrollIntoView(); }
  if (data.layout) { ledger.prefs.view = data.layout; commit(); redraw(); }
  if (data.nav === 'all' || data.nav === 'earned') resetView({ filter: data.nav });
  if (data.nav === 'roadmap' && element('route-notes').hidden) togglePlan();
  if (data.restore) restoreBackup(data.restore);
  const actions = {
    export: downloadBackup, import: () => element('backup-file').click(), sources: sourceGuide,
    clear: () => { resetView(); element('find').focus({ preventScroll: true }); },
    plan: togglePlan, 'close-guide': () => element('guide').close(),
    'cancel-restore': () => element('restore').close(), reload: () => location.reload(),
  };
  actions[data.action]?.();
}

function bindInterface() {
  document.addEventListener('click', handleClick);
  element('find').addEventListener('input', event => { ledger.query = event.target.value; drawCollection(); });
  element('find').addEventListener('keydown', event => {
    if (event.key === 'Escape' && event.currentTarget.value && !event.isComposing) { event.preventDefault(); ledger.query = ''; event.currentTarget.value = ''; drawCollection(); }
  });
  element('tier').addEventListener('change', event => { ledger.tier = event.target.value; redraw(); });
  element('ordering').addEventListener('change', event => { ledger.prefs.sort = event.target.value; commit(); redraw(); });
  element('spoilers').addEventListener('click', () => {
    ledger.prefs.protected = !ledger.prefs.protected;
    commit(); redraw();
    if (openTrophy) drawGuide();
    announce(ledger.prefs.protected ? 'Spoiler protection on. Earned and individually revealed entries stay visible.' : 'Spoiler protection off. All guides are visible.');
  });
  element('cards').addEventListener('change', event => { if (event.target.dataset.check) changeCheck(event.target.dataset.check, event.target.checked); });
  element('cards').addEventListener('keydown', event => {
    if (!event.target.hasAttribute('data-check') || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const checks = [...element('cards').querySelectorAll('[data-check]')];
    const position = checks.indexOf(event.target);
    const destinations = { ArrowDown: position + 1, ArrowRight: position + 1, ArrowUp: position - 1, ArrowLeft: position - 1, Home: 0, End: checks.length - 1 };
    if (event.key in destinations) { event.preventDefault(); checks[destinations[event.key]]?.focus(); }
  });
  element('backup-file').addEventListener('change', event => inspectBackup(event.target.files[0]));
  for (const id of ['guide', 'restore']) {
    const dialog = element(id);
    dialog.addEventListener('close', () => {
      if (id === 'guide') openTrophy = '';
      else incoming = null;
      const destination = returnFocus?.isConnected ? returnFocus : id === 'restore' ? document.querySelector('[data-action="import"]') : element('collection-title');
      destination.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
  }
  document.addEventListener('keydown', event => {
    const editing = event.target.closest('input, textarea, select, [contenteditable="true"]');
    if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector('dialog[open]')) { event.preventDefault(); element('find').focus(); element('find').scrollIntoView({ block: 'center' }); }
  });
  window.addEventListener('storage', event => {
    if (event.key !== SAVE_SLOT && event.key !== null) return;
    try {
      const changed = event.newValue ? readLedger(JSON.parse(event.newValue), catalogue) : newLedger();
      Object.assign(ledger, { earned: changed.earned, revealed: changed.revealed, prefs: changed.prefs });
      redraw();
      if (openTrophy) drawGuide();
      announce('Checklist updated from another tab.');
    } catch { announce('Another tab saved unreadable progress. Export this checklist to keep a copy.'); }
  });
}

async function enableOffline() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    element('connection').textContent = '● OFFLINE READY';
  } catch {
    element('connection').title = 'Offline caching is unavailable here. Keep the local server running for reloads.';
  }
}

async function boot() {
  try {
    const response = await fetch('./data/trophies.json');
    if (!response.ok) throw new Error(`Catalogue request failed: ${response.status}`);
    publication = await response.json();
    catalogue = publication.trophies;
    if (!Array.isArray(catalogue) || catalogue.length !== 55 || new Set(catalogue.map(item => item.id)).size !== 55) throw new Error('The catalogue must contain 55 distinct trophies.');
    recover();
    bindInterface();
    redraw();
    void enableOffline();
  } catch (error) {
    element('failure').hidden = false;
    element('cards').setAttribute('aria-busy', 'false');
    element('result-label').textContent = 'Collection unavailable';
    document.querySelectorAll('button').forEach(button => { button.disabled = button.dataset.action !== 'reload'; });
    document.querySelector('[data-action="reload"]').onclick = () => location.reload();
    console.error('Ledger initialization failed:', error);
  }
}

void boot();
