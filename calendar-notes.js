/* Personal date notes: one solar YYYY-MM-DD, persisted on this device. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.ManseCalendarNotes = api;
    document.addEventListener('DOMContentLoaded', () => api.init(root));
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const storageKey = 'jansang_calendar_notes_v1';
  const maxLength = 2000;

  function dateKey(year, month, day) {
    if (![year, month, day].every(value => Number.isInteger(Number(value)))) throw new Error('날짜를 확인해 주세요.');
    const y = Number(year), m = Number(month), d = Number(day);
    const probe = new Date(0);
    probe.setUTCFullYear(y, m - 1, d);
    if (y < 1 || y > 9999 || probe.getUTCFullYear() !== y || probe.getUTCMonth() + 1 !== m || probe.getUTCDate() !== d) {
      throw new Error('날짜를 확인해 주세요.');
    }
    return [String(y).padStart(4, '0'), String(m).padStart(2, '0'), String(d).padStart(2, '0')].join('-');
  }

  function checkKey(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key) || dateKey(...key.split('-')) !== key) {
      throw new Error('날짜를 확인해 주세요.');
    }
    return key;
  }

  function createStore(storage) {
    function read() {
      let raw;
      try {
        if (!storage || typeof storage.getItem !== 'function') throw new Error();
        raw = storage.getItem(storageKey);
      } catch (_) { throw new Error('메모 저장소를 열지 못했습니다. 이 기기의 저장 설정을 확인해 주세요.'); }
      if (raw === null) return { version: 1, entries: {} };
      try {
        const value = JSON.parse(raw);
        if (value.version !== 1 || !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries)) throw new Error();
        for (const [key, note] of Object.entries(value.entries)) {
          checkKey(key);
          if (!note || typeof note.text !== 'string' || !note.text.trim() || note.text.length > maxLength || typeof note.updatedAt !== 'string') throw new Error();
        }
        return value;
      } catch (_) { throw new Error('저장된 메모를 읽지 못했습니다. 기존 기록은 보존했습니다.'); }
    }
    function write(value) {
      try { storage.setItem(storageKey, JSON.stringify(value)); }
      catch (_) { throw new Error('메모를 저장하지 못했습니다. 저장 공간과 기기 설정을 확인해 주세요.'); }
    }
    return {
      all: () => read().entries,
      get: key => read().entries[checkKey(key)] || null,
      save(key, text) {
        checkKey(key);
        if (typeof text !== 'string' || !text.trim()) throw new Error('기록할 내용을 입력해 주세요.');
        if (text.length > maxLength) throw new Error(`메모는 ${maxLength.toLocaleString('ko-KR')}자까지 기록할 수 있습니다.`);
        const value = read();
        value.entries[key] = { text: text.trim(), updatedAt: new Date().toISOString() };
        write(value);
        return value.entries[key];
      },
      remove(key) {
        checkKey(key);
        const value = read();
        delete value.entries[key];
        write(value);
      }
    };
  }

  const api = { storageKey, maxLength, dateKey, createStore };
  let deviceStore, app, activeKey, lastOpener, deletePending = false;

  function errorText(message) {
    const el = app.document.getElementById('calendarNoteError');
    el.textContent = message;
    el.hidden = !message;
  }

  function refresh() {
    api.annotate(app.document);
    if (typeof app.renderCalDayDetail === 'function') app.renderCalDayDetail();
  }

  api.annotate = function annotate(container) {
    if (!deviceStore || !container) return;
    let entries;
    try { entries = deviceStore.all(); } catch (_) { return; }
    container.querySelectorAll('.cal-day[data-year], .day-item[data-note-date]').forEach(cell => {
      let key;
      try { key = cell.dataset.noteDate || dateKey(cell.dataset.year, cell.dataset.month, cell.dataset.day); }
      catch (_) { return; }
      cell.dataset.noteDate = key;
      const note = entries[key];
      const dateLabel = `${Number(key.slice(0, 4))}년 ${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일`;
      const details = [...cell.children].filter(child => !child.matches('.date-note-mark, .d, .d-num'))
        .map(child => `${child.matches('.lu') ? '음력 ' : ''}${child.textContent.trim()}`).filter(Boolean).join(', ');
      const label = cell.dataset.noteLabel || `${dateLabel}${details ? `, ${details}` : ''}`;
      cell.classList.toggle('has-date-note', !!note);
      if (cell.matches('button, [role="button"]')) cell.setAttribute('aria-label', `${label}, ${note ? '메모 있음, 수정하기' : '메모 작성하기'}`);
      let mark = cell.querySelector('.date-note-mark');
      if (note && !mark) {
        mark = app.document.createElement('span');
        mark.className = 'date-note-mark';
        mark.textContent = '✓';
        mark.setAttribute('aria-hidden', 'true');
        cell.appendChild(mark);
      } else if (!note && mark) mark.remove();
      cell.title = note ? `메모: ${note.text}` : '';
    });
  };

  api.detail = function detail(container, year, month, day) {
    if (!deviceStore || !container) return;
    const key = dateKey(year, month, day);
    const group = app.document.createElement('div');
    group.className = 'calendar-note-summary';
    const text = app.document.createElement('p');
    text.className = 'calendar-note-preview';
    const button = app.document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-note-edit';
    let note;
    try { note = deviceStore.get(key); }
    catch (error) { text.textContent = error.message; }
    if (!text.textContent) text.textContent = note ? note.text : '날짜를 눌러 기억할 일을 기록하세요.';
    button.textContent = note ? '메모 수정' : '메모 작성';
    button.addEventListener('click', () => api.open(year, month, day, button));
    group.append(text, button);
    container.appendChild(group);
  };

  api.open = function open(year, month, day, opener) {
    if (!app || !deviceStore) return;
    const modal = app.document.getElementById('calendarNoteModal');
    const input = app.document.getElementById('calendarNoteText');
    activeKey = dateKey(year, month, day);
    lastOpener = opener;
    app.document.getElementById('calendarNoteDate').textContent = `${Number(year)}년 ${Number(month)}월 ${Number(day)}일 · 양력`;
    errorText('');
    resetDelete();
    let note, readError;
    try { note = deviceStore.get(activeKey); } catch (error) { readError = error; }
    input.value = note ? note.text : '';
    app.document.getElementById('calendarNoteDelete').hidden = !note;
    app.document.getElementById('calendarNoteSave').disabled = !!readError;
    input.disabled = !!readError;
    if (readError) errorText(readError.message);
    updateCount();
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    app.openAppModal(modal);
  };

  function updateCount() {
    const count = app.document.getElementById('calendarNoteText').value.length;
    app.document.getElementById('calendarNoteCount').textContent = `${count.toLocaleString('ko-KR')} / 2,000`;
  }

  function resetDelete() {
    deletePending = false;
    app.document.getElementById('calendarNoteDelete').textContent = '삭제';
    app.document.getElementById('calendarNoteDeletePrompt').hidden = true;
  }

  function commit(remove) {
    try {
      if (remove) deviceStore.remove(activeKey);
      else deviceStore.save(activeKey, app.document.getElementById('calendarNoteText').value);
    } catch (error) { errorText(error.message); return; }
    errorText('');
    refresh();
    app.closeAppModal(app.document.getElementById('calendarNoteModal'));
    app.showAppToast(remove ? '날짜 메모를 삭제했습니다' : '날짜 메모를 저장했습니다');
    // Detail refresh can replace its opener. Calendar cells remain connected.
    if (lastOpener && !lastOpener.isConnected) {
      const cell = app.document.querySelector(`#calGrid [data-note-date="${activeKey}"]`);
      if (cell) setTimeout(() => { if (!app.document.querySelector('.modal-bg.active')) cell.focus({ preventScroll: true }); }, 250);
    }
  }

  api.init = function init(windowObject) {
    if (app) return;
    app = windowObject;
    let storage;
    try { storage = app.localStorage; } catch (_) { storage = null; }
    deviceStore = createStore(storage);
    const document = app.document;
    document.getElementById('calendarNoteText').addEventListener('input', () => { updateCount(); errorText(''); resetDelete(); });
    document.getElementById('calendarNoteSave').addEventListener('click', () => commit(false));
    document.getElementById('calendarNoteDelete').addEventListener('click', () => {
      if (deletePending) { commit(true); return; }
      deletePending = true;
      document.getElementById('calendarNoteDeletePrompt').hidden = false;
      document.getElementById('calendarNoteDelete').textContent = '삭제 확인';
    });
    document.getElementById('calendarNoteCancel').addEventListener('click', () => app.closeAppModal(document.getElementById('calendarNoteModal')));
    app.addEventListener('storage', event => { if (event.key === storageKey || event.key === null) refresh(); });
    api.annotate(document);
  };
  return api;
});
