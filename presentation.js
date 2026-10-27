/* Presentation-only helpers: never normalize or migrate stored chart data. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MansePresentation = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function nameOf(record) {
    const value = String(record?.name || '').trim();
    return value === '이름 없음' ? '' : value;
  }
  function chartLabel(record, context, year) {
    const name = nameOf(record);
    const date = [record?.year, String(record?.month || '').padStart(2,'0'), String(record?.day || '').padStart(2,'0')].join('.');
    if (context === 'saved') return name || `${date} · ${record?.gender === 'M' ? '남성' : '여성'}`;
    if (context === 'natal') return name || '나의 원국';
    if (context === 'share') return name ? `${name}님의 사주` : '나의 사주';
    if (context === 'fortune') return `${name ? name + '님의' : '나의'} ${year ? year + '년 운세' : '올해운'}`;
    return name || '나의 명반';
  }
  function readingText(value, record) {
    let text = String(value || '');
    if (nameOf(record)) return text;
    return text.replaceAll('이름 없음의 명식은', '이 명식은')
      .replaceAll('이름 없음님의 명식은', '이 명식은')
      .replaceAll('이름 없음님의', '나의')
      .replaceAll('이름 없음님은', '이 명식의 주인은')
      .replaceAll('이름 없음', '이 명식');
  }
  function readingReport(value, record) {
    if (typeof value === 'string') return readingText(value, record);
    if (Array.isArray(value)) return value.map(item => readingReport(item, record));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, readingReport(item, record)]));
    return value;
  }
  const paths = {
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    sparkle:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    building:'<path d="M5 21V3h14v18M3 21h18M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1m-4 6v-3h2v3"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',
    share:'<path d="M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>'
  };
  function icon(key) {
    if (!Object.hasOwn(paths,key)) return '';
    return `<svg class="ui-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[key]}</svg>`;
  }
  function prependIcon(element, key) {
    if (!element) return element;
    element.insertAdjacentHTML('afterbegin', icon(key));
    return element;
  }
  return Object.freeze({nameOf,chartLabel,readingText,readingReport,icon,prependIcon});
});
