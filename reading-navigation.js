/* Presentation-only enhancement. Calculation, generated copy, and storage stay untouched. */
(function () {
  'use strict';
  if (window.SajuReadingNavigation) return;

  let current = null;
  let scheduled = false;
  const compact = text => String(text || '').replace(/\s+/g, ' ').trim();
  const firstSentence = text => compact(text).split(/(?<=[.!?。！？])\s+/u)[0] || '';
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const brief = (section, after, text) => {
    if (text) after.after(node('p', 'reading-brief', firstSentence(text)));
  };

  function discloseChapter(chapter) {
    const details = node('details', 'reading-detail reading-detail--deep');
    const summary = node('summary', 'reading-detail__summary');
    summary.append(node('span', 'reading-detail__title', compact(chapter.querySelector('h4')?.textContent) || '심층 풀이'));
    const lead = chapter.querySelector('.reading-chapter__lead, .reading-prose p');
    if (lead) summary.append(node('span', 'reading-detail__preview', firstSentence(lead.textContent)));
    const body = node('div', 'reading-detail__body');
    while (chapter.firstChild) body.append(chapter.firstChild);
    details.append(summary, body);
    chapter.append(details);
  }

  function discloseSupportingParagraphs(chapter) {
    const prose = chapter.querySelector('.reading-prose');
    const paragraphs = prose ? [...prose.children] : [];
    if (paragraphs.length < 2) return;
    const details = node('details', 'reading-detail reading-detail--supporting');
    const summary = node('summary', 'reading-detail__summary', '근거와 실행 기준 더 읽기');
    const body = node('div', 'reading-detail__body');
    // Keep each annual chapter's first full paragraph visible. The remaining
    // explanation is still the original DOM, available without a new request.
    paragraphs.slice(1).forEach(paragraph => body.append(paragraph));
    details.append(summary, body);
    prose.append(details);
  }

  function discloseMonth(month) {
    const details = node('details', 'reading-detail reading-detail--month');
    const summary = node('summary', 'reading-detail__summary');
    const heading = month.querySelector(':scope > div');
    const label = month.querySelector('.reading-month__label');
    details.open = Number(label?.textContent.replace(/\D/g, '')) === new Date().getMonth() + 1;
    if (heading) {
      while (heading.firstChild) summary.append(heading.firstChild);
      heading.remove();
    }
    const body = node('div', 'reading-detail__body reading-month__body');
    while (month.firstChild) body.append(month.firstChild);
    details.append(summary, body);
    month.append(details);
  }

  function setActive(target) {
    if (!current) return;
    const active = current.links.find(link => link.hash === `#${target.id}`);
    const changed = active && active.getAttribute('aria-current') !== 'location';
    current.links.forEach(link => {
      if (link.hash === `#${target.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (changed && !matchMedia('(min-width: 1024px)').matches) {
      const list = current.nav.querySelector('ol');
      const chip = active.getBoundingClientRect();
      const bounds = list.getBoundingClientRect();
      if (chip.left < bounds.left || chip.right > bounds.right) {
        list.scrollTo({ left: list.scrollLeft + chip.left - bounds.left - (bounds.width - chip.width) / 2, behavior: 'auto' });
      }
    }
  }

  function update() {
    scheduled = false;
    if (!current) return;
    const { article, nav, topButton, targets } = current;
    const visible = article.isConnected && !article.closest('[hidden]') && article.getClientRects().length;
    topButton.hidden = !visible || scrollY <= innerHeight;
    if (!visible) return;
    const mobile = !matchMedia('(min-width: 1024px)').matches;
    const offset = mobile ? nav.getBoundingClientRect().height + 16 : 16;
    article.style.setProperty('--reading-anchor-offset', `${offset}px`);
    const bar = document.getElementById('bottomBar') || document.querySelector('.bottom-bar');
    const barRect = bar?.getBoundingClientRect();
    const clearance = barRect?.height && getComputedStyle(bar).display !== 'none' ? barRect.height + 16 : 16;
    topButton.style.setProperty('--reading-bar-clearance', `${clearance}px`);
    // The observer handles section arrival; this deterministic tie-break keeps one
    // current item when a section is taller than the viewport or scrolling backwards.
    const line = offset + 32;
    const last = targets[targets.length - 1];
    const lastRect = last?.getBoundingClientRect();
    // A short final section cannot reach the top offset at the document end.
    const finalFullyVisible = lastRect && lastRect.top >= offset && lastRect.bottom <= innerHeight;
    const target = finalFullyVisible ? last : [...targets].reverse().find(section => section.getBoundingClientRect().top <= line) || targets[0];
    if (target) setActive(target);
  }

  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }

  function enhance(host) {
    const article = host.querySelector('.unified-reading');
    if (!article || article.dataset.readingEnhanced) { schedule(); return; }
    current?.observer?.disconnect();
    current?.resizeObserver?.disconnect();
    current?.topButton.remove();
    article.dataset.readingEnhanced = 'true';
    const layout = node('div', 'reading-layout');
    article.before(layout);
    const nav = node('nav', 'reading-navigation');
    nav.setAttribute('aria-label', '풀이 목차');
    const navTitle = node('span', 'reading-navigation__label', '풀이 목차');
    const list = node('ol', 'reading-navigation__list');
    nav.append(navTitle, list);
    layout.append(nav, article);

    const groups = [...article.querySelectorAll('.reading-year-group')];
    const targets = [];
    groups.forEach(group => {
      const heading = group.querySelector(':scope > h3');
      if (!heading) return;
      brief(group, heading, group.querySelector('.reading-prose p')?.textContent);
      // Work and finance are distinct generated annual chapters inside one group.
      const annual = [...group.querySelectorAll('.reading-chapter[data-reading-source="annual"]')];
      if (annual.length === 2 && annual.some(chapter => /재정/.test(chapter.querySelector('h4')?.textContent || ''))) targets.push(...annual);
      else targets.push(group);
    });
    const months = article.querySelector('[data-reading-section="months"]');
    const daeun = article.querySelector('[data-reading-section="daeun"]');
    if (months) {
      const thisMonth = [...months.querySelectorAll('.reading-month')].find(month => Number(month.querySelector('.reading-month__label')?.textContent.replace(/\D/g, '')) === new Date().getMonth() + 1);
      brief(months, months.querySelector('.reading-section__head'), (thisMonth || months).querySelector('.reading-month p, p')?.textContent);
      targets.push(months);
    }
    if (daeun) {
      brief(daeun, daeun.querySelector('.reading-section__head'), daeun.querySelector('.reading-prose p')?.textContent);
      targets.push(daeun);
    }

    article.querySelectorAll('.reading-chapter[data-reading-source="deep"]').forEach(discloseChapter);
    article.querySelectorAll('.reading-chapter[data-reading-source="annual"]').forEach(discloseSupportingParagraphs);
    article.querySelectorAll('.reading-month').forEach(discloseMonth);
    const links = targets.map((target, index) => {
      target.id = `reading-nav-section-${index + 1}`;
      target.tabIndex = -1;
      target.classList.add('reading-anchor');
      const heading = target.querySelector('h3, h4, h2');
      const title = target === months ? '12개월' : target === daeun ? '대운' : compact(heading?.textContent);
      const link = node('a', 'reading-navigation__link', title || `${index + 1}번째 풀이`);
      link.href = `#${target.id}`;
      link.addEventListener('click', event => {
        event.preventDefault();
        update();
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        setActive(target);
      });
      const item = node('li');
      item.append(link);
      list.append(item);
      return link;
    });
    const topButton = node('button', 'reading-back-top', '맨 위로');
    topButton.type = 'button';
    topButton.hidden = true;
    topButton.addEventListener('click', () => {
      const title = article.querySelector('h2');
      if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    document.body.append(topButton);
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(schedule,
      { rootMargin: '-12% 0px -65% 0px', threshold: [0, .01, .5, 1] }) : null;
    current = { article, nav, targets, links, topButton, observer };
    targets.forEach(target => observer?.observe(target));
    if ('ResizeObserver' in window) {
      current.resizeObserver = new ResizeObserver(schedule);
      current.resizeObserver.observe(nav);
      const bar = document.getElementById('bottomBar');
      if (bar) current.resizeObserver.observe(bar);
    }
    article.addEventListener('toggle', schedule, true);
    update();
  }

  function start() {
    const host = document.getElementById('fortuneContent');
    if (!host) return;
    enhance(host);
    new MutationObserver(() => enhance(host)).observe(host, { childList: true });
    // Tab changes use the existing hidden attribute and must hide the floating UI.
    const view = document.getElementById('view-fortune');
    if (view) new MutationObserver(schedule).observe(view, { attributes: true, attributeFilter: ['hidden', 'class'] });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
  }
  window.SajuReadingNavigation = Object.freeze({ refresh: schedule });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
