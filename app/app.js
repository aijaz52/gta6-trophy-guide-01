import { STORAGE_KEY, LEGACY_KEY, PHASES, DEFAULT_PREFS, getTrophyProgress, getRoadmapSteps, isConcealed, reconcilePlatinum, parseProgress, makeBackup, selectTrophies } from './model.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escape = (value) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let data;
let trophies = [];
let byId = new Map();
let toastTimer;
let pendingImport;
let activeDetail = null;
let dialogOpener = null;
let storageAvailable = true;
const DEFAULT_FILTERS = { filter: 'all', tier: 'all', phase: null, query: '' };
const state = { earned: new Set(), revealed: new Set(), prefs: { ...DEFAULT_PREFS }, ...DEFAULT_FILTERS };

function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5000);
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeBackup(state)));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
    notify('Device storage is unavailable. Export your progress to keep a backup.');
  }
  updateSaveStatus();
}

function updateSaveStatus() {
  const small = $('.device-status small');
  small.textContent = storageAvailable ? 'Saved locally. Always yours.' : 'Session only. Export to save.';
  $('#offline-status').title = storageAvailable ? 'Your checklist is saved in this browser. No account or external requests.' : 'Storage unavailable. Export before leaving this page.';
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      Object.assign(state, parseProgress(JSON.parse(raw), trophies));
    } else {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        Object.assign(state, parseProgress(JSON.parse(legacy), trophies));
        persist();
        notify('Your original checklist has moved into the Ledger. Welcome back.');
      }
    }
  } catch (error) {
    if (error.name === 'SecurityError' || error.name === 'QuotaExceededError') storageAvailable = false;
    notify('Saved progress could not be read. Your stored backup has been preserved.');
  }
  updateSaveStatus();
}

function tierSymbol() {
  return '<span class="trophy-symbol" aria-hidden="true"></span>';
}

function renderSummary() {
  const { count, points, remaining, percent } = getTrophyProgress(trophies, state.earned);
  const roundedPercent = Math.round(percent);
  $('#earned-total').textContent = count;
  $('#progress-percent').innerHTML = `${roundedPercent}<small>%</small>`;
  $('#progress-ring').style.setProperty('--progress', `${percent}%`);
  $('#progress-ring').setAttribute('aria-label', `${roundedPercent}% complete`);
  $('#progress-caption').textContent = count === 0 ? 'A fresh start. A whole state of possibilities.' : remaining === 0 ? 'Leonida Legend. Every last one is yours.' : `${remaining} more little victories on the road to platinum.`;
  $('#earned-count').textContent = count;
  $('#nav-earned-count').textContent = count;
  $('#gamerscore').textContent = points.toLocaleString('en-US');
  $('#gamerscore-fill').style.width = `${points / 10}%`;
  $('#story-count').textContent = trophies.filter(t => t.story).length;
  $('#hidden-count').textContent = trophies.filter(t => t.hidden).length;
  $('#tier-totals').innerHTML = ['platinum', 'gold', 'silver', 'bronze'].map(tier => {
    const group = trophies.filter(t => t.tier === tier);
    const earned = group.filter(t => state.earned.has(t.id)).length;
    return `<button class="tier-total" data-tier="${tier}" aria-pressed="${state.tier === tier}" aria-label="${escape(tier)}: ${earned} of ${group.length} earned. Filter ${escape(tier)} trophies.">${tierSymbol()}<strong>${earned}<span> / ${group.length}</span></strong><span class="tier-name">${tier}</span></button>`;
  }).join('');
  $('#timeline').innerHTML = getRoadmapSteps(trophies, state.earned).map(({ id, title, short, number, count, total, remaining, complete, current }) => {
    return `<button class="timeline-stage ${complete ? 'is-complete' : ''}" data-phase="${id}" aria-pressed="${state.phase === id}"${current ? ' aria-current="step"' : ''} aria-label="${title}: ${count} of ${total} trophies earned, ${remaining} remaining.${current ? ' Next suggested stage.' : ''} Filter this stage."><span class="stage-number">${complete ? '✓' : String(number).padStart(2, '0')}</span><span class="stage-copy"><span class="stage-title">${short}</span><span class="stage-count">${count} / ${total} earned</span></span></button>`;
  }).join('');
}

