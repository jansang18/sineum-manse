(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SajuUnifiedReading = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GROUPS = [
    { id: 'core', title: '올해의 핵심', annual: ['structure'], deep: ['scene', 'capacity', 'desire', 'timing'] },
    { id: 'work-money', title: '일과 재물', annual: ['work', 'money'], deep: ['work', 'money'] },
    { id: 'relationships-life', title: '관계와 생활', annual: ['relationships'], deep: ['love', 'people', 'loop'] },
    { id: 'health-caution', title: '건강과 주의', annual: ['health'], deep: ['care'] },
    { id: 'action', title: '실행 기준', annual: ['timing', 'movement'], deep: [] }
  ];

  function paragraphs(section) {
    return Array.isArray(section?.paragraphs) ? section.paragraphs.slice() : [];
  }

  function evidence(section) {
    return Array.isArray(section?.evidence) ? section.evidence.slice() : [];
  }

  function compose(input) {
    const annualReport = input?.annualReport;
    const deepReport = input?.deepReport;
    if (!annualReport || !Array.isArray(annualReport.sections)) {
      throw new TypeError('annualReport.sections is required');
    }

    const annual = new Map(annualReport.sections.map(section => [section.id, section]));
    const deep = new Map((deepReport?.sections || []).map(section => [section.id, section]));
    const yearGroups = GROUPS.map(group => ({
      id: group.id,
      title: group.title,
      paragraphs: [
        ...group.annual.flatMap(id => paragraphs(annual.get(id))),
        ...group.deep.flatMap(id => paragraphs(deep.get(id)))
      ],
      evidence: [
        ...group.annual.flatMap(id => evidence(annual.get(id))),
        ...group.deep.flatMap(id => evidence(deep.get(id)))
      ]
    }));

    const closing = deepReport?.closing || {};
    yearGroups[yearGroups.length - 1].paragraphs.push(...paragraphs(closing));

    return {
      year: annualReport.year,
      ganji: annualReport.ganji,
      title: annualReport.title,
      deck: annualReport.deck,
      evidence: Array.isArray(annualReport.evidence) ? annualReport.evidence.slice() : [],
      yearGroups,
      months: Array.isArray(annualReport.months) ? annualReport.months.slice(0, 12) : [],
      daeun: annual.get('daeun') || { id: 'daeun', title: '현재 대운 풀이', paragraphs: [] },
      rules: [
        ...(Array.isArray(annualReport.rules) ? annualReport.rules : []),
        ...(Array.isArray(closing.rules) ? closing.rules : [])
      ]
    };
  }

  return Object.freeze({ compose });
});
