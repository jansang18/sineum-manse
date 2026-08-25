const assert = require('node:assert/strict');
const { compose } = require('../unified-reading.js');

const annualIds = ['structure', 'daeun', 'timing', 'work', 'money', 'relationships', 'health', 'movement'];
const deepIds = ['scene', 'capacity', 'desire', 'money', 'work', 'love', 'people', 'loop', 'timing', 'care'];
const section = (id, prefix) => ({
  id,
  title: `${prefix}-${id}`,
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
  sections: deepIds.map(id => section(id, 'deep')),
  closing: { paragraphs: ['closing-paragraph'], rules: ['closing-rule'] }
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
assert.deepEqual(result.rules, ['기준 1', 'closing-rule']);
assert.throws(() => compose({ annualReport: null, deepReport }), /annualReport/);
console.log('Unified reading model PASS');
