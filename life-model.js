/*
 * 사주깡패 공개판 인생 총운 모델
 * 기존 만세력 계산기가 만든 연도별 점수와 대운 구간만 조립한다.
 * 날짜·절기·명식·대운 계산은 이 파일에서 하지 않는다.
 */
(function (global) {
  'use strict';

  var DOMAINS = [
    {
      key: 'money',
      label: '재물',
      subject: '돈과 자원의 배분',
      use: '수익의 크기보다 남는 구조와 회수 조건을 먼저 세우는 것',
      guard: '판을 키우기 전에 현금 흐름·가격·책임 범위를 다시 적는 것'
    },
    {
      key: 'love',
      label: '관계',
      subject: '관계의 온도와 경계',
      use: '감정의 세기보다 합의 가능한 생활 조건을 확인하는 것',
      guard: '상대의 가능성보다 반복해서 확인된 행동을 기준으로 삼는 것'
    },
    {
      key: 'job',
      label: '직업',
      subject: '직업·역할·결정권',
      use: '직함보다 실제 권한과 결과가 남는 자리를 고르는 것',
      guard: '책임만 커지고 기준을 세울 수 없는 역할을 줄이는 것'
    },
    {
      key: 'move',
      label: '이동',
      subject: '환경과 활동 반경',
      use: '움직임을 도피가 아니라 다음 구조를 만드는 선택으로 쓰는 것',
      guard: '계약·거처·이직 조건을 감정이 가라앉은 뒤 다시 확인하는 것'
    },
    {
      key: 'health',
      label: '생활 리듬',
      subject: '회복과 생활 리듬',
      use: '잘 버티는 날이 아니라 평범한 날에도 반복할 수 있는 하한선을 만드는 것',
      guard: '명리 해석보다 실제 수면·식사·검진과 전문가 조언을 우선하는 것'
    }
  ];

  var TEN_GOD_NOTE = {
    '비견': '자기 기준과 독립성이 앞에 서는 기운입니다. 남의 속도보다 자기 리듬을 지킬 때 힘이 납니다.',
    '겁재': '경쟁·분배·관계의 힘겨루기가 커질 수 있는 기운입니다. 사람보다 역할과 몫을 먼저 정해야 합니다.',
    '식신': '기술·생산·생활의 결과물을 오래 쌓는 기운입니다. 조급한 승부보다 반복 가능한 방식이 자산이 됩니다.',
    '상관': '표현·개선·규칙 재설계가 강해지는 기운입니다. 답답한 판을 바꿀 힘은 있지만 말과 속도의 마찰을 관리해야 합니다.',
    '편재': '기회·시장·넓은 활동 반경을 다루는 기운입니다. 판은 커질 수 있으나 회수 기준이 없으면 분주함만 남습니다.',
    '정재': '현금 흐름·책임·생활 기반을 구체화하는 기운입니다. 안정은 저절로 오지 않고 관리 규칙을 통해 만들어집니다.',
    '편관': '압박·결단·난도가 함께 올라오는 기운입니다. 버티는 힘보다 위험을 나누고 기준을 세우는 기술이 중요합니다.',
    '정관': '직책·평가·제도와의 연결이 커지는 기운입니다. 책임에 맞는 권한이 있는지 먼저 확인해야 오래 갑니다.',
    '편인': '관찰·전환·비정형 학습이 강해지는 기운입니다. 생각이 많아질수록 작은 실험으로 현실 검증을 해야 합니다.',
    '정인': '학습·보호·문서·자격의 기반이 커지는 기운입니다. 준비가 충분해질 때까지 미루지 말고 결과물로 바꾸는 과정이 필요합니다.'
  };

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function integer(value, fallback) {
    var parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, number(value, min)));
  }

  function mean(values) {
    if (!values.length) return 0;
    return Math.round(values.reduce(function (sum, value) { return sum + value; }, 0) / values.length);
  }

  function signed(value) {
    var rounded = Math.round(number(value, 0));
    return rounded > 0 ? '+' + rounded : String(rounded);
  }

  function scoreTone(score, volatility) {
    if (volatility >= 11 && score >= 60) return { verdict: '과열 점검', tone: 'hot' };
    if (score >= 70) return { verdict: '확장', tone: 'strong' };
    if (score >= 58) return { verdict: '운용', tone: 'normal' };
    if (score >= 46) return { verdict: '재정비', tone: 'recheck' };
    return { verdict: '수비', tone: 'watch' };
  }

  function normalizePoint(point) {
    if (!point || typeof point !== 'object') return null;
    var age = integer(point.age, -1);
    var year = integer(point.year, 0);
    if (age < 0 || age > 120 || year < 1026 || year > 2099) return null;
    var source = point.scores && typeof point.scores === 'object' ? point.scores : {};
    var scores = { overall: Math.round(clamp(source.overall, 0, 100)) };
    DOMAINS.forEach(function (domain) {
      scores[domain.key] = Math.round(clamp(source[domain.key], 0, 100));
    });
    return {
      age: age,
      year: year,
      scores: scores,
      harmony: Math.round(clamp(point.harmony, 0, 64) * 10) / 10,
      conflict: Math.round(clamp(point.conflict, 0, 64) * 10) / 10,
      daeunIndex: Math.max(0, integer(point.daeunIndex, 0)),
      daeunChange: Boolean(point.daeunChange),
      seunGanji: String(point.seunGanji || '').slice(0, 8),
      seunGanjiKor: String(point.seunGanjiKor || '').slice(0, 16),
      seunStemGod: String(point.seunStemGod || '').slice(0, 12),
      seunBranchGod: String(point.seunBranchGod || '').slice(0, 12)
    };
  }

  function normalizePoints(points) {
    var seen = new Set();
    return (Array.isArray(points) ? points : []).slice(0, 81).map(normalizePoint).filter(function (point) {
      if (!point || seen.has(point.year)) return false;
      seen.add(point.year);
      return true;
    }).sort(function (left, right) { return left.year - right.year; });
  }

  function domainAverages(points) {
    return DOMAINS.map(function (domain) {
      return {
        key: domain.key,
        label: domain.label,
        average: mean(points.map(function (point) { return point.scores[domain.key]; }))
      };
    });
  }

  function strongestAndWeakest(averages) {
    var strongest = averages[0];
    var weakest = averages[0];
    averages.forEach(function (item) {
      if (item.average > strongest.average) strongest = item;
      if (item.average < weakest.average) weakest = item;
    });
    return { strongest: strongest, weakest: weakest };
  }

  function phaseVolatility(points) {
    var changes = [];
    for (var index = 1; index < points.length; index += 1) {
      changes.push(Math.abs(points[index].scores.overall - points[index - 1].scores.overall));
    }
    return mean(changes);
  }

  function peakAndLow(points) {
    var peak = points[0];
    var low = points[0];
    points.forEach(function (point) {
      if (point.scores.overall > peak.scores.overall) peak = point;
      if (point.scores.overall < low.scores.overall) low = point;
    });
    return { peak: peak, low: low };
  }

  function domainInfo(key) {
    return DOMAINS.find(function (domain) { return domain.key === key; }) || DOMAINS[0];
  }

  function strongestPhaseChange(current, previous) {
    var best = DOMAINS[0];
    var delta = current.averages[best.key] - previous.averages[best.key];
    DOMAINS.slice(1).forEach(function (domain) {
      var candidate = current.averages[domain.key] - previous.averages[domain.key];
      if (Math.abs(candidate) > Math.abs(delta)) {
        best = domain;
        delta = candidate;
      }
    });
    return { domain: best, delta: delta };
  }

  function phaseTitle(meta, strongest, weakest, phaseIndex) {
    if (meta.isInitial || phaseIndex === 0) {
      return '태생 구간, 운보다 기본 리듬이 먼저 만들어집니다';
    }
    if (strongest.key === weakest.key) {
      return meta.ganji + ' 대운, 한쪽으로 기울기보다 운용 기준이 중요합니다';
    }
    return strongest.label + '의 판이 열릴수록 ' + weakest.label + '의 관리가 중요해지는 ' + meta.ganji + ' 대운';
  }

  function phaseParagraphs(meta, data, previous) {
    var strongest = domainInfo(data.strongestDomain.key);
    var weakest = domainInfo(data.weakestDomain.key);
    var stemNote = TEN_GOD_NOTE[meta.stemGod] || '대운 천간은 겉으로 드러나는 역할과 선택 기준을 바꾸는 신호로 읽습니다.';
    var branchNote = TEN_GOD_NOTE[meta.branchGod] || '대운 지지는 실제 생활 환경과 반복되는 반응의 바닥을 바꾸는 신호로 읽습니다.';
    var first = meta.isInitial
      ? '이 구간은 첫 실제 대운이 시작되기 전의 태생 구간입니다. 월주의 기운을 바탕으로 가족·환경·초기 습관의 영향을 크게 받는 시기로 읽으며, 성인이 된 뒤의 선택을 그대로 투사해 해석하지 않습니다.'
      : meta.ganji + ' 대운의 천간은 ' + meta.stemGod + ', 지지는 ' + meta.branchGod + '으로 작동합니다. ' + stemNote + ' 동시에 ' + branchNote;
    var second = '이 구간의 평균 활용 여력은 ' + data.average + '점입니다. ' + data.peakAge + '세 구간에서 ' + data.max + '점으로 가장 높고, ' + data.lowAge + '세 구간에서 ' + data.min + '점으로 조정 폭이 커집니다. 최고점은 성공을 보장하는 숫자가 아니고, 낮은 점수도 실패를 뜻하지 않습니다. 힘을 어디에 쓸지와 무엇을 덜어낼지를 비교하는 기준입니다.';
    var previousText = previous
      ? '이전 대운보다 종합 평균은 ' + signed(data.average - previous.average) + '점, ' + strongest.label + ' 평균은 ' + signed(data.averages[strongest.key] - previous.averages[strongest.key]) + '점 움직입니다. '
      : '';
    var third = previousText + strongest.subject + '의 활용 여지가 상대적으로 크므로 ' + strongest.use + '이 중요합니다. 반대로 ' + weakest.subject + '은 점수의 높고 낮음보다 관리 기준이 필요합니다. 이 대운에서 가장 현실적인 수비는 ' + weakest.guard + '입니다.';
    return [first, second, third];
  }

  function buildPhases(rawPhases, points, currentAge) {
    var metas = (Array.isArray(rawPhases) ? rawPhases : []).slice(0, 12).map(function (phase, index) {
      return {
        index: Math.max(0, integer(phase.index, index)),
        startAge: Math.max(0, integer(phase.startAge, 0)),
        endAge: Math.max(0, integer(phase.endAge, 0)),
        stem: integer(phase.stem, -1),
        branch: integer(phase.branch, -1),
        isInitial: Boolean(phase.isInitial),
        ganji: String(phase.ganji || '대운').slice(0, 8),
        ganjiKor: String(phase.ganjiKor || '').slice(0, 16),
        stemGod: String(phase.stemGod || '천간').slice(0, 12),
        branchGod: String(phase.branchGod || '지지').slice(0, 12)
      };
    }).sort(function (left, right) { return left.startAge - right.startAge; });

    var built = [];
    metas.forEach(function (meta) {
      var phasePoints = points.filter(function (point) { return point.daeunIndex === meta.index; });
      if (!phasePoints.length) return;
      var overallScores = phasePoints.map(function (point) { return point.scores.overall; });
      var averagesList = domainAverages(phasePoints);
      var pair = strongestAndWeakest(averagesList);
      var averageMap = {};
      averagesList.forEach(function (item) { averageMap[item.key] = item.average; });
      var extrema = peakAndLow(phasePoints);
      var average = mean(overallScores);
      var volatility = phaseVolatility(phasePoints);
      var tone = scoreTone(average, volatility);
      var previous = built.length ? built[built.length - 1] : null;
      var data = {
        index: meta.index,
        startAge: phasePoints[0].age,
        endAge: phasePoints[phasePoints.length - 1].age,
        startYear: phasePoints[0].year,
        endYear: phasePoints[phasePoints.length - 1].year,
        stem: meta.stem,
        branch: meta.branch,
        isInitial: meta.isInitial,
        ganji: meta.ganji,
        ganjiKor: meta.ganjiKor,
        stemGod: meta.stemGod,
        branchGod: meta.branchGod,
        verdict: tone.verdict,
        tone: tone.tone,
        average: average,
        min: extrema.low.scores.overall,
        max: extrema.peak.scores.overall,
        peakAge: extrema.peak.age,
        lowAge: extrema.low.age,
        volatility: volatility,
        harmony: mean(phasePoints.map(function (point) { return point.harmony; })),
        conflict: mean(phasePoints.map(function (point) { return point.conflict; })),
        averages: averageMap,
        scores: Object.assign({ overall: average }, averageMap),
        label: meta.isInitial ? '태생 기반' : meta.stemGod + '·' + meta.branchGod,
        strongestDomain: pair.strongest,
        weakestDomain: pair.weakest,
        current: currentAge >= phasePoints[0].age && currentAge <= phasePoints[phasePoints.length - 1].age
      };
      data.title = phaseTitle(meta, pair.strongest, pair.weakest, built.length);
      data.lead = data.startAge + '세부터 ' + data.endAge + '세까지, ' + pair.strongest.label + '은 활용하고 ' + pair.weakest.label + '은 관리해야 하는 구간으로 읽힙니다.';
      data.paragraphs = phaseParagraphs(meta, data, previous);
      data.evidence = [
        meta.ganji + ' 대운',
        meta.stemGod + '·' + meta.branchGod,
        '구간 평균 ' + average + '점',
        '고점 ' + data.peakAge + '세 ' + data.max + '점',
        '저점 ' + data.lowAge + '세 ' + data.min + '점'
      ];
      built.push(data);
    });
    return built;
  }

  function eventDescription(phase, previous, changed) {
    var direction = changed.delta >= 7
      ? changed.domain.label + '의 활용 여지가 이전보다 커질 가능성이 있습니다.'
      : changed.delta <= -7
        ? changed.domain.label + '에서 조정과 재배분 압력이 이전보다 커질 가능성이 있습니다.'
        : changed.domain.label + '을 다루는 기준이 이전과 달라질 가능성이 있습니다.';
    return phase.ganji + ' 대운이 시작되는 구조적 전환 구간입니다. ' + direction + ' 바로 확장하거나 철수하기보다 이전 대운에서 통하던 방식이 지금도 유효한지 먼저 점검하십시오. 실제 사건은 선택과 환경에 따라 달라집니다.';
  }

  function buildEvents(phases) {
    var candidates = [];
    for (var index = 1; index < phases.length; index += 1) {
      var phase = phases[index];
      var previous = phases[index - 1];
      if (phase.startAge <= 0 || phase.startAge > 80) continue;
      var changed = strongestPhaseChange(phase, previous);
      var overallDelta = phase.average - previous.average;
      var label = changed.domain.label + ' 기준 전환';
      var kind = 'daeun-change';
      if (changed.delta >= 7) {
        label = changed.domain.label + ' 확장 전환';
        kind = 'phase-rise';
      } else if (changed.delta <= -7) {
        label = changed.domain.label + ' 재정비 전환';
        kind = 'phase-pressure';
      }
      candidates.push({
        id: 'daeun-' + phase.index + '-' + phase.startYear,
        year: phase.startYear,
        age: phase.startAge,
        phaseIndex: phase.index,
        kind: kind,
        domain: changed.domain.key,
        label: label,
        description: eventDescription(phase, previous, changed),
        score: phase.average,
        delta: overallDelta,
        confidence: 'structural',
        verdict: scoreTone(phase.average, phase.volatility).verdict,
        tone: scoreTone(phase.average, phase.volatility).tone,
        evidence: [
          phase.ganji + ' 대운 시작',
          phase.stemGod + '·' + phase.branchGod,
          '이전 대운 대비 종합 ' + signed(overallDelta) + '점',
          changed.domain.label + ' 평균 ' + signed(changed.delta) + '점'
        ],
        _impact: Math.abs(overallDelta) * 3 + Math.abs(changed.delta) * 4 + phase.volatility
      });
    }
    candidates.sort(function (left, right) {
      return right._impact - left._impact || left.year - right.year;
    });
    var selected = candidates.slice(0, 7).sort(function (left, right) { return left.year - right.year; });
    return selected.map(function (event, index) {
      delete event._impact;
      event.rank = index + 1;
      return event;
    });
  }

  function buildSummary(points) {
    var overall = points.map(function (point) { return point.scores.overall; });
    var averages = domainAverages(points);
    var pair = strongestAndWeakest(averages);
    var extrema = peakAndLow(points);
    var average = mean(overall);
    var volatility = phaseVolatility(points);
    var trend = points[points.length - 1].scores.overall - points[0].scores.overall;
    var tone = scoreTone(average, volatility);
    var title = '운의 높낮이보다, 대운이 바뀔 때 삶의 기준이 어떻게 달라지는지 봐야 합니다.';
    if (volatility >= 11) title = '오르내림이 큰 구조입니다. 기회보다 회복 기준을 먼저 세워야 합니다.';
    else if (trend >= 10) title = '뒤 구간으로 갈수록 활용 여지가 커집니다. 확장과 감당력을 함께 보십시오.';
    else if (trend <= -10) title = '뒤 구간으로 갈수록 확장보다 정리와 배분의 정확도가 중요해집니다.';
    return {
      verdict: tone.verdict,
      tone: tone.tone,
      title: title,
      description: points[0].year + '년부터 ' + points[points.length - 1].year + '년까지의 평균 활용 여력은 ' + average + '점입니다. ' + pair.strongest.label + ' 흐름이 상대적으로 크게 잡히고, ' + pair.weakest.label + '은 의식적인 관리가 필요합니다. 가장 높은 구간과 낮은 구간도 실제 사건을 확정하는 예언이 아니라 대응 순서를 비교하는 지표입니다.',
      average: average,
      min: extrema.low.scores.overall,
      max: extrema.peak.scores.overall,
      peakAge: extrema.peak.age,
      lowAge: extrema.low.age,
      volatility: volatility,
      trend: trend,
      strongestDomain: pair.strongest,
      weakestDomain: pair.weakest
    };
  }

  function emptyModel(methodVersion, unknownTime) {
    return {
      methodVersion: methodVersion,
      currentAge: 0,
      currentYear: 0,
      unknownTime: unknownTime,
      timeKnown: !unknownTime,
      points: [],
      phases: [],
      events: [],
      summary: null,
      disclaimer: '연도별 자료가 없어 인생 총운을 펼칠 수 없습니다.'
    };
  }

  function build(input) {
    input = input && typeof input === 'object' ? input : {};
    var methodVersion = String(input.methodVersion || 'fortune-v1-public').slice(0, 40);
    var points = normalizePoints(input.points);
    var unknownTime = Boolean(input.unknownTime);
    if (!points.length) return emptyModel(methodVersion, unknownTime);
    var currentAge = Math.round(clamp(input.currentAge, points[0].age, points[points.length - 1].age));
    var currentPoint = points.reduce(function (best, point) {
      return Math.abs(point.age - currentAge) < Math.abs(best.age - currentAge) ? point : best;
    }, points[0]);
    var phases = buildPhases(input.phases, points, currentAge);
    return {
      methodVersion: methodVersion,
      currentAge: currentAge,
      currentYear: currentPoint.year,
      unknownTime: unknownTime,
      timeKnown: !unknownTime,
      points: points,
      phases: phases,
      events: buildEvents(phases),
      summary: buildSummary(points),
      disclaimer: '대운·세운 점수와 전환 표시는 구조적 흐름의 상대값입니다. 실제 사건이나 결과를 확정하지 않으며, 미래 구간은 가능성과 대응 순서로 읽습니다.'
    };
  }

  global.SajuGangpaeLifeModel = Object.freeze({ build: build });
})(typeof window !== 'undefined' ? window : globalThis);
