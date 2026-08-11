/* 사주깡패 장문 판독 엔진
 * 계산값을 바꾸지 않고, 이미 계산된 원국/십신/오행/합충/대운/세운을 서사형 문장으로 번역한다.
 */
(function (global) {
  'use strict';

  var ELEMENTS = [
    {
      name: '목', image: '아직 이름 붙지 않은 길이 바깥으로 뻗어 나가고',
      gift: '성장 방향을 만들고 시작점을 세우는 힘',
      excess: '끝을 보기 전에 다음 가능성을 향해 가지를 뻗는 조급함',
      lack: '시작의 명분과 장기 방향을 스스로 세우는 일',
      practice: '하고 싶은 일을 한 문장으로 정하고, 작은 시작을 일정에 고정하는 것'
    },
    {
      name: '화', image: '어둠 속에서 무엇을 드러낼지 결정하는 빛이 강하게 켜지고',
      gift: '표현·속도·가시성을 만들어 사람과 기회를 모으는 힘',
      excess: '열이 오른 순간 판을 키우고 식은 뒤 수습을 남기는 기복',
      lack: '마음을 밖으로 표현하고 결과를 세상에 보이는 일',
      practice: '완성될 때까지 숨기기보다 중간 결과를 짧게라도 공개하는 것'
    },
    {
      name: '토', image: '사람과 사건이 머무를 자리를 만들려는 무게가 깔리고',
      gift: '복잡한 것을 받아내고 현실의 구조로 굳히는 힘',
      excess: '이미 책임진 것을 놓지 못해 몸집과 부담을 함께 키우는 습관',
      lack: '경계를 정하고 일상을 안정된 구조로 붙잡는 일',
      practice: '돈·시간·약속을 기록하고, 감당할 몫과 남의 몫을 분리하는 것'
    },
    {
      name: '금', image: '불필요한 것을 잘라 본질만 남기려는 날이 서 있고',
      gift: '판단·정리·기준을 세워 완성도를 끌어올리는 힘',
      excess: '조금 모자란 것을 실패로 간주하며 자신과 타인을 몰아붙이는 엄격함',
      lack: '거절하고 끝내고 결론을 내리는 일',
      practice: '선택 기준을 미리 적고, 기준 밖의 제안에는 짧게 아니라고 말하는 것'
    },
    {
      name: '수', image: '보이지 않는 흐름과 다음 수를 읽는 감각이 깊게 움직이고',
      gift: '정보·감정·상황의 맥락을 읽으며 유연하게 길을 바꾸는 힘',
      excess: '가능한 경우의 수를 너무 오래 헤아려 결정을 늦추는 습관',
      lack: '멈춰 관찰하고 정보와 감정을 충분히 저장하는 일',
      practice: '대답하기 전 한 번 쉬고, 판단의 근거를 모은 뒤 움직이는 것'
    }
  ];

  var DAY_MASTERS = [
    { hanja: '甲', name: '갑목', image: '큰 나무', surface: '한번 방향을 세우면 쉽게 굽히지 않는 추진력', inside: '명분과 성장의 이유가 있어야 오래 움직이는 본성', shadow: '옳다고 믿는 방향을 타인도 따라야 한다고 생각하는 완고함', growth: '방향은 단단히 잡되 방법은 여러 개 남겨두는 것' },
    { hanja: '乙', name: '을목', image: '덩굴과 풀', surface: '환경을 읽고 틈을 찾아 살아남는 섬세한 적응력', inside: '관계와 조건을 엮어 결국 원하는 곳까지 도달하는 끈기', shadow: '직접 거절하지 못한 채 마음속 계산과 피로를 쌓는 습관', growth: '부드러움과 모호함을 구분하고 원하는 것을 정확히 말하는 것' },
    { hanja: '丙', name: '병화', image: '태양', surface: '분위기와 사람을 한꺼번에 움직이는 크고 빠른 에너지', inside: '자신의 존재와 진심이 분명하게 받아들여지길 바라는 마음', shadow: '반응이 약하면 더 세게 빛나려다 에너지를 과소비하는 경향', growth: '박수 없는 시간에도 같은 온도로 일을 지속하는 것' },
    { hanja: '丁', name: '정화', image: '등불', surface: '한 사람과 한 문제를 오래 비추는 집중력과 감응력', inside: '거친 현실 속에서도 의미와 온도를 지키려는 내밀한 의지', shadow: '사소한 말과 표정을 오래 태우며 혼자 결론을 만드는 예민함', growth: '느낀 것과 확인된 사실을 분리해 말하는 것' },
    { hanja: '戊', name: '무토', image: '산과 성벽', surface: '쉽게 흔들리지 않고 주변의 무게까지 받쳐내는 안정감', inside: '자신이 버텨야 판이 무너지지 않는다는 강한 책임감', shadow: '변화를 늦게 받아들여 이미 무거워진 뒤에야 움직이는 경향', growth: '버티는 힘을 증명하기 전에 무엇을 내려놓을지 정하는 것' },
    { hanja: '己', name: '기토', image: '밭과 정원', surface: '사람과 자원을 세심하게 돌보며 결과로 길러내는 현실감', inside: '쓸모 있는 사람이 되어 관계와 자리를 지키고 싶은 마음', shadow: '남의 문제까지 자기 일처럼 품어 정작 본체가 마르는 습관', growth: '돌봄에도 예산과 기한을 두고 자신을 먼저 관리하는 것' },
    { hanja: '庚', name: '경금', image: '원석과 칼', surface: '문제가 보이면 바로 쪼개고 결론을 내리는 직선적인 힘', inside: '어중간한 상태보다 부딪쳐서라도 진실을 확인하려는 의지', shadow: '정리의 속도가 사람의 감정이 따라오는 속도보다 빠른 점', growth: '결론을 내리기 전 상대가 받아들일 시간을 남겨두는 것' },
    { hanja: '辛', name: '신금', image: '보석과 정밀한 날', surface: '미세한 차이를 알아보고 완성도를 높이는 정교한 기준', inside: '함부로 소비되지 않는 가치와 품위를 지키고 싶은 마음', shadow: '흠이 보이면 전체 가치를 낮게 평가하는 냉정한 자기검열', growth: '완벽보다 일관성을 선택하고, 잘된 부분을 먼저 인정하는 것' },
    { hanja: '壬', name: '임수', image: '바다와 큰 강', surface: '큰 판과 먼 흐름을 읽으며 경계를 넘나드는 확장성', inside: '막히지 않고 계속 이동하며 선택지를 확보하려는 본능', shadow: '가능성이 많을수록 한곳에 정박하지 못하는 산만함', growth: '자유를 잃지 않으면서도 한 항로를 끝까지 완주하는 것' },
    { hanja: '癸', name: '계수', image: '비와 안개', surface: '말하지 않은 기류까지 읽어내는 조용하고 세밀한 감각', inside: '충분히 이해한 뒤 안전한 방식으로 스며들려는 신중함', shadow: '불확실한 장면을 머릿속에서 반복해 불안을 키우는 습관', growth: '생각이 깊어질수록 작고 구체적인 행동 하나를 먼저 하는 것' }
  ];

  var TEN_GODS = [
    { name: '비견', drive: '자기 기준과 독립성', gift: '쉽게 휘둘리지 않고 자신의 몫을 끝까지 해내는 힘', trap: '도움을 받아도 결국 혼자 해야 마음이 놓이는 고립' },
    { name: '겁재', drive: '경쟁·속도·판의 주도권', gift: '위기에서 밀리지 않고 사람과 자원을 빠르게 움직이는 힘', trap: '비교와 승부가 필요 이상으로 커져 돈과 감정을 함께 소모하는 것' },
    { name: '식신', drive: '생산·돌봄·꾸준한 결과', gift: '생활의 리듬을 만들고 재능을 실제 산출물로 바꾸는 힘', trap: '익숙한 편안함에 머물러 결정적 승부를 늦추는 것' },
    { name: '상관', drive: '표현·문제제기·차별화', gift: '남들이 당연하게 넘긴 오류를 발견하고 새 방식을 만드는 힘', trap: '맞는 말을 가장 날카로운 순간에 꺼내 관계 비용을 키우는 것' },
    { name: '편재', drive: '기회·유통·큰돈의 흐름', gift: '사람과 판을 넓게 보며 기회를 거래와 성과로 연결하는 힘', trap: '가능성을 실력으로 착각해 감당 범위보다 판을 먼저 키우는 것' },
    { name: '정재', drive: '관리·축적·예측 가능한 성과', gift: '돈과 시간을 계산해 반복 가능한 결과를 만드는 힘', trap: '손실을 피하려다 삶까지 지나치게 계산적으로 운영하는 것' },
    { name: '편관', drive: '압박·승부·위기 돌파', gift: '책임이 무거울수록 집중해 어려운 국면을 통과하는 힘', trap: '평온한 때에도 스스로 긴장과 적을 만들어야 움직이는 습관' },
    { name: '정관', drive: '질서·책임·사회적 자리', gift: '기준을 지키며 신뢰와 권한을 천천히 쌓는 힘', trap: '평가와 체면을 의식해 진짜 욕구를 뒤로 미루는 것' },
    { name: '편인', drive: '직감·분석·비정형 지식', gift: '낯선 정보를 자기 방식으로 해석해 독특한 관점을 만드는 힘', trap: '충분히 이해될 때까지 시작을 미루거나 현실과 거리를 두는 것' },
    { name: '정인', drive: '학습·보호·정당한 근거', gift: '배운 것을 체계로 만들고 긴 호흡으로 신뢰를 축적하는 힘', trap: '준비가 더 필요하다는 이유로 실전 투입을 늦추는 것' }
  ];

  function n(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clampIndex(value, length) {
    var index = Math.trunc(n(value, 0));
    return Math.max(0, Math.min(length - 1, index));
  }

  function maxIndex(values) {
    var best = 0;
    for (var i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
    return best;
  }

  function minIndex(values) {
    var best = 0;
    for (var i = 1; i < values.length; i++) if (values[i] < values[best]) best = i;
    return best;
  }

  function countWhere(values, indexes) {
    return values.reduce(function (total, value) {
      return total + (indexes.indexOf(value) >= 0 ? 1 : 0);
    }, 0);
  }

  function hasBatchim(word) {
    var text = String(word || '');
    var code = text.charCodeAt(text.length - 1);
    return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
  }

  function subject(word) {
    return String(word) + (hasBatchim(word) ? '이' : '가');
  }

  function withAnd(word) {
    return String(word) + (hasBatchim(word) ? '과' : '와');
  }

  function topic(word) {
    return String(word) + (hasBatchim(word) ? '은' : '는');
  }

  function scoreVerdict(area, score) {
    if ((area === 'money' || area === 'love') && score >= 78) return { label: '과열', tone: 'hot' };
    if ((area === 'job' || area === 'move') && score >= 72) return { label: '적합', tone: 'fit' };
    if (score >= 68) return { label: '강점', tone: 'strong' };
    if (score >= 52) return { label: '정상', tone: 'normal' };
    if (score >= 38) return { label: '주의', tone: 'watch' };
    return { label: '재검', tone: 'recheck' };
  }

  function scorePhrase(score) {
    if (score >= 78) return '문이 크게 열려 있어 기회만큼 과속 가능성도 커진 상태';
    if (score >= 65) return '힘을 제대로 쓰면 결과가 따라오는 우세한 상태';
    if (score >= 52) return '무리하지 않으면 자기 몫을 확보할 수 있는 상태';
    if (score >= 38) return '실력보다 순서와 경계 설정이 중요한 상태';
    return '확장보다 손실을 줄이고 구조를 다시 점검해야 하는 상태';
  }

  function build(input) {
    input = input || {};
    var elements = Array.isArray(input.elements) ? input.elements.slice(0, 5).map(function (v) { return n(v, 0); }) : [0, 0, 0, 0, 0];
    while (elements.length < 5) elements.push(0);
    var day = DAY_MASTERS[clampIndex(input.dayStem, DAY_MASTERS.length)];
    var dominantIndex = maxIndex(elements);
    var deficientIndex = minIndex(elements);
    var dominant = ELEMENTS[dominantIndex];
    var deficient = ELEMENTS[deficientIndex];
    var totalElements = elements.reduce(function (sum, value) { return sum + value; }, 0) || 1;
    var tenGods = Array.isArray(input.tenGods) ? input.tenGods.map(function (v) { return Math.trunc(n(v, -1)); }).filter(function (v) { return v >= 0 && v < 10; }) : [];
    var tenCounts = new Array(10).fill(0);
    tenGods.forEach(function (value) { tenCounts[value] += 1; });
    var mainGodIndex = maxIndex(tenCounts);
    var mainGod = TEN_GODS[mainGodIndex];
    var monthGod = TEN_GODS[clampIndex(input.monthGod, TEN_GODS.length)];
    var strong = !!input.strong;
    var support = n(input.support, 0);
    var drain = n(input.drain, 0);
    var scores = input.scores || {};
    var moneyScore = n(scores.money, 50);
    var loveScore = n(scores.love, 50);
    var jobScore = n(scores.job, 50);
    var healthScore = n(scores.health, 50);
    var moveScore = n(scores.move, 50);
    var overallScore = n(scores.overall, 50);
    var harmony = n(input.harmony, 0);
    var conflict = n(input.conflict, 0);
    var inter = input.interactions || {};
    var harmonyDetails = (inter.hap || []).concat(inter.ganhap || []);
    var conflictDetails = (inter.chung || []).concat(inter.hyeong || [], inter.pa || [], inter.hae || [], inter.ganchung || []);
    var wealthCount = countWhere(tenGods, [4, 5]);
    var outputCount = countWhere(tenGods, [2, 3]);
    var officialCount = countWhere(tenGods, [6, 7]);
    var resourceCount = countWhere(tenGods, [8, 9]);
    var peerCount = countWhere(tenGods, [0, 1]);
    var partnerCount = input.gender === 'M' ? wealthCount : officialCount;
    var name = String(input.name || '당신');
    var year = Math.trunc(n(input.year, new Date().getFullYear()));
    var seunStemGod = String(input.seunStemGod || '세운');
    var seunBranchGod = String(input.seunBranchGod || '세운');
    var daeunGod = String(input.daeunGod || '대운');
    var yongsin = String(input.yongsin || deficient.name);
    var moneyVerdict = scoreVerdict('money', moneyScore);
    var loveVerdict = scoreVerdict('love', loveScore);
    var jobVerdict = scoreVerdict('job', jobScore);
    var healthVerdict = scoreVerdict('health', healthScore);
    var moveVerdict = scoreVerdict('move', moveScore);

    var moneyStructure;
    if (wealthCount >= 3) moneyStructure = '재성이 전면에 드러나 돈·성과·현실 조건을 빠르게 읽습니다. 돈을 모르는 사람이 아니라, 돈이 움직이는 장면을 지나치게 빨리 알아보는 쪽에 가깝습니다.';
    else if (wealthCount > 0) moneyStructure = '재성이 필요한 만큼 보입니다. 돈은 삶의 유일한 언어가 아니지만, 목표가 구체적일 때 현실 감각이 살아나고 수익 구조를 붙잡을 수 있습니다.';
    else moneyStructure = '표면 재성이 약하다고 돈이 없다는 뜻은 아닙니다. 돈을 직접 좇기보다 실력·지식·직책·관계를 먼저 만들고, 그 뒤에 돈이 결과처럼 붙는 경로가 더 자연스럽습니다.';

    var workStructure;
    if (officialCount >= 2 && outputCount >= 2) workStructure = '규칙을 이해하는 힘과 규칙의 허점을 찾아내는 힘이 함께 있습니다. 조직 안에서 인정받을 능력도 있지만, 납득되지 않는 지시를 오래 견디지는 못합니다.';
    else if (officialCount >= 2) workStructure = '책임·직책·평가의 언어가 강합니다. 권한과 기준이 명확한 자리에서는 오래 버티며 신뢰를 쌓지만, 책임만 있고 결정권이 없는 구조에서는 안쪽부터 마릅니다.';
    else if (outputCount >= 2) workStructure = '결과물을 만들고 자기 방식을 세상에 내놓는 힘이 강합니다. 반복 업무보다 개선·기획·콘텐츠·영업·전문 기술처럼 개인의 해석이 들어가는 일이 맞습니다.';
    else workStructure = mainGod.name + '의 방식으로 일합니다. ' + mainGod.gift + '이 핵심 자산이므로 직함보다 실제로 어떤 권한과 리듬을 갖는지가 중요합니다.';

    var relationshipStructure;
    if (partnerCount >= 2) relationshipStructure = '배우자성에 해당하는 기운이 눈에 띕니다. 관계가 삶의 주변부에 머물기보다 선택과 방향을 크게 흔드는 사건으로 들어오기 쉽습니다.';
    else if (partnerCount === 1) relationshipStructure = '관계의 문은 열려 있지만 아무나 안으로 들이지는 않습니다. 설렘보다 신뢰할 근거가 쌓일 때 비로소 깊어지는 편입니다.';
    else relationshipStructure = '배우자성이 표면에서 강하게 소리치지 않습니다. 인연이 없다는 뜻이 아니라, 관계보다 자기 생존 방식과 일의 구조가 먼저 정리되어야 사랑도 제자리를 찾는 명식입니다.';

    var loopText;
    if (strong && (peerCount + outputCount >= 3)) loopText = '처음에는 스스로 해결하며 속도를 냅니다. 주변은 그 능력을 믿고 더 많은 몫을 얹습니다. 그러다 어느 순간 “왜 결국 나만 하고 있지”라는 분노가 올라오고, 설명 없이 선을 긋거나 판을 떠납니다.';
    else if (!strong && (wealthCount + officialCount >= 3)) loopText = '먼저 기대에 맞추고 책임을 받아냅니다. 버티는 동안에는 괜찮아 보이지만 감당력이 바닥난 뒤에야 힘들었다는 사실을 인정합니다. 문제는 능력 부족이 아니라 한계 통보가 너무 늦다는 데 있습니다.';
    else if (conflictDetails.length > harmonyDetails.length) loopText = '평온할 때보다 긴장이 생겼을 때 본체가 더 또렷해집니다. 갈등을 해결하는 능력은 있지만, 무의식적으로 어려운 사람과 어려운 판을 골라 자신의 힘을 확인하려는 반복이 생길 수 있습니다.';
    else loopText = '큰 파열보다 작은 양보가 오래 누적되는 쪽을 경계해야 합니다. 당장의 평화를 위해 넘긴 문제는 사라지지 않고 관계와 일의 바닥에 얇게 쌓였다가, 결정적인 순간에 한꺼번에 모습을 드러냅니다.';

    var strengthParagraph = strong
      ? '생조하는 힘이 ' + support + ', 소모시키는 힘이 ' + drain + '로 본체 쪽에 무게가 실립니다. 힘이 약해서 못하는 명식이 아닙니다. 오히려 자기 확신과 버티는 힘이 충분하기 때문에, 무엇을 더 얻을지보다 어디에서 힘을 빼야 하는지가 운의 질을 결정합니다.'
      : '생조하는 힘이 ' + support + ', 소모시키는 힘이 ' + drain + '로 바깥의 요구가 본체보다 크게 잡힙니다. 약하다는 낙인이 아니라 감당력의 배분 문제입니다. 환경·사람·일을 제대로 고르면 놀랄 만큼 오래 가지만, 맞지 않는 판에서는 의지보다 회복 비용이 먼저 커집니다.';

    return {
      eyebrow: 'DEEP INSPECTION / 장문 정밀 판독',
      title: name + '의 명식은 한 문장으로 끝나지 않습니다.',
      deck: '좋은 말과 나쁜 말을 나누기 전에, 이 사람이 어떤 방식으로 버티고 욕망하고 무너졌다가 다시 일어서는지부터 읽습니다. 아래 판독은 원국의 실제 구조와 ' + year + '년의 흐름을 겹쳐 쓴 기록입니다.',
      evidence: [day.name + ' 일간', dominant.name + ' ' + elements[dominantIndex] + '/' + totalElements, strong ? '신강 쪽' : '신약 쪽', '용신 ' + yongsin],
      sections: [
        {
          id: 'scene', number: '01', category: '첫 장면', verdict: { label: '본체', tone: 'normal' },
          title: subject(day.image) + ' 방 안으로 들어오는 방식',
          lead: '이 명식의 첫 장면에는 ' + dominant.image + ', 그 한가운데 ' + day.hanja + '—' + day.image + '가 서 있습니다.',
          paragraphs: [
            '겉으로 먼저 보이는 것은 ' + day.surface + '입니다. 그러나 그 힘의 안쪽에는 ' + day.inside + '이 숨어 있습니다. 그래서 ' + name + '님은 단순히 강하거나 부드러운 사람이 아니라, 자기 안에서 납득이 끝났을 때 비로소 전부를 거는 사람에 가깝습니다.',
            '원국에서 ' + dominant.name + ' 기운이 가장 큰 목소리를 냅니다. 이것은 ' + dominant.gift + '을 주지만, 힘이 과해지면 ' + dominant.excess + '으로 바뀝니다. 장점과 약점은 서로 다른 것이 아니라 같은 힘이 어느 선을 넘었느냐의 문제입니다.',
            '반대로 가장 적은 기운은 ' + deficient.name + '입니다. 없는 운명으로 단정할 부분이 아니라 의식적으로 훈련해야 하는 기능입니다. 이 명식이 오래 갈수록 중요해지는 숙제는 ' + deficient.lack + '이며, 가장 현실적인 보완은 ' + deficient.practice + '입니다.'
          ],
          evidence: ['일간 ' + day.hanja + ' ' + day.name, '최다 오행 ' + dominant.name + ' ' + elements[dominantIndex], '최소 오행 ' + deficient.name + ' ' + elements[deficientIndex]]
        },
        {
          id: 'capacity', number: '02', category: '감당력', verdict: { label: strong ? '과열 주의' : '배분 주의', tone: strong ? 'hot' : 'watch' },
          title: '힘이 없는 게 아니라, 힘이 새는 곳이 문제입니다',
          lead: strengthParagraph,
          paragraphs: [
            strong
              ? '신강한 사람의 실패는 대개 무능에서 오지 않습니다. 할 수 있기 때문에 너무 많이 맡고, 버틸 수 있기 때문에 철수 시점을 놓칩니다. 도움을 받는 기술보다 통제권을 쥐는 기술이 먼저 발달했을 가능성이 큽니다.'
              : '신약한 사람의 실패는 대개 의지가 약해서 오지 않습니다. 자신의 리듬보다 타인의 기대와 상황의 압력을 먼저 읽기 때문에, 시작할 때 이미 너무 많은 조건을 받아들입니다. 버티는 것보다 처음 계약할 때 몫을 줄이는 편이 중요합니다.',
            '이 명식의 감당력은 고정된 숫자가 아닙니다. 어떤 사람 곁에 있는지, 결정권이 있는지, 회복할 시간이 확보되는지에 따라 완전히 달라집니다. 그러므로 “나는 강한가 약한가”보다 “어떤 조건에서 강해지는가”를 묻는 쪽이 정확합니다.',
            '실전 처방은 단순합니다. 새 일을 받을 때 능력이 아니라 회복 비용까지 계산하십시오. 하고 나서 쉴 수 없는 일, 끝나도 권한이 남지 않는 일, 책임만 늘고 기준을 세울 수 없는 일은 처음부터 가격과 범위를 다시 정해야 합니다.'
          ],
          evidence: ['생조 ' + support, '소모 ' + drain, strong ? '본체 우세' : '외부 요구 우세']
        },
        {
          id: 'desire', number: '03', category: '욕망', verdict: { label: '핵심 동력', tone: 'strong' },
          title: subject(mainGod.name) + ' 반복해서 요구하는 것',
          lead: '이 명식에서 반복적으로 드러나는 십신은 ' + mainGod.name + '입니다. 삶을 움직이는 깊은 동력은 ' + mainGod.drive + '에 가깝습니다.',
          paragraphs: [
            mainGod.gift + '이 이 사람의 실전 무기입니다. 남들이 결과만 볼 때 ' + name + '님은 그 결과가 만들어지는 구조를 몸으로 익힙니다. 억지로 다른 사람이 되려 하기보다 이 동력을 제대로 쓰는 판을 고르는 것이 빠릅니다.',
            '다만 모든 재능에는 통행료가 있습니다. ' + subject(mainGod.name) + ' 과해질 때 생기는 비용은 ' + mainGod.trap + '입니다. 일이 잘 풀릴수록 이 그림자가 커질 수 있으므로, 성과가 좋을 때 오히려 태도와 관계를 점검해야 합니다.',
            '월주의 천간에서 보이는 ' + topic(monthGod.name) + ' 사회가 이 사람에게 기대하는 얼굴입니다. 안쪽의 ' + withAnd(mainGod.name) + ' 바깥의 ' + subject(monthGod.name) + ' 다르면, 사람들은 안정적으로 보는데 본인은 끊임없이 흔들리거나 그 반대의 간극이 생깁니다. 그 간극을 숨기지 말고 역할과 사생활의 경계로 관리해야 합니다.'
          ],
          evidence: ['주요 십신 ' + mainGod.name + ' ' + tenCounts[mainGodIndex] + '회', '월간 십신 ' + monthGod.name]
        },
        {
          id: 'money', number: '04', category: '돈', verdict: moneyVerdict,
          title: '돈복보다 중요한 것은 돈을 다루는 본체입니다',
          lead: moneyStructure,
          paragraphs: [
            '현재 재물 판정은 ' + moneyScore + '점, ' + scorePhrase(moneyScore) + '입니다. 점수가 높다고 무조건 쌓이는 것이 아니고 낮다고 벌 수 없는 것도 아닙니다. 점수는 올해 돈이 움직이는 압력이고, 실제 잔고는 계약·가격·현금흐름 관리가 결정합니다.',
            outputCount >= 2
              ? '식상 기운이 재성으로 이어질 재료가 있습니다. 말·기술·기획·콘텐츠·서비스처럼 자신이 만들어낸 것을 가격으로 바꾸는 구조가 맞습니다. 문제는 잘 만드는 것과 잘 받는 것이 다른 능력이라는 점입니다. 견적과 결제 조건을 감정에서 분리해야 합니다.'
              : '돈을 만들 때 한 번의 묘수보다 반복 가능한 구조가 중요합니다. 수입원을 늘리기 전에 한 수입원이 어떤 조건에서 남는지부터 계산해야 합니다. 매출보다 마진, 가능성보다 회수 시점이 이 명식의 돈을 지킵니다.',
            peerCount >= 2
              ? '비겁이 돈 옆에 서면 사람 때문에 돈이 움직입니다. 동업·소개·관계 지출이 기회가 되기도 하지만, 의리와 사업 조건이 섞이는 순간 손익이 흐려집니다. 친한 사람일수록 역할·지분·철수 조건을 문서로 남기십시오.'
              : '사람보다 구조를 통해 돈을 지키는 편이 낫습니다. 자동이체·분리 계좌·한도·계약서처럼 의지에 기대지 않는 장치를 만들면 재물의 출렁임이 크게 줄어듭니다.'
          ],
          evidence: ['재성 ' + wealthCount, '식상 ' + outputCount, '비겁 ' + peerCount, year + ' 재물 점수 ' + moneyScore]
        },
        {
          id: 'work', number: '05', category: '직업·사업', verdict: jobVerdict,
          title: '직함보다 결정권이 있어야 오래 갑니다',
          lead: workStructure,
          paragraphs: [
            '올해 직업 판정은 ' + jobScore + '점입니다. 중요한 것은 이직 여부 하나가 아니라, 지금 자리에서 책임과 권한의 비율이 맞는지입니다. 책임은 계속 늘어나는데 결정권과 보상이 그대로라면 운이 나빠서가 아니라 구조가 이미 기울어진 것입니다.',
            strong
              ? '본체가 강한 편이라 자율성이 생기면 성과가 빠릅니다. 사업·리더 역할·전문가 포지션처럼 자신의 판단을 결과로 증명하는 자리가 맞습니다. 다만 모든 것을 직접 통제하면 규모가 커질수록 본인이 병목이 됩니다. 위임 기준을 만드는 일이 다음 성장입니다.'
              : '환경의 질에 따라 성과 편차가 큰 편입니다. 혼자 모든 위험을 떠안는 사업보다 검증된 파트너·계약·고정 수입을 발판으로 확장하는 방식이 안전합니다. 준비된 판에서는 약하지 않지만, 규칙 없는 판에서는 소모가 먼저 옵니다.',
            '사업 가능성은 용기보다 현금흐름과 반복성으로 판정해야 합니다. 고객이 왜 다시 오는지, 내가 빠져도 무엇이 남는지, 최악의 세 달을 버틸 돈이 있는지에 답할 수 있다면 시작해도 됩니다. 답이 없다면 꿈이 틀린 것이 아니라 순서가 이른 것입니다.'
          ],
          evidence: ['관성 ' + officialCount, '식상 ' + outputCount, '월간 ' + monthGod.name, year + ' 직업 점수 ' + jobScore]
        },
        {
          id: 'love', number: '06', category: '연애·결혼', verdict: loveVerdict,
          title: '끌리는 사람과 오래 사는 사람은 다를 수 있습니다',
          lead: relationshipStructure,
          paragraphs: [
            '올해 관계의 온도는 ' + loveScore + '점, ' + scorePhrase(loveScore) + '입니다. 인연의 유무보다 중요한 것은 어떤 상태의 내가 누구에게 끌리는가입니다. 지쳤을 때 강한 사람에게 기대고, 답답할 때 불안정한 사람에게 설레는 식이라면 상대가 아니라 자신의 결핍이 선택하고 있을 가능성이 큽니다.',
            conflictDetails.length
              ? '원국 안에 충·형·파·해의 긴장이 보입니다. 사랑이 평온하기만 하면 감정이 약해졌다고 오해하거나, 문제가 생긴 뒤에야 진심이 확인된다고 느낄 수 있습니다. 그러나 강렬함은 친밀함의 증거가 아닙니다. 싸움 뒤의 화해보다 싸우기 전의 설명을 배우는 것이 관계운을 바꿉니다.'
              : '원국의 관계선은 큰 파열보다 축적형에 가깝습니다. 웬만한 일은 넘길 수 있지만, 넘긴 일이 사라지는 것은 아닙니다. 서운함이 작을 때 말하고 합의가 흐려질 때 다시 묻는 사람이 결국 오래 갑니다.',
            '결혼은 사랑의 완성이 아니라 생활 운영의 시작입니다. 돈을 쓰는 기준, 혼자 있는 시간, 가족의 개입, 일의 우선순위를 미리 말해보십시오. 이 네 가지를 대화할 수 없는 관계라면 감정이 아무리 커도 실전에서 흔들립니다.'
          ],
          evidence: ['배우자성 ' + partnerCount, '합 ' + harmonyDetails.length, '충돌 ' + conflictDetails.length, year + ' 연애 점수 ' + loveScore]
        },
        {
          id: 'people', number: '07', category: '인간관계', verdict: conflict > harmony ? { label: '주의', tone: 'watch' } : { label: '정상', tone: 'normal' },
          title: '사람을 보는 눈보다 경계를 세우는 손이 필요합니다',
          lead: '합의 신호는 ' + harmonyDetails.length + '개, 긴장 신호는 ' + conflictDetails.length + '개가 잡힙니다. 관계는 좋고 나쁨이 아니라 가까워지는 방식과 멀어지는 방식의 반복으로 읽어야 합니다.',
          paragraphs: [
            harmonyDetails.length
              ? '합이 있다는 것은 사람을 엮고 상황을 봉합하는 능력입니다. 서로 다른 요구 사이에서 공통점을 찾아내는 힘이 있지만, 모든 관계를 살려야 한다는 의무는 없습니다. 연결 능력이 좋은 사람일수록 끊어야 할 관계를 늦게 끊습니다.'
              : '쉽게 섞이기보다 관찰한 뒤 자리를 정하는 편입니다. 처음에는 차갑게 보일 수 있지만 한번 자기 사람으로 판단하면 오래 갑니다. 넓은 관계망보다 역할이 분명한 소수 관계가 실제 힘이 됩니다.',
            conflictDetails.length
              ? '긴장 구조는 사람을 잃으라는 예언이 아닙니다. 오히려 갈등을 초기에 다루라는 경고입니다. 불편함을 참다가 마지막에 판결문처럼 통보하면 상대는 과정 없이 결과만 받게 됩니다. 중간 설명을 두 번 더 하는 것이 손실을 줄입니다.'
              : '갈등 신호가 적으면 싸움을 잘 피하지만, 필요한 충돌까지 미룰 수 있습니다. 평화를 지키는 것과 자기 입장을 지우는 것은 다릅니다. 좋은 관계는 무조건 맞춰주는 관계가 아니라 다른 요구를 협상할 수 있는 관계입니다.',
            resourceCount >= 2
              ? '인성이 강하면 이해하고 해석하는 시간이 길어집니다. 상대의 사정까지 이해한 뒤 자기 감정을 말하려 하므로 타이밍을 놓치기 쉽습니다. 이해가 끝나지 않아도 경계는 먼저 세울 수 있습니다.'
              : '생각만 오래 하기보다 실제 반응을 통해 관계를 판단하는 편입니다. 빠른 결론의 장점은 분명하지만, 한 장면을 그 사람 전체로 확대하지 않도록 사실을 한 번 더 확인하십시오.'
          ],
          evidence: harmonyDetails.concat(conflictDetails).slice(0, 5).length ? harmonyDetails.concat(conflictDetails).slice(0, 5) : ['뚜렷한 합충보다 일상적 선택의 영향이 큼']
        },
        {
          id: 'loop', number: '08', category: '반복 패턴', verdict: { label: '재검', tone: 'recheck' },
          title: '문제는 사건이 아니라 반복되는 순서입니다',
          lead: loopText,
          paragraphs: [
            '사람은 같은 사건을 반복하지 않습니다. 같은 순서를 반복합니다. 처음에 무엇을 참았는지, 언제 도움을 거절했는지, 어떤 신호를 무시했는지가 마지막 결과보다 중요합니다. 인생이 자꾸 비슷하게 끝난다면 시작 장면을 다시 봐야 합니다.',
            '이 명식의 그림자는 ' + day.shadow + '입니다. 이것을 성격의 결함으로 몰아붙이면 더 숨어버립니다. 대신 그림자가 나타나는 조건을 기록하십시오. 수면이 부족할 때, 돈이 급할 때, 인정받고 싶을 때처럼 조건을 알면 선택을 바꿀 틈이 생깁니다.',
            '반복을 끊는 핵심은 ' + day.growth + '입니다. 거대한 결심보다 작은 규칙 하나가 낫습니다. 같은 문제가 세 번째 보이면 의지로 버티지 말고 계약·일정·거리·가격 중 하나를 바꾸십시오. 구조가 그대로인데 마음만 새로 먹는 것은 재발 준비에 가깝습니다.'
          ],
          evidence: ['일간의 그림자', strong ? '과잉 감당 패턴' : '과잉 수용 패턴', '긴장 신호 ' + conflictDetails.length]
        },
        {
          id: 'timing', number: '09', category: year + '년', verdict: scoreVerdict('overall', overallScore),
          title: '올해는 운이 오는 해가 아니라, 운을 다루는 방식이 드러나는 해입니다',
          lead: '세운 천간의 ' + seunStemGod + ', 지지의 ' + seunBranchGod + '이 현재 대운의 ' + daeunGod + ' 위로 들어옵니다. 종합 압력은 ' + overallScore + '점입니다.',
          paragraphs: [
            overallScore >= 65
              ? '문이 열릴 때 가장 위험한 착각은 들어오는 제안을 전부 기회라고 믿는 것입니다. 올해는 선택지가 늘수록 기준이 필요합니다. 하고 싶은 일보다 남길 수 있는 일을 고르면 운의 크기가 실적과 자산으로 남습니다.'
              : '올해는 큰 승부보다 정리의 정확도가 중요합니다. 불리한 흐름은 인생 전체의 실패가 아니라 잘못 연결된 비용을 드러내는 조명입니다. 사람·일·지출 가운데 반복해서 새는 한 곳을 막는 것이 새 일을 벌이는 것보다 효과가 큽니다.',
            harmony > conflict
              ? '세운이 원국과 맺는 합의 신호가 긴장보다 우세합니다. 혼자 밀어붙이는 것보다 이미 알고 지낸 사람, 과거에 쌓은 기술, 이전에 미완으로 남긴 일에서 길이 열릴 가능성이 큽니다. 새로움보다 연결과 재사용을 먼저 보십시오.'
              : '세운의 긴장이 합보다 강합니다. 일정 변경, 역할 충돌, 예상 밖의 요구가 생길 수 있으니 계획에 여백을 두어야 합니다. 이것을 불운으로 겁낼 필요는 없지만, 한 번에 되돌릴 수 없는 결정은 검토 시간을 두 번 가지십시오.',
            '용신으로 잡힌 ' + yongsin + '의 기능을 생활에 끌어오는 것이 올해의 실전 열쇠입니다. 상징을 소비하는 대신 ' + ELEMENTS[clampIndex(input.yongsinIndex, ELEMENTS.length)].practice + '이 실제 개운에 가깝습니다.'
          ],
          evidence: ['세운 ' + String(input.seunGanji || year), '천간 ' + seunStemGod, '지지 ' + seunBranchGod, '대운 ' + daeunGod]
        },
        {
          id: 'care', number: '10', category: '자기관리', verdict: healthVerdict,
          title: '몸은 운명을 예언하지 않고, 사용 습관을 기록합니다',
          lead: '자기관리 흐름은 ' + healthScore + '점입니다. 이것은 질병을 예언하는 점수가 아니라 생활 리듬과 회복 여지를 점검하는 표시입니다.',
          paragraphs: [
            dominant.name + ' 기운이 강한 사람은 ' + dominant.excess + '이 생활 습관으로 나타날 때 피로가 커집니다. 잘 버티는 날의 기준으로 일정을 짜지 말고, 평범한 날에도 반복할 수 있는 수면·식사·운동의 하한선을 정하십시오.',
            moveScore >= 65
              ? '이동과 변화의 압력이 높은 시기에는 몸보다 일정이 먼저 달립니다. 출발과 마감 사이에 빈칸을 넣고, 새로운 환경에 적응하는 시간을 업무 시간으로 계산해야 합니다.'
              : '움직임이 크지 않은 시기에는 정체가 편안함으로 위장하기 쉽습니다. 거창한 운동보다 걷는 시간, 화면을 끄는 시간, 혼자 회복하는 시간을 일정에 먼저 넣는 편이 낫습니다.',
            '불편한 증상이나 지속되는 변화는 명리 해석으로 판단하지 말고 의료 전문가와 확인하십시오. 사주가 할 수 있는 일은 진단이 아니라, 자신을 소모하는 반복을 더 일찍 알아차리게 돕는 데까지입니다.'
          ],
          evidence: ['자기관리 점수 ' + healthScore, '최다 오행 ' + dominant.name, '이동 점수 ' + moveScore]
        }
      ],
      closing: {
        eyebrow: 'FINAL VERDICT / 최종 판결',
        title: strong ? '판은 충분합니다. 이제 감당할 것만 고르십시오.' : '약한 팔자가 아닙니다. 맞지 않는 짐을 오래 든 겁니다.',
        paragraphs: [
          name + '님의 명식은 한쪽으로만 설명되지 않습니다. ' + day.surface + '과 ' + day.inside + '이 동시에 있고, ' + dominant.gift + '이 재능인 동시에 ' + dominant.excess + '으로 변할 가능성도 함께 있습니다.',
          '팔자는 결론이 아니라 반복해서 펼쳐지는 질문에 가깝습니다. 같은 기운도 어떤 사람과 어떤 구조에서 쓰느냐에 따라 성과가 되기도 하고 비용이 되기도 합니다. 결국 중요한 것은 운을 믿는 일이 아니라, 자신의 패턴을 먼저 알아보고 선택의 순서를 바꾸는 일입니다.'
        ],
        rules: [
          '할 수 있는 일보다 끝나고도 내가 남는 일을 고를 것.',
          '관계에서는 참은 횟수보다 설명한 횟수를 늘릴 것.',
          '돈은 가능성이 아니라 회수 구조와 감당력으로 판단할 것.',
          deficient.practice + '.',
          '올해의 큰 결정은 감정이 가장 뜨거운 날 바로 확정하지 말 것.'
        ]
      }
    };
  }

  global.SajuGangpaeReading = Object.freeze({ build: build });
})(typeof window !== 'undefined' ? window : globalThis);
