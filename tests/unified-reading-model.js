const assert = require('node:assert/strict');
const { compose } = require('../unified-reading.js');

const annualIds = ['structure', 'daeun', 'timing', 'work', 'money', 'relationships', 'health', 'movement'];
const deepIds = ['scene', 'capacity', 'desire', 'money', 'work', 'love', 'people', 'loop', 'timing', 'care'];
const section = (id, prefix) => ({
  id,
  title: `${prefix}-${id}`,
  lead: `${prefix}-${id}-lead`,
  summary: `${prefix}-${id}-summary`,
  paragraphs: [`${prefix}-${id}-paragraph`],
  evidence: [`${prefix}-${id}-evidence`]
});

const annualReport = {
  year: 2026,
  ganji: '병오',
  title: '2026년 상세운',
  deck: '연도 안내',
  evidence: ['연도 근거'],
  sections: annualIds.map(id => section(id, 'annual')),
  months: Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    label: `${index + 1}월`,
    ganji: '병인',
    guidance: `month-${index + 1}`
  })),
  rules: ['기준 1']
};
const deepReport = {
  eyebrow: 'deep-eyebrow',
  title: 'deep-title',
  deck: 'deep-deck',
  sections: deepIds.map(id => section(id, 'deep')),
  closing: { title: 'closing-title', paragraphs: ['closing-paragraph'], rules: ['closing-rule'] }
};

const result = compose({ annualReport, deepReport });
assert.equal(result.year, 2026);
assert.deepEqual(result.yearGroups.map(group => group.id), [
  'core', 'work-money', 'relationships-life', 'health-caution', 'action'
]);
assert.equal(result.months.length, 12);
assert.equal(result.daeun.paragraphs[0], 'annual-daeun-paragraph');
assert.ok(result.yearGroups.flatMap(group => group.paragraphs).includes('deep-money-paragraph'));
assert.ok(result.yearGroups.flatMap(group => group.paragraphs).includes('closing-paragraph'));
assert.equal(result.yearGroups.flatMap(group => group.paragraphs).includes('annual-daeun-paragraph'), false);
assert.deepEqual(result.deepIntro, {
  eyebrow: 'deep-eyebrow',
  title: 'deep-title',
  deck: 'deep-deck'
});
assert.equal(result.yearGroups.flatMap(group => group.chapters).filter(chapter => chapter.source === 'deep').length, 10);
assert.ok(result.yearGroups.flatMap(group => group.chapters).some(chapter => chapter.title === 'deep-scene'));
assert.ok(result.yearGroups.flatMap(group => group.chapters).some(chapter => chapter.lead === 'deep-scene-lead'));
assert.ok(result.yearGroups.flatMap(group => group.chapters).some(chapter => chapter.title === 'closing-title'));
assert.deepEqual(result.rules, ['기준 1', 'closing-rule']);
assert.throws(() => compose({ annualReport: null, deepReport }), /annualReport/);
console.log('Unified reading model PASS');
