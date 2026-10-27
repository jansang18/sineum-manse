const test = require('node:test');
const assert = require('node:assert/strict');
let ui = {};
try { ui = require('../presentation.js'); } catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}
test('blank and legacy unnamed charts have natural titles without changing stored names', () => {
  assert.equal(typeof ui.chartLabel, 'function', 'central chart label is missing');
  assert.equal(ui.chartLabel({ name: '이름 없음' }, 'natal'), '나의 원국');
  assert.equal(ui.chartLabel({ name: '' }, 'fortune'), '나의 올해운');
  assert.equal(ui.chartLabel({ name: '  ' }, 'fortune', 2027), '나의 2027년 운세');
  assert.equal(ui.chartLabel({ name: '박정민' }, 'fortune'), '박정민님의 올해운');
  assert.equal(ui.chartLabel({ name: '민수' }, 'fortune'), '민수님의 올해운');
  assert.equal(ui.chartLabel({ name: '이름 없음', year: 2000, month: 1, day: 2, gender: 'F' }, 'saved'), '2000.01.02 · 여성');
});
test('unnamed reading text is normalized only at presentation and named prose stays untouched', () => {
  assert.equal(typeof ui.readingText, 'function');
  assert.equal(ui.readingText('2026년 병오년, 이름 없음님의 상세운', { name: '이름 없음' }), '2026년 병오년, 나의 상세운');
  assert.equal(ui.readingText('이름 없음의 명식은 한 문장으로 끝나지 않습니다.', { name: '' }), '이 명식은 한 문장으로 끝나지 않습니다.');
  assert.equal(ui.readingText('민수님의 명식은 ...', { name: '민수' }), '민수님의 명식은 ...');
});
test('icons are trusted decorative SVGs, never arbitrary user markup', () => {
  assert.equal(typeof ui.icon, 'function');
  assert.match(ui.icon('search'), /aria-hidden="true"/);
  assert.match(ui.icon('search'), /stroke="currentColor"/);
  assert.equal(ui.icon('<img onerror=alert(1)>'), '');
});
