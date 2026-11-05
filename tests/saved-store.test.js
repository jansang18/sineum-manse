const test = require('node:test');
const assert = require('node:assert/strict');
const SavedStore = require('../saved-store.js');

test('저장 한도는 10만 개다', () => {
  assert.equal(SavedStore.MAX_RECORDS, 100000);
});

test('조각난 백업 파일에서 기록을 하나씩 꺼낸다', () => {
  const backup = JSON.stringify({ app: '잔상[만세력', version: 1, records: [
    { name: '}{"[', extra: { list: [1, { a: 2 }] } },
    { name: '둘째' }
  ], after: [9] });
  for (const size of [1, 3, 7, 64]) {
    const found = [];
    const scanner = SavedStore.recordScanner(piece => found.push(piece));
    for (let i = 0; i < backup.length; i += size) scanner.push(backup.slice(i, i + size));
    assert.equal(found.at(-1), null);
    assert.deepEqual(found.slice(0, -1).map(piece => JSON.parse(piece).name), ['}{"[', '둘째']);
  }
});

test('즐겨찾기가 먼저, 그다음 최신 순서로 정렬된다', () => {
  const order = record => SavedStore.compact(record).o;
  assert.deepEqual(order({ id: 'a', fav: true, savedAt: 5 }), [0, -5, 'a']);
  assert.deepEqual(order({ id: 'b', savedAt: 9 }), [1, -9, 'b']);
});

test('화면에 필요 없는 큰 계산값은 저장하지 않는다', () => {
  const small = SavedStore.compact({ id: 'a', name: '갑', savedAt: 1, dStem: 0, huge: 'x'.repeat(5000) });
  assert.equal(Object.hasOwn(small, 'huge'), false);
  assert.equal(small.dStem, 0);
});
