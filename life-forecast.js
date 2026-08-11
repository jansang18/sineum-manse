/*
 * 사주깡패 공개판 인생 총운 프레젠테이션 모듈
 *
 * 이 파일은 사전 계산된 점수, 전환점, 대운 단계와 판독문만 표시한다.
 * 명식, 대운, 세운, 점수, 전환 사건을 계산하거나 추론하지 않는다.
 */
(function (global) {
  'use strict';

  var METRICS = [
    { key: 'overall', label: '종합', noun: '종합 활용 여력' },
    { key: 'money', label: '돈', noun: '재물 운용 여력' },
    { key: 'love', label: '관계', noun: '관계 흐름' },
    { key: 'job', label: '직업', noun: '직업·사업 흐름' },
    { key: 'health', label: '생활', noun: '생활 리듬' },
    { key: 'move', label: '이동', noun: '변화·이동 흐름' }
  ];

  var WIDTH = 960;
  var HEIGHT = 350;
  var PAD = { left: 48, right: 24, top: 28, bottom: 42 };
  var renderSequence = 0;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function text(value, limit, fallback) {
    var result = String(value == null ? (fallback || '') : value)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return result.slice(0, limit);
  }

  function token(value, fallback) {
    var result = String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    return result || fallback;
  }

  function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  function integer(value, fallback) {
    return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function score(value) {
    var number = finiteNumber(value);
    return number === null ? null : Math.round(clamp(number, 0, 100));
  }

  function metricInfo(key) {
    return METRICS.find(function (metric) { return metric.key === key; }) || METRICS[0];
  }

  function normalizePoints(input) {
    if (!Array.isArray(input)) return [];
    var seenYears = new Set();
    return input.slice(0, 81).map(function (point) {
      if (!point || typeof point !== 'object') return null;
      var year = integer(point.year, null);
      var age = integer(point.age, null);
      if (year === null || age === null || seenYears.has(year)) return null;
      var source = point.scores && typeof point.scores === 'object' ? point.scores : point;
      var scores = {};
      var valid = METRICS.every(function (metric) {
        var value = score(source[metric.key]);
        if (value === null) return false;
        scores[metric.key] = value;
        return true;
      });
      if (!valid) return null;
      seenYears.add(year);
      return {
        year: year,
        age: age,
        scores: scores,
        harmony: finiteNumber(point.harmony),
        conflict: finiteNumber(point.conflict),
        daeunIndex: integer(point.daeunIndex, null),
        daeunChange: point.daeunChange === true
      };
    }).filter(Boolean).sort(function (left, right) {
      return left.year - right.year || left.age - right.age;
    });
  }

  function normalizeEvents(input, points) {
    if (!Array.isArray(input) || !points.length) return [];
    var pointByYear = new Map(points.map(function (point) { return [point.year, point]; }));
    return input.slice(0, 7).map(function (event, index) {
      if (!event || typeof event !== 'object') return null;
      var year = integer(event.year, null);
      var point = pointByYear.get(year);
      if (!point) return null;
      var verdictSource = event.verdict && typeof event.verdict === 'object' ? event.verdict : {};
      return {
        id: text(event.id, 64, 'life-event-' + (index + 1)),
        rank: integer(event.rank, index + 1),
        year: year,
        age: integer(event.age, point.age),
        kind: token(event.kind, 'flow-turn'),
        domain: token(event.domain, 'overall'),
        label: text(event.label, 48, '전환 가능성 점검'),
        description: text(event.description, 720, '흐름의 방향이 달라질 가능성을 점검할 구간입니다.'),
        score: score(event.score),
        delta: finiteNumber(event.delta) === null ? null : Math.round(clamp(event.delta, -100, 100)),
        confidence: event.confidence === 'structural' ? 'structural' : 'heuristic',
        verdict: text(verdictSource.label || event.verdict, 20, ''),
        tone: token(verdictSource.tone || event.tone, 'normal'),
        evidence: Array.isArray(event.evidence)
          ? event.evidence.slice(0, 6).map(function (item) { return text(item, 120, ''); }).filter(Boolean)
          : []
      };
    }).filter(Boolean).sort(function (left, right) {
      return left.year - right.year || left.rank - right.rank;
    });
  }

  function normalizePhaseScores(input) {
    if (!input || typeof input !== 'object') return null;
    var result = {};
    var count = 0;
    METRICS.forEach(function (metric) {
      var value = score(input[metric.key]);
      if (value !== null) {
        result[metric.key] = value;
        count += 1;
      }
    });
    return count ? result : null;
  }

  function normalizeDomain(input) {
    if (input && typeof input === 'object') {
      return {
        key: token(input.key, 'overall'),
        label: text(input.label || input.name, 32, ''),
        average: score(input.average)
      };
    }
    var label = text(input, 32, '');
    return label ? { key: 'overall', label: label, average: null } : null;
  }

  function normalizePhases(input) {
    if (!Array.isArray(input)) return [];
    return input.map(function (phase, index) {
      if (!phase || typeof phase !== 'object') return null;
      var verdictSource = phase.verdict && typeof phase.verdict === 'object' ? phase.verdict : {};
      var paragraphs = Array.isArray(phase.paragraphs)
        ? phase.paragraphs.slice(0, 12).map(function (item) { return text(item, 1200, ''); }).filter(Boolean)
        : [];
      var description = text(phase.description, 1200, '');
      if (!paragraphs.length && description) paragraphs.push(description);
      return {
        id: text(phase.id, 64, 'life-phase-' + (index + 1)),
        index: integer(phase.index, index),
        order: index + 1,
        startAge: integer(phase.startAge, null),
        endAge: integer(phase.endAge, null),
        startYear: integer(phase.startYear, null),
        endYear: integer(phase.endYear, null),
        ganji: text(phase.ganji, 24, ''),
        ganjiKor: text(phase.ganjiKor, 32, ''),
        stemGod: text(phase.stemGod, 32, ''),
        branchGod: text(phase.branchGod, 32, ''),
        label: text(phase.label || phase.category, 40, '대운 단계'),
        title: text(phase.title, 120, '흐름의 기준을 점검할 구간'),
        lead: text(phase.lead || phase.summary, 900, ''),
        paragraphs: paragraphs,
        evidence: Array.isArray(phase.evidence)
          ? phase.evidence.slice(0, 8).map(function (item) { return text(item, 160, ''); }).filter(Boolean)
          : [],
        verdict: text(verdictSource.label || phase.verdict, 24, '점검'),
        tone: token(verdictSource.tone || phase.tone, 'normal'),
        average: score(phase.average),
        peakAge: integer(phase.peakAge, null),
        lowAge: integer(phase.lowAge, null),
        strongestDomain: normalizeDomain(phase.strongestDomain),
        weakestDomain: normalizeDomain(phase.weakestDomain),
        scores: normalizePhaseScores(phase.scores)
      };
    }).filter(Boolean);
  }

  function normalizeSummary(input) {
    var summary = input && typeof input === 'object' ? input : {};
    var strongest = summary.strongestDomain && typeof summary.strongestDomain === 'object'
      ? summary.strongestDomain
      : null;
    return {
      verdict: text(summary.verdict, 24, '흐름 판독'),
      tone: token(summary.tone, 'normal'),
      title: text(summary.title, 140, '높낮이보다 방향이 바뀌는 지점을 봅니다.'),
      description: text(summary.description, 720, '전달된 연도별 상대 지수를 같은 기준으로 표시합니다.'),
      average: score(summary.average),
      min: score(summary.min),
      max: score(summary.max),
      peakAge: integer(summary.peakAge, null),
      volatility: finiteNumber(summary.volatility) === null ? null : Math.round(summary.volatility),
      trend: finiteNumber(summary.trend) === null ? null : Math.round(summary.trend),
      strongestDomain: strongest ? {
        label: text(strongest.label, 32, ''),
        average: score(strongest.average)
      } : null
    };
  }

  function nearestPoint(points, year) {
    return points.reduce(function (best, point) {
      return Math.abs(point.year - year) < Math.abs(best.year - year) ? point : best;
    }, points[0]);
  }

  function xFor(point, points) {
    if (points.length < 2) return WIDTH / 2;
    var first = points[0].year;
    var last = points[points.length - 1].year;
    var ratio = last === first ? 0.5 : (point.year - first) / (last - first);
    return PAD.left + ratio * (WIDTH - PAD.left - PAD.right);
  }

  function yFor(value) {
    return PAD.top + (1 - clamp(value, 0, 100) / 100) * (HEIGHT - PAD.top - PAD.bottom);
  }

  function pathFor(points, key, domainPoints) {
    var domain = Array.isArray(domainPoints) && domainPoints.length ? domainPoints : points;
    return points.map(function (point, index) {
      return (index ? 'L' : 'M') + xFor(point, domain).toFixed(2) + ' ' + yFor(point.scores[key]).toFixed(2);
    }).join(' ');
  }

  function splitPaths(points, key, currentYear) {
    var past = [];
    var future = [];
    points.forEach(function (point) {
      if (point.year <= currentYear) past.push(point);
      if (point.year >= currentYear) future.push(point);
    });
    if (!past.length) future = points.slice();
    if (!future.length) past = points.slice();
    return { past: pathFor(past, key, points), future: pathFor(future, key, points) };
  }

  function areaPath(points, key) {
    if (!points.length) return '';
    var base = HEIGHT - PAD.bottom;
    return pathFor(points, key) +
      ' L' + xFor(points[points.length - 1], points).toFixed(2) + ' ' + base +
      ' L' + xFor(points[0], points).toFixed(2) + ' ' + base + ' Z';
  }

  function gridSvg(points) {
    var horizontal = [25, 50, 75].map(function (value) {
      var y = yFor(value);
      return '<g class="life-course__grid-line"><line x1="' + PAD.left + '" y1="' + y + '" x2="' + (WIDTH - PAD.right) + '" y2="' + y + '"></line></g>';
    }).join('');
    var firstAge = points[0].age;
    var lastAge = points[points.length - 1].age;
    var ticks = [];
    for (var age = Math.ceil(firstAge / 10) * 10; age <= lastAge; age += 10) {
      var point = points.reduce(function (best, candidate) {
        return Math.abs(candidate.age - age) < Math.abs(best.age - age) ? candidate : best;
      }, points[0]);
      var x = xFor(point, points);
      ticks.push('<g class="life-course__age-tick"><line x1="' + x + '" y1="' + PAD.top + '" x2="' + x + '" y2="' + (HEIGHT - PAD.bottom) + '"></line></g>');
    }
    return horizontal + ticks.join('');
  }

  function axisOverlay(points) {
    var yLabels = [75, 50, 25].map(function (value) {
      var label = value === 75 ? '확장 가능' : value === 50 ? '운용' : '수비 필요';
      return '<span style="--axis-y:' + (yFor(value) / HEIGHT * 100).toFixed(3) + '%">' + label + '</span>';
    }).join('');
    var xLabels = [];
    var firstAge = points[0].age;
    var lastAge = points[points.length - 1].age;
    for (var age = Math.ceil(firstAge / 10) * 10; age <= lastAge; age += 10) {
      var point = nearestPoint(points, points[0].year + (age - firstAge));
      xLabels.push('<span style="--axis-x:' + (xFor(point, points) / WIDTH * 100).toFixed(3) + '%">' + point.age + '세</span>');
    }
    return '<div class="life-course__axis-overlay" aria-hidden="true"><div class="life-course__axis-y">' + yLabels + '</div><div class="life-course__axis-x">' + xLabels.join('') + '</div></div>';
  }

  function metricButtons() {
    return METRICS.map(function (metric, index) {
      return '<button type="button" data-life-metric="' + metric.key + '" aria-pressed="' + (index === 0 ? 'true' : 'false') + '" tabindex="' + (index === 0 ? '0' : '-1') + '">' + metric.label + '</button>';
    }).join('');
  }

  function scoreText(value) {
    return value === null ? '—' : value + '점';
  }

  function eventDetail(event) {
    if (!event) return '<p>전환점 판독 자료가 없습니다.</p>';
    var verdict = event.verdict
      ? '<span class="life-course__detail-verdict" data-tone="' + event.tone + '">' + escapeHtml(event.verdict) + '</span>'
      : '';
    var evidence = event.evidence.length
      ? '<ul class="life-course__evidence">' + event.evidence.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
      : '';
    var confidence = event.confidence === 'structural' ? '구조 신호' : '비교 신호';
    return '<span class="life-course__detail-index">TURN ' + String(event.rank).padStart(2, '0') + '</span>' + verdict +
      '<h3>' + escapeHtml(event.label) + '</h3>' +
      '<p class="life-course__detail-meta">' + event.age + '세 구간 · ' + event.year + '년 · ' + scoreText(event.score) + ' · ' + confidence + '</p>' +
      '<p>' + escapeHtml(event.description) + '</p>' + evidence;
  }

  function eventList(events, detailId) {
    if (!events.length) {
      return '<div class="life-course__events-empty" role="status"><strong>전환점 자료 대기</strong><p>전달된 전환 판독이 없습니다.</p></div>';
    }
    return '<ol class="life-course__events" aria-label="주요 전환 구간">' + events.map(function (event, index) {
      return '<li class="life-event' + (index === 0 ? ' is-selected' : '') + '" data-life-event data-rank="' + event.rank + '">' +
        '<button type="button" data-life-event-select="' + index + '" aria-controls="' + detailId + '" aria-pressed="' + (index === 0 ? 'true' : 'false') + '" tabindex="' + (index === 0 ? '0' : '-1') + '">' +
          '<span class="life-event__number">' + String(event.rank).padStart(2, '0') + '</span>' +
          '<span class="life-event__copy"><strong>' + escapeHtml(event.label) + '</strong><small>' + event.age + '세 구간 · ' + event.year + '년</small></span>' +
          '<span class="life-event__score" aria-label="상대 지수 ' + scoreText(event.score) + '">' + (event.score === null ? '—' : event.score) + '</span>' +
        '</button>' +
      '</li>';
    }).join('') + '</ol>';
  }

  function summaryStats(summary) {
    var stats = [];
    if (summary.min !== null) stats.push({ label: '최저 지수', value: summary.min + '점' });
    if (summary.max !== null) stats.push({ label: '최고 지수', value: summary.max + '점' });
    if (summary.peakAge !== null) stats.push({ label: '활용 정점', value: summary.peakAge + '세 구간' });
    if (summary.volatility !== null) stats.push({ label: '변동 지수', value: String(summary.volatility) });
    if (summary.trend !== null) stats.push({ label: '전체 추세', value: (summary.trend > 0 ? '+' : '') + summary.trend });
    if (summary.strongestDomain && summary.strongestDomain.label) {
      stats.push({
        label: '주요 영역',
        value: summary.strongestDomain.label + (summary.strongestDomain.average === null ? '' : ' ' + summary.strongestDomain.average + '점')
      });
    }
    if (!stats.length) return '';
    return '<dl class="life-course__summary-stats">' + stats.map(function (item) {
      return '<div><dt>' + escapeHtml(item.label) + '</dt><dd>' + escapeHtml(item.value) + '</dd></div>';
    }).join('') + '</dl>';
  }

  function pointTable(points) {
    return '<details class="life-course__table"><summary>전체 연령별 지수표 보기</summary><div tabindex="0" role="region" aria-label="연령별 상대 지수표"><table>' +
      '<thead><tr><th scope="col">나이</th><th scope="col">연도</th>' + METRICS.map(function (metric) {
        return '<th scope="col" data-life-table-metric="' + metric.key + '">' + metric.label + '</th>';
      }).join('') + '</tr></thead><tbody>' + points.map(function (point) {
        return '<tr><th scope="row">' + point.age + '세</th><td>' + point.year + '</td>' + METRICS.map(function (metric) {
          return '<td data-life-table-metric="' + metric.key + '">' + point.scores[metric.key] + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></details>';
  }

  function phaseRange(phase) {
    var parts = [];
    if (phase.startAge !== null || phase.endAge !== null) {
      parts.push((phase.startAge === null ? '?' : phase.startAge) + '–' + (phase.endAge === null ? '?' : phase.endAge) + '세 구간');
    }
    if (phase.startYear !== null || phase.endYear !== null) {
      parts.push((phase.startYear === null ? '?' : phase.startYear) + '–' + (phase.endYear === null ? '?' : phase.endYear) + '년');
    }
    return parts.length ? parts.join(' · ') : '기간 정보 미입력';
  }

  function phaseIsCurrent(phase, currentYear, currentAge) {
    if (phase.startYear !== null && phase.endYear !== null) {
      return currentYear >= phase.startYear && currentYear <= phase.endYear;
    }
    if (phase.startAge !== null && phase.endAge !== null) {
      return currentAge >= phase.startAge && currentAge <= phase.endAge;
    }
    return false;
  }

  function phaseScoreList(scores) {
    if (!scores) return '';
    var values = METRICS.filter(function (metric) { return scores[metric.key] !== undefined; });
    if (!values.length) return '';
    return '<dl class="life-phase__scores">' + values.map(function (metric) {
      return '<div><dt>' + metric.label + '</dt><dd>' + scores[metric.key] + '</dd></div>';
    }).join('') + '</dl>';
  }

  function phaseLedger(phases, currentYear, currentAge) {
    if (!phases.length) {
      return '<section class="life-phases life-phases--empty" data-life-phase-ledger aria-labelledby="lifePhaseHeading"><header><span>DAEUN LEDGER</span><h2 id="lifePhaseHeading">대운 단계 장부</h2></header><p role="status">전달된 대운 단계 판독이 없습니다.</p></section>';
    }
    return '<section class="life-phases" data-life-phase-ledger aria-labelledby="lifePhaseHeading"><header class="life-phases__header">' +
      '<span>DAEUN LEDGER / 전체 단계</span><h2 id="lifePhaseHeading">대운을 한 줄 요약으로 끝내지 않습니다.</h2>' +
      '<p>전달된 모든 대운 단계의 압력, 활용 조건, 점검 기준을 시간순으로 표시합니다.</p></header>' +
      '<ol class="life-phases__list">' + phases.map(function (phase) {
        var current = phaseIsCurrent(phase, currentYear, currentAge);
        var summaryMeta = escapeHtml(phaseRange(phase)) + (phase.ganji ? ' · ' + escapeHtml(phase.ganji) : '');
        var lead = phase.lead ? '<p class="life-phase__lead">' + escapeHtml(phase.lead) + '</p>' : '';
        var paragraphs = phase.paragraphs.length
          ? '<div class="life-phase__prose">' + phase.paragraphs.map(function (paragraph) { return '<p>' + escapeHtml(paragraph) + '</p>'; }).join('') + '</div>'
          : '<p class="life-phase__missing">이 단계의 장문 판독문은 아직 전달되지 않았습니다.</p>';
        var evidence = phase.evidence.length
          ? '<div class="life-phase__evidence"><h4>판독 근거</h4><ul>' + phase.evidence.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul></div>'
          : '';
        return '<li class="life-phase' + (current ? ' is-current' : '') + '" data-life-phase="' + phase.order + '"' + (current ? ' aria-current="step"' : '') + '>' +
          '<details class="life-phase__disclosure" data-life-phase-disclosure="' + phase.order + '"' + (current ? ' open' : '') + '>' +
          '<summary class="life-phase__summary"><span class="life-phase__summary-index"><span class="life-phase__number">DAEUN ' + String(phase.order).padStart(2, '0') + '</span>' +
          (current ? '<span class="life-phase__current">현재 단계</span>' : '') + '</span>' +
          '<span class="life-phase__summary-copy"><span class="life-phase__meta">' + summaryMeta + '</span>' +
          '<strong class="life-phase__summary-title">' + escapeHtml(phase.title) + '</strong></span>' +
          '<span class="life-phase__verdict" data-tone="' + phase.tone + '">' + escapeHtml(phase.verdict) + '</span>' +
          '<span class="life-phase__summary-action" aria-hidden="true"></span></summary>' +
          '<article class="life-phase__body"><div class="life-phase__body-label"><span>판독 구분</span><strong>' + escapeHtml(phase.label) + '</strong></div>' +
          '<div class="life-phase__body-content">' + lead + phaseScoreList(phase.scores) + paragraphs + evidence + '</div></article></details></li>';
      }).join('') + '</ol>' +
      '<p class="life-phases__note">대운 단계는 실제 사건을 확정하는 예언이 아니라, 선택의 압력과 점검 순서를 비교하는 참고 자료입니다.</p></section>';
  }

  function emptyState(phases, currentYear) {
    return '<section class="life-course life-course--empty" data-lifetime-graph aria-labelledby="lifeCourseEmptyTitle">' +
      '<h2 id="lifeCourseEmptyTitle">인생 총운 자료를 표시할 수 없습니다.</h2>' +
      '<p>연도·나이·영역별 점수가 사전에 계산되어 있는지 확인해주세요.</p>' +
      phaseLedger(phases, currentYear, 0) + '</section>';
  }

  function render(input) {
    input = input && typeof input === 'object' ? input : {};
    var points = normalizePoints(input.points);
    var phases = normalizePhases(input.phases);
    var requestedAge = integer(input.currentAge, null);
    var agePoint = requestedAge === null
      ? null
      : points.reduce(function (best, point) {
        return Math.abs(point.age - requestedAge) < Math.abs(best.age - requestedAge) ? point : best;
      }, points[0]);
    var currentYear = integer(input.currentYear, agePoint ? agePoint.year : (points.length ? points[0].year : 0));
    if (!points.length) return emptyState(phases, currentYear);

    var events = normalizeEvents(input.events, points);
    var summary = normalizeSummary(input.summary);
    var current = nearestPoint(points, currentYear);
    var paths = splitPaths(points, 'overall', currentYear);
    var first = points[0];
    var last = points[points.length - 1];
    var currentX = xFor(current, points);
    var instance = 'lifeCourse' + (++renderSequence);
    var titleId = instance + 'Title';
    var descriptionId = instance + 'Description';
    var curveTitleId = instance + 'CurveTitle';
    var curveDescriptionId = instance + 'CurveDescription';
    var detailId = instance + 'EventDetail';
    var gradientId = instance + 'AreaGradient';
    var timeNotice = input.timeKnown === false || input.unknownTime === true
      ? '<span class="life-course__accuracy">시주 제외 · 일부 전환 판독의 정밀도 제한</span>'
      : '';

    var eventPanel = '<aside class="life-course__ledger" aria-label="주요 전환점 장부">' +
      (events.length ? '<div class="life-course__detail" id="' + detailId + '" data-life-event-detail aria-live="polite">' + eventDetail(events[0]) + '</div>' : '') +
      eventList(events, detailId) + '</aside>';

    return '<figure class="life-course" data-lifetime-graph data-life-metric-active="overall" aria-labelledby="' + titleId + '" aria-describedby="' + descriptionId + '">' +
      '<header class="life-course__header"><div><span class="life-course__kicker">LIFE COURSE / 인생 총운 판독</span>' +
      '<h2 id="' + titleId + '">평생의 높낮이보다, <em>판이 바뀌는 순간</em>을 봅니다.</h2>' +
      '<p id="' + descriptionId + '">전달된 ' + first.age + '세부터 ' + last.age + '세까지의 상대 지수와 판독문을 표시합니다. 미래 구간은 가능성과 점검 기준으로 읽으십시오.</p>' + timeNotice + '</div>' +
      '<div class="life-course__verdict" data-tone="' + summary.tone + '"><span>' + escapeHtml(summary.verdict) + '</span><strong>' + (summary.average === null ? '—' : summary.average) + '</strong><small>평균 여력</small></div></header>' +
      '<div class="life-course__metric-bar" role="group" aria-label="그래프 판독 영역 선택">' + metricButtons() + '</div>' +
      '<div class="life-course__body"><div class="life-course__figure"><div class="life-course__plot" data-life-plot>' +
        '<svg class="life-course__svg" data-life-curve-svg viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" role="img" aria-labelledby="' + curveTitleId + ' ' + curveDescriptionId + '" preserveAspectRatio="none">' +
          '<title id="' + curveTitleId + '" data-life-curve-title>' + first.age + '세부터 ' + last.age + '세까지의 종합 활용 여력</title>' +
          '<desc id="' + curveDescriptionId + '" data-life-curve-description>아이보리 실선은 기준 연도까지, 회색 점선은 이후 가능성입니다. 선택한 영역의 상대 지수를 표시합니다.</desc>' +
          '<defs><linearGradient id="' + gradientId + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2ebdd" stop-opacity=".055"></stop><stop offset="1" stop-color="#f2ebdd" stop-opacity="0"></stop></linearGradient></defs>' +
          gridSvg(points) + '<path class="life-course__area" data-life-area style="fill:url(#' + gradientId + ')" d="' + areaPath(points, 'overall') + '"></path>' +
          '<path class="life-course__trace life-course__trace--past" data-life-past d="' + paths.past + '"></path>' +
          '<path class="life-course__trace life-course__trace--future" data-life-future d="' + paths.future + '"></path>' +
          '<g class="life-course__now" data-life-now transform="translate(' + currentX.toFixed(2) + ' 0)"><line y1="' + PAD.top + '" y2="' + (HEIGHT - PAD.bottom) + '"></line></g>' +
        '</svg>' + axisOverlay(points) + '</div>' +
        '<div class="life-course__current" data-life-current><span>기준 구간</span><strong>연도 기준 ' + current.age + '세 · ' + current.year + '년</strong><b>' + current.scores.overall + '점</b><small data-life-current-metric>종합 활용 여력</small></div>' +
        '<div class="life-course__summary"><strong>' + escapeHtml(summary.title) + '</strong><p>' + escapeHtml(summary.description) + '</p>' + summaryStats(summary) + '</div>' +
      '</div>' + eventPanel + '</div>' +
      pointTable(points) + phaseLedger(phases, currentYear, current.age) +
      '<figcaption class="life-course__note">이 화면은 사전 계산된 구조적 흐름의 상대값을 표시하며, 실제 사건이나 결과를 확정하지 않습니다.</figcaption></figure>';
  }

  function bind(root, input) {
    if (!root) return null;
    var scope = root.matches && root.matches('[data-lifetime-graph]')
      ? root
      : root.querySelector && root.querySelector('[data-lifetime-graph]');
    if (!scope || scope.dataset.lifeBound === 'true') return scope || null;

    input = input && typeof input === 'object' ? input : {};
    var points = normalizePoints(input.points);
    if (!points.length) return scope;
    var events = normalizeEvents(input.events, points);
    var requestedAge = integer(input.currentAge, null);
    var agePoint = requestedAge === null
      ? null
      : points.reduce(function (best, point) {
        return Math.abs(point.age - requestedAge) < Math.abs(best.age - requestedAge) ? point : best;
      }, points[0]);
    var currentYear = integer(input.currentYear, agePoint ? agePoint.year : points[0].year);
    var current = nearestPoint(points, currentYear);
    var activeMetric = 'overall';
    scope.dataset.lifeBound = 'true';

    function updateMetric(key) {
      activeMetric = metricInfo(key).key;
      scope.dataset.lifeMetricActive = activeMetric;
      var buttons = Array.from(scope.querySelectorAll('[data-life-metric]'));
      buttons.forEach(function (button) {
        var selected = button.dataset.lifeMetric === activeMetric;
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.tabIndex = selected ? 0 : -1;
      });
      var paths = splitPaths(points, activeMetric, currentYear);
      var past = scope.querySelector('[data-life-past]');
      var future = scope.querySelector('[data-life-future]');
      var area = scope.querySelector('[data-life-area]');
      if (past) past.setAttribute('d', paths.past);
      if (future) future.setAttribute('d', paths.future);
      if (area) area.setAttribute('d', areaPath(points, activeMetric));
      var now = scope.querySelector('[data-life-now]');
      if (now) now.setAttribute('transform', 'translate(' + xFor(current, points).toFixed(2) + ' 0)');
      var currentScore = scope.querySelector('[data-life-current] b');
      var currentLabel = scope.querySelector('[data-life-current-metric]');
      if (currentScore) currentScore.textContent = current.scores[activeMetric] + '점';
      if (currentLabel) currentLabel.textContent = metricInfo(activeMetric).noun;
      var curveTitle = scope.querySelector('[data-life-curve-title]');
      var curveDescription = scope.querySelector('[data-life-curve-description]');
      if (curveTitle) curveTitle.textContent = points[0].age + '세부터 ' + points[points.length - 1].age + '세까지의 ' + metricInfo(activeMetric).noun;
      if (curveDescription) curveDescription.textContent = '아이보리 실선은 기준 연도까지, 회색 점선은 이후 가능성입니다. 현재 ' + metricInfo(activeMetric).label + ' 영역을 표시합니다.';
    }

    function selectEvent(index, focusEvent) {
      var event = events[index];
      if (!event) return;
      scope.querySelectorAll('[data-life-event-select]').forEach(function (button) {
        var selected = Number(button.dataset.lifeEventSelect) === index;
        var row = button.closest('.life-event');
        if (row) row.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.tabIndex = selected ? 0 : -1;
      });
      var detail = scope.querySelector('[data-life-event-detail]');
      if (detail) detail.innerHTML = eventDetail(event);
      if (focusEvent) {
        var target = scope.querySelector('[data-life-event-select="' + index + '"]');
        if (target) target.focus();
      }
    }

    var metricButtonsList = Array.from(scope.querySelectorAll('[data-life-metric]'));
    metricButtonsList.forEach(function (button, buttonIndex) {
      button.addEventListener('click', function () { updateMetric(button.dataset.lifeMetric); });
      button.addEventListener('keydown', function (event) {
        var nextIndex = buttonIndex;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (buttonIndex + 1) % metricButtonsList.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (buttonIndex - 1 + metricButtonsList.length) % metricButtonsList.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = metricButtonsList.length - 1;
        else return;
        event.preventDefault();
        var target = metricButtonsList[nextIndex];
        updateMetric(target.dataset.lifeMetric);
        target.focus();
      });
    });

    var eventButtons = Array.from(scope.querySelectorAll('[data-life-event-select]'));
    eventButtons.forEach(function (button, buttonIndex) {
      button.addEventListener('click', function () { selectEvent(Number(button.dataset.lifeEventSelect), false); });
      button.addEventListener('keydown', function (event) {
        var nextIndex = buttonIndex;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = Math.min(eventButtons.length - 1, buttonIndex + 1);
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = Math.max(0, buttonIndex - 1);
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = eventButtons.length - 1;
        else return;
        event.preventDefault();
        selectEvent(nextIndex, true);
      });
    });
    return scope;
  }

  function mount(container, input) {
    if (!container) return null;
    container.innerHTML = render(input);
    return bind(container, input);
  }

  global.SajuGangpaeLife = Object.freeze({
    render: render,
    bind: bind,
    mount: mount,
    escapeHtml: escapeHtml
  });
})(typeof window !== 'undefined' ? window : globalThis);