function cardTags(trophy, { earned, concealed, platinum }) {
  const tags = [];
  if (earned) tags.push('<span class="tag earned-tag">✓ EARNED</span>');
  if (trophy.missable) tags.push('<span class="tag warning">! POTENTIALLY MISSABLE</span>');
  if (trophy.story) tags.push('<span class="tag story-tag">STORY</span>');
  if (trophy.hidden) tags.push('<span class="tag hidden-tag">HIDDEN</span>');
  if (tags.length === 0) {
    const category = platinum ? 'THE ULTIMATE GOAL' : trophy.category.toUpperCase();
    tags.push(`<span class="tag">${escape(category)}</span>`);
  }
  if (trophy.uncertainty && !concealed && !trophy.missable && !platinum) {
    tags.push('<span class="tag warning">SOURCE NOTE</span>');
  }
  return tags.join('');
}

function cardMarkup(trophy) {
  const { id, tier, chapter } = trophy;
  const concealed = isConcealed(trophy, state);
  const earned = state.earned.has(id);
  const platinum = tier === 'platinum';
  const name = escape(concealed ? 'Hidden trophy' : trophy.name);
  const description = escape(concealed ? 'A story still waiting to be told. Reveal when you’re ready.' : trophy.description);
  const emblem = concealed ? '<span class="hidden-symbol" aria-hidden="true">?</span>' : tierSymbol();
  const points = platinum ? 'MYTHIC' : `${trophy.points} G`;
  let categoryLabel = 'TAKE IT AT YOUR PACE';
  if (concealed) categoryLabel = 'Spoiler protected';
  else if (platinum) categoryLabel = '54 trophies. One legend.';
  else if (chapter) categoryLabel = `CHAPTER ${chapter} ONWARD`;
  const guideAction = concealed
    ? `<button class="reveal-card" data-reveal="${id}">Reveal trophy <span aria-hidden="true">↗</span></button>`
    : `<button data-detail="${id}">View guide <span aria-hidden="true">↗</span></button>`;

  return `<article class="trophy-card ${earned ? 'earned' : ''} ${concealed ? 'is-hidden' : ''}" data-id="${id}" data-tier="${tier}">
    <div class="card-top">
      <span class="trophy-emblem">${emblem}</span>
      <span class="tier-badge">${tier}</span>
      <span class="points">${points}</span>
      <label class="earned-check">
        <input type="checkbox" data-earn="${id}" ${earned ? 'checked' : ''} aria-label="Mark ${name} as ${earned ? 'not earned' : 'earned'}">
      </label>
    </div>
    <button class="card-guide-button" data-detail="${id}" aria-label="Open guide: ${name}">
      <h3>${name}</h3><p class="card-description">${description}</p>
    </button>
    <div class="card-tags">${cardTags(trophy, { earned, concealed, platinum })}</div>
    <div class="card-bottom"><span class="category-label">${categoryLabel}</span>${guideAction}</div>
  </article>`;
}

function renderCollectionStatus(resultCount) {
  const phase = PHASES.find(p => p.id === state.phase);
  const summary = [`Showing ${resultCount} of ${trophies.length} trophies`];
  if (phase) summary.push(phase.title);
  if (state.filter === 'hidden') summary.push('Editorial spoiler flags');
  $('#results-count').textContent = summary.join(' · ');
  $('#empty-state').hidden = resultCount > 0;

  const hasQuery = state.query.trim().length > 0;
  let emptyDescription = 'Try a different search or clear your filters.';
  if (hasQuery && state.prefs.protected) {
    emptyDescription = 'Try another keyword. Unrevealed hidden names and guides are excluded from search.';
  } else if (state.filter === 'earned') {
    emptyDescription = 'Your journey starts with the first checkmark. Mark a trophy earned to see it here.';
  }
  $('#empty-description').textContent = emptyDescription;
  const hasFilters = state.filter !== DEFAULT_FILTERS.filter || state.tier !== DEFAULT_FILTERS.tier || Boolean(state.phase) || hasQuery;
  $('#clear-filters').hidden = !hasFilters;
}

