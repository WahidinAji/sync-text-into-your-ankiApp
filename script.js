/**
 * chrome-extension/script.js
 *
 * Popup logic for Chrome Extension to interact with AnkiConnect (localhost:8765):
 * - Loads deck names on popup open
 * - Adds a Basic note (Front/Back) with optional tags using addNote (auto-save)
 *
 * No sign-in flow is required. The user syncs via the Anki desktop app.
 */
(() => {
  'use strict';

  // -------- AnkiConnect config --------
  const ANKI_CONNECT_URL = 'http://localhost:8765';
  const ANKI_VERSION = 6;

  // -------- DOM references --------
  const $ = (sel) => document.querySelector(sel);
  const dom = {
    deckSelect: $('#deckSelect'),
    frontInput: $('#frontInput'),
    backInput: $('#backInput'),
    tagsInput: $('#tagsInput'),
    addCardForm: $('#addCardForm'),
    addBtn: $('#addBtn'),
    status: $('#status'),
  };

  // -------- Helpers --------
  function setStatus(message, type = '') {
    if (!dom.status) return;
    dom.status.textContent = message || '';
    dom.status.classList.remove('error', 'success');
    if (type) dom.status.classList.add(type);
  }

  async function anki(action, params = {}) {
    const payload = {
      action,
      version: ANKI_VERSION,
      params,
    };
    let resp;
    try {
      resp = await fetch(ANKI_CONNECT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      const err = new Error('Could not connect to AnkiConnect. Make sure Anki is running and the AnkiConnect add-on is installed.');
      err.cause = e;
      throw err;
    }

    if (!resp.ok) {
      throw new Error(`AnkiConnect HTTP ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json().catch(() => ({}));
    if (data.error) {
      const err = new Error(`AnkiConnect error: ${data.error}`);
      err.data = data;
      throw err;
    }
    return data.result;
  }

  function populateDecks(names) {
    if (!dom.deckSelect) return;
    dom.deckSelect.innerHTML = '';

    if (!names || names.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No decks found';
      opt.disabled = true;
      opt.selected = true;
      dom.deckSelect.appendChild(opt);
      return;
    }

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a deck';
    placeholder.disabled = true;
    placeholder.selected = true;
    dom.deckSelect.appendChild(placeholder);

    for (const name of names) {
      const opt = document.createElement('option');
      opt.value = String(name);
      opt.textContent = String(name);
      dom.deckSelect.appendChild(opt);
    }
  }

  function parseTags(input) {
    if (!input) return [];
    return input
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // -------- UI actions --------
  async function handleAddCardSubmit(e) {
    e.preventDefault();

    const deckName = dom.deckSelect?.value?.trim();
    const front = dom.frontInput?.value?.trim();
    const back = dom.backInput?.value?.trim();
    const tags = parseTags(dom.tagsInput?.value || '');

    if (!deckName) {
      setStatus('Please select a deck.', 'error');
      return;
    }
    if (!front || !back) {
      setStatus('Front and Back are required.', 'error');
      return;
    }

    try {
      dom.addBtn.disabled = true;
      setStatus('Adding card...', '');

      await anki('addNote', {
        note: {
          deckName,
          modelName: 'Basic',
          fields: {
            Front: front,
            Back: back,
          },
          tags,
        },
      });

      // Clear text fields but keep deck selection and tags
      dom.frontInput.value = '';
      dom.backInput.value = '';
      setStatus('Card added to deck successfully.', 'success');
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Failed to add card.', 'error');
    } finally {
      dom.addBtn.disabled = false;
    }
  }

  // -------- Initialization --------
  async function init() {
    // Load deck names (try deckNames; fallback to deckNamesAndIds -> names)
    try {
      setStatus('Loading decks...');
      let decks = await anki('deckNames');
      if (!Array.isArray(decks)) {
        // Fallback if user’s AnkiConnect version responds differently
        const map = await anki('deckNamesAndIds');
        decks = Object.keys(map || {});
      }
      populateDecks(decks);
      setStatus('Ready.');
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Failed to load decks.', 'error');
    }

    dom.addCardForm?.addEventListener('submit', handleAddCardSubmit);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
