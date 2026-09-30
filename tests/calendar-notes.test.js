const test = require('node:test');
const assert = require('node:assert/strict');
const notes = require('../calendar-notes.js');

function memoryStorage() {
  const values = new Map();
  return { values, getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value) };
}

test('notes persist at a complete solar date, without yearly or monthly recurrence', () => {
  const storage = memoryStorage();
  storage.setItem('saju_list', '["unrelated existing saved chart"]');
  const store = notes.createStore(storage);
  const date = notes.dateKey(2026, 10, 17);
  store.save(date, '홍길동 별세\n가족들과 추모');
  const reopened = notes.createStore(storage);
  assert.equal(reopened.get(date).text, '홍길동 별세\n가족들과 추모');
  assert.equal(reopened.get('2027-10-17'), null);
  assert.equal(reopened.get('2026-11-17'), null);
  assert.equal(storage.getItem('saju_list'), '["unrelated existing saved chart"]');
  reopened.save(date, '기록 수정');
  reopened.save('2026-10-18', '다른 날');
  reopened.remove(date);
  assert.equal(store.get(date), null);
  assert.equal(store.get('2026-10-18').text, '다른 날');
});

test('nonexistent dates and excessive/empty text cannot create a record', () => {
  const storage = memoryStorage();
  const store = notes.createStore(storage);
  assert.equal(notes.dateKey(2024, 2, 29), '2024-02-29');
  assert.equal(notes.dateKey(27, 1, 1), '0027-01-01');
  for (const day of [[2026, 2, 29], [2026, 13, 1], [2026, 10, 0], [2026, 1.5, 1]]) {
    assert.throws(() => notes.dateKey(...day));
  }
  for (const key of ['2026-2-01', '2026-02-30', '__proto__']) assert.throws(() => store.save(key, '기록'));
  assert.throws(() => store.save('2026-10-17', '  \n '));
  assert.throws(() => store.save('2026-10-17', '가'.repeat(2001)));
  assert.equal(storage.getItem(notes.storageKey), null);
  assert.equal(store.save('2026-10-17', '가'.repeat(2000)).text.length, 2000);
});

test('failed writes preserve previously saved notes and report the failure', () => {
  const storage = memoryStorage();
  const store = notes.createStore(storage);
  store.save('2026-10-17', '원래 기록');
  const before = storage.getItem(notes.storageKey);
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => store.save('2026-10-18', '새 기록'), /저장하지 못했습니다/);
  assert.throws(() => store.remove('2026-10-17'), /저장하지 못했습니다/);
  assert.equal(storage.getItem(notes.storageKey), before);
  assert.equal(store.get('2026-10-17').text, '원래 기록');
});

test('unreadable data is preserved; a corrupt document is never silently replaced', () => {
  const storage = memoryStorage();
  const store = notes.createStore(storage);
  for (const raw of ['{broken', '{"version":2,"entries":{}}', '{"version":1,"entries":{"2026-02-30":{"text":"record","updatedAt":"date"}}}']) {
    storage.setItem(notes.storageKey, raw);
    assert.throws(() => store.save('2026-10-17', '새 기록'), /기존 기록은 보존/);
    assert.equal(storage.getItem(notes.storageKey), raw);
  }
  assert.throws(() => notes.createStore(null).get('2026-10-17'), /저장소를 열지 못했습니다/);
});