function renderCollection() {
  const grid = $('#trophy-grid');
  const focused = document.activeElement;
  const focusedId = focused?.dataset.earn;
  const focusedIndex = focusedId ? [...grid.querySelectorAll('[data-earn]')].indexOf(focused) : -1;

  const results = selectTrophies(trophies, state);
  grid.classList.toggle('list-view', state.prefs.view === 'list');
  grid.innerHTML = results.map(cardMarkup).join('');
  grid.setAttribute('aria-busy', 'false');
  renderCollectionStatus(results.length);
  renderCollectionControls();

  if (focusedIndex >= 0) {
    const checkboxes = [...grid.querySelectorAll('[data-earn]')];
    const sameTrophy = checkboxes.find(checkbox => checkbox.dataset.earn === focusedId);
    const nextFocus = sameTrophy ?? checkboxes[Math.min(focusedIndex, checkboxes.length - 1)] ?? $('#empty-clear');
    nextFocus.focus({ preventScroll: nextFocus === sameTrophy && checkboxes[focusedIndex] === sameTrophy });
  }
}

function renderCollectionControls() {
  $$('.filter-tab').forEach(button => {
    const active = state.filter === button.dataset.filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $('#tier-filter').value = state.tier;
  $('#sort').value = state.prefs.sort;
  for (const view of ['grid', 'list']) {
    const button = $(`#${view}-view`);
    const active = state.prefs.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  $('#spoiler-toggle').setAttribute('aria-checked', String(state.prefs.protected));
  $('#nav-earned').classList.toggle('active', state.filter === 'earned');
  $('#nav-trophies').classList.toggle('active', state.filter !== 'earned' && !state.phase);
  $('#nav-roadmap').classList.toggle('active', Boolean(state.phase));
}

function render() {
  const focused = document.activeElement;
  const summaryFocus = focused?.closest('#tier-totals [data-tier], #timeline [data-phase]');
  const focusSelector = summaryFocus?.dataset.tier
    ? `#tier-totals [data-tier="${summaryFocus.dataset.tier}"]`
    : summaryFocus?.dataset.phase ? `#timeline [data-phase="${summaryFocus.dataset.phase}"]` : null;
  renderSummary();
  renderCollection();
  if (focusSelector) $(focusSelector)?.focus({ preventScroll: true });
}

function restoreCardFocus(id, selector) {
  requestAnimationFrame(() => $(`.trophy-card[data-id="${id}"] ${selector}`)?.focus({ preventScroll: true }));
}

function setEarned(id, next) {
  const t = byId.get(id);
  if (!t) return;
  if (t.tier === 'platinum' && next && !trophies.every(other => other.id === id || state.earned.has(other.id))) {
    renderCollection();
    notify('The platinum unlocks automatically when you earn the other 54 trophies.');
    return;
  }
  // Platinum is a derived completion reward and cannot be unchecked on its own.
  if (t.tier === 'platinum' && !next && state.earned.size === 55) {
    renderCollection();
    notify('Platinum follows your collection. Uncheck another trophy to remove it.');
    return;
  }
  const hadPlatinum = state.earned.has('vice-got-a-price');
  if (next) state.earned.add(id);
  else state.earned.delete(id);
  reconcilePlatinum(state.earned, trophies);
  persist();
  render();
  if (activeDetail === id) renderDetail(id);
  if (!hadPlatinum && state.earned.has('vice-got-a-price')) notify('Leonida Legend! All 55 trophies and the platinum are yours.');
  else if (storageAvailable) notify(next ? 'Trophy earned. Another little victory, saved.' : 'Trophy marked as not earned. Progress saved.');
}

function reveal(id) {
  if (!byId.has(id)) return;
  state.revealed.add(id);
  persist();
  renderCollection();
  if (activeDetail === id) renderDetail(id);
}

function openDialog() {
  dialogOpener = document.activeElement;
  $('#detail-dialog').showModal();
  document.body.classList.add('dialog-open');
  $('#detail-dialog').scrollTop = 0;
  $('#close-detail').focus({ preventScroll: true });
}

function openDetail(id) {
  activeDetail = id;
  renderDetail(id);
  if (!$('#detail-dialog').open) openDialog();
}

function renderDetail(id) {
  const t = byId.get(id);
  if (!t) return;
  $('#dialog-eyebrow').textContent = 'THE TROPHY FIELD GUIDE';
  if (isConcealed(t, state)) {
    $('#detail-content').innerHTML = `<div class="detail-locked"><span class="locked-symbol" aria-hidden="true">?</span><h2 id="detail-title">Some stories are<br>better discovered.</h2><p>This hidden trophy is protected. Reveal just this guide<br>or mark it earned when you unlock it in-game.</p><button class="primary-button" data-reveal="${t.id}">Reveal this trophy</button><br><button class="secondary-button" data-detail-earn="${t.id}">I’ve earned this trophy</button></div>`;
    return;
  }
  const earned = state.earned.has(id);
  const sources = t.sources.map(key => {
    const source = data.sources[key];
    return `<div class="source-citation"><strong>${escape(source.name)}</strong><code>${escape(source.url)}</code><small>${escape(source.context)}</small></div>`;
  }).join('');
  $('#detail-content').innerHTML = `<div class="detail-tier" data-tier="${t.tier}"><span class="trophy-emblem">${tierSymbol()}</span><span class="tier-badge">${t.tier}</span><span class="points">${t.tier === 'platinum' ? 'MYTHIC ACHIEVEMENT · NO G SPECIFIED' : `${t.points} XBOX G`}</span></div>
    <h2 id="detail-title">${escape(t.name)}</h2>
    <p class="detail-description"><span class="description-label">${t.descriptionType === 'official' ? 'Official description · as supplied' : 'Unlock condition · as supplied'}</span>${escape(t.description)}</p>
    <div class="detail-actions"><button class="primary-button" data-detail-earn="${t.id}" aria-pressed="${earned}">${earned ? '✓ Earned · undo' : 'Mark as earned'} <span aria-hidden="true">${earned ? '↶' : '+'}</span></button>${t.story ? '<span class="tag story-tag">STORY TROPHY</span>' : ''}${t.hidden ? '<span class="tag hidden-tag">SPOILER FLAG</span>' : ''}${t.hidden && state.revealed.has(id) && !earned ? `<button class="text-button" data-hide="${t.id}">Hide again</button>` : ''}</div>
    ${t.whenMissed ? `<aside class="detail-warning"><strong>! CHAPTER 1 · POTENTIALLY MISSABLE</strong>${escape(t.whenMissed)}</aside>` : ''}
    <h3 class="detail-subheading">Your route to the unlock</h3><ol class="guide-steps">${t.steps.map(step => `<li>${escape(step)}</li>`).join('')}</ol>
    ${t.uncertainty ? `<aside class="detail-caveat"><strong>SOURCE CAVEAT</strong>${escape(t.uncertainty)}</aside>` : ''}
    <section class="guide-sources" aria-label="Source citations"><h3 class="detail-subheading">From the field notes</h3>${sources}<p class="source-footnote">Local source: TROPHY_SOURCE_NOTES.txt, lines ${escape(t.sourceLines)} · November 18, 2026. Citations are displayed offline; nothing is fetched from these sites.${t.hidden ? ' Hidden status is an editorial spoiler flag, not a confirmed platform flag.' : ''}</p></section>`;
}

function openSources() {
  activeDetail = null;
  $('#dialog-eyebrow').textContent = 'A NOTE FROM THE LEDGER';
  $('#detail-content').innerHTML = `<h2 id="detail-title">A guide with<br>its sources in view.</h2><div class="detail-prose"><p>This offline fan companion follows the supplied <strong>TROPHY_SOURCE_NOTES.txt</strong>, dated November 18, 2026. It contains 55 entries: 1 platinum, 2 gold, 6 silver, and 46 bronze. The notes have not been independently verified.</p><h3>The source trail</h3>${Object.values(data.sources).map(source => `<div class="source-citation"><strong>${escape(source.name)}</strong><code>${escape(source.url)}</code><small>${escape(source.context)}</small></div>`).join('')}<h3>What is known, and what is inferred</h3><p>${escape(data.notes.descriptions)}</p><p>${escape(data.notes.hidden)}</p><p>${escape(data.notes.missable)}</p><p>${escape(data.notes.points)}</p><p>${escape(data.notes.rarity)}</p><h3>A careful route to platinum</h3><p>The notes attribute an approximately <strong>200-hour</strong> completion estimate to GTABase. They also report <strong>no mission replay, no difficulty selection, and no New Game+</strong>. Free roam continues after the story. Turn cheats off, accept the early meditation invitation, and use the in-game completion checklist for the final sweep.</p><h3>Your data belongs to you</h3><p>Checkmarks, individual reveals, and display preferences stay in this browser’s localStorage. Export a JSON backup to move them to another device. Clearing browser data removes this device’s copy. No analytics, accounts, remote fonts, or remote requests are used.</p><p>The app also caches its own static files for offline reloads where service workers are supported. Initial loading uses only this local server.</p>
    <p><strong>Keyboard</strong> — Press / to search and Tab to move between controls. On a trophy checkbox, use the arrow keys to move through the displayed checklist and Space to toggle the focused trophy. Press Escape to close a guide.</p><p>Revealing a trophy affects only that trophy. The spoiler switch controls the whole collection.</p></div>`;
  if (!$('#detail-dialog').open) openDialog();
}

function resetFilters(overrides) {
  Object.assign(state, DEFAULT_FILTERS, overrides);
  $('#search').value = state.query;
  render();
}

function exportProgress() {
  const blob = new Blob([JSON.stringify(makeBackup(state), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leonida-ledger-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Your progress backup is ready. Keep it somewhere safe.');
}

async function prepareImport(file) {
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('Choose a progress JSON file smaller than 1 MB.');
    pendingImport = parseProgress(JSON.parse(await file.text()), trophies);
    $('#import-summary').textContent = `This backup contains ${pendingImport.earned.size} earned trophies and ${pendingImport.revealed.size} individual reveals. You currently have ${state.earned.size} earned trophies.`;
    $('#import-dialog').showModal();
    document.body.classList.add('dialog-open');
  } catch (error) {
    notify(error instanceof SyntaxError ? 'That file is not valid JSON. Your progress has not changed.' : error.message);
    pendingImport = null;
  } finally {
    $('#import-file').value = '';
  }
}

function applyImport(mode) {
  if (!pendingImport) return;
  if (mode === 'merge') {
    pendingImport.earned.forEach(id => state.earned.add(id));
    pendingImport.revealed.forEach(id => state.revealed.add(id));
  } else {
    state.earned = new Set(pendingImport.earned);
    state.revealed = new Set(pendingImport.revealed);
  }
  // Keep the current device's spoiler setting when importing someone else's backup.
  reconcilePlatinum(state.earned, trophies);
  persist();
  render();
  $('#import-dialog').close();
  pendingImport = null;
  if (storageAvailable) notify(`Progress ${mode === 'merge' ? 'merged' : 'replaced'} and saved. ${state.earned.size} trophies earned.`);
}

function moveChecklistFocus(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const { key, target, currentTarget } = event;
  if (!target.matches('[data-earn]')) return;

  let step;
  if (key === 'ArrowDown' || key === 'ArrowRight') step = 1;
  else if (key === 'ArrowUp' || key === 'ArrowLeft') step = -1;
  else if (key === 'Home') step = -Infinity;
  else if (key === 'End') step = Infinity;
  else return;

  event.preventDefault();
  const checkboxes = [...currentTarget.querySelectorAll('[data-earn]')];
  if (step === -Infinity) checkboxes[0]?.focus();
  else if (step === Infinity) checkboxes.at(-1)?.focus();
  else checkboxes[checkboxes.indexOf(target) + step]?.focus();
}

function wireEvents() {
  $('.collection-tabs').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    state.phase = null;
    render();
  });
  $('#search').addEventListener('input', event => { state.query = event.target.value; renderCollection(); });
  $('#search').addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.isComposing || !event.currentTarget.value) return;
    event.preventDefault();
    event.currentTarget.value = '';
    state.query = '';
    renderCollection();
  });
  $('#tier-filter').addEventListener('change', event => { state.tier = event.target.value; render(); });
  $('#tier-totals').addEventListener('click', event => {
    const button = event.target.closest('[data-tier]');
    if (!button) return;
    state.tier = state.tier === button.dataset.tier ? 'all' : button.dataset.tier;
    render();
    $('#trophies').scrollIntoView({ block: 'start' });
  });
  $('#sort').addEventListener('change', event => { state.prefs.sort = event.target.value; persist(); renderCollection(); });
  for (const view of ['grid', 'list']) $(`#${view}-view`).addEventListener('click', () => { state.prefs.view = view; persist(); renderCollection(); });
  $('#spoiler-toggle').addEventListener('click', () => {
    state.prefs.protected = !state.prefs.protected;
    persist(); renderCollection();
    if (activeDetail) renderDetail(activeDetail);
    notify(state.prefs.protected ? 'Spoiler protection on. Earned and individually revealed trophies stay visible.' : 'Spoiler protection off. All trophy names and guides are visible.');
  });
  const grid = $('#trophy-grid');
  // Space uses the checkbox's native activation and reaches the same change handler as a click.
  grid.addEventListener('keydown', moveChecklistFocus);
  grid.addEventListener('change', event => {
    const input = event.target.closest('[data-earn]');
    if (!input) return;
    setEarned(input.dataset.earn, input.checked);
  });
  grid.addEventListener('click', event => {
    const detail = event.target.closest('[data-detail]');
    if (detail) openDetail(detail.dataset.detail);
    const revealButton = event.target.closest('[data-reveal]');
    if (revealButton) {
      const id = revealButton.dataset.reveal;
      reveal(id);
      restoreCardFocus(id, '.card-guide-button');
    }
  });
  $('#detail-content').addEventListener('click', event => {
    const revealButton = event.target.closest('[data-reveal]');
    if (revealButton) { reveal(revealButton.dataset.reveal); $('#detail-content [data-detail-earn]')?.focus({ preventScroll: true }); }
    const earn = event.target.closest('[data-detail-earn]');
    if (earn) { setEarned(earn.dataset.detailEarn, !state.earned.has(earn.dataset.detailEarn)); $('#detail-content [data-detail-earn]')?.focus({ preventScroll: true }); }
    const hide = event.target.closest('[data-hide]');
    if (hide) { state.revealed.delete(hide.dataset.hide); persist(); renderCollection(); renderDetail(hide.dataset.hide); $('#detail-content [data-reveal]')?.focus({ preventScroll: true }); }
  });
  $('#timeline').addEventListener('click', event => {
    const button = event.target.closest('[data-phase]');
    if (!button) return;
    const { phase } = button.dataset;
    resetFilters({ phase: state.phase === phase ? null : phase });
    $('#trophies').scrollIntoView({ block: 'start' });
  });
  $('#roadmap-guide').addEventListener('click', () => {
    const target = $('#roadmap-expanded');
    target.hidden = !target.hidden;
    $('#roadmap-guide').setAttribute('aria-expanded', String(!target.hidden));
    if (!target.hidden) target.innerHTML = `<h3>About 200 hours. A route worth taking.</h3><p>A suggested order, not a lockstep schedule. Optional activities can be mixed into the story.</p><ol>${PHASES.map(phase => `<li><strong>${escape(phase.title)}.</strong> ${escape(phase.detail)}</li>`).join('')}</ol><p>Estimate and replay limitations are attributed to GTABase in the supplied notes. The in-game 100% checklist has the final word.</p>`;
  });
  $('#roadmap-guide').setAttribute('aria-expanded', 'false');
  $('#roadmap-guide').setAttribute('aria-controls', 'roadmap-expanded');
  $('#missable-guide').addEventListener('click', () => openDetail('positive-mental-attitude'));
  $('#nav-earned').addEventListener('click', () => {
    resetFilters({ filter: 'earned' });
    $('#trophies').scrollIntoView({ block: 'start' });
  });
  $('#nav-trophies').addEventListener('click', () => resetFilters());
  $('#nav-roadmap').addEventListener('click', () => { if ($('#roadmap-expanded').hidden) $('#roadmap-guide').click(); });
  $('.brand').addEventListener('click', () => { resetFilters(); window.scrollTo({ top: 0 }); });
  for (const button of [$('#clear-filters'), $('#empty-clear')]) {
    button.addEventListener('click', () => {
      resetFilters();
      $('#search').focus({ preventScroll: true });
    });
  }
  $('#about-sources').addEventListener('click', openSources);
  $('#footer-notes').addEventListener('click', openSources);
  $('#close-detail').addEventListener('click', () => $('#detail-dialog').close());
  $('#detail-dialog').addEventListener('close', () => {
    activeDetail = null;
    document.body.classList.remove('dialog-open');
    if (dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true });
    else {
      $('#collection-title').setAttribute('tabindex', '-1');
      $('#collection-title').focus({ preventScroll: true });
    }
  });
  for (const dialog of [$('#detail-dialog'), $('#import-dialog')]) {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  }
  $('#export-progress').addEventListener('click', exportProgress);
  $('#import-progress').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', event => prepareImport(event.target.files[0]));
  $('#merge-import').addEventListener('click', () => applyImport('merge'));
  $('#replace-import').addEventListener('click', () => applyImport('replace'));
  $('#cancel-import').addEventListener('click', () => $('#import-dialog').close());
  $('#import-dialog').addEventListener('close', () => { pendingImport = null; document.body.classList.remove('dialog-open'); $('#import-progress').focus({ preventScroll: true }); });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
      event.preventDefault(); $('#search').focus(); $('#search').scrollIntoView({ block: 'center' });
    }
  });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    try {
      const updated = event.newValue ? parseProgress(JSON.parse(event.newValue), trophies) : { earned: new Set(), revealed: new Set(), prefs: { ...DEFAULT_PREFS } };
      Object.assign(state, updated);
      render();
      if (activeDetail) renderDetail(activeDetail);
      notify('Progress updated from another tab.');
    } catch { notify('Another tab saved unreadable data. Export this tab’s progress as a backup.'); }
  });
}

async function init() {
  try {
    const response = await fetch('./data/trophies.json');
    if (!response.ok) throw new Error('Local trophy data unavailable');
    data = await response.json();
    trophies = data.trophies;
    if (!Array.isArray(trophies) || trophies.length !== 55) throw new Error('Invalid trophy collection');
    byId = new Map(trophies.map(t => [t.id, t]));
    loadSaved();
    wireEvents();
    render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').then(async registration => {
        await navigator.serviceWorker.ready;
        $('#offline-status').innerHTML = '<span class="status-dot"></span> OFFLINE READY';
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) notify('A local app update is ready. Reload when you’re ready.');
          });
        });
      }).catch(() => { $('#offline-status').title = 'All resources are local. Keep node serve.ts running for reloads; offline caching is unavailable in this browser.'; });
    }
  } catch (error) {
    $('#load-error').hidden = false;
    $('#trophy-grid').setAttribute('aria-busy', 'false');
    $('#results-count').textContent = 'Collection unavailable';
    $('#reload-app').addEventListener('click', () => location.reload());
    for (const button of $$('button')) if (button.id !== 'reload-app') button.disabled = true;
    console.error('Could not initialize the local trophy collection:', error);
  }
}

init();
