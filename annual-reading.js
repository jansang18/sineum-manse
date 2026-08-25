(function (global) {
  'use strict';

  const DOMAIN_LABELS = {
    overall: '종합 흐름',
    job: '일과 책임',
    money: '재정과 자원',
    love: '관계와 인연',
    health: '몸과 생활 리듬',
    move: '이동과 변화'
  };

  const GOD_GUIDE = {
    비견: ['자기 기준과 독립성', '주도권을 분명히 세우되 협업의 몫까지 혼자 떠안지 않는 것'],
    겁재: ['경쟁·분배·관계의 긴장', '사람과 돈이 섞이는 약속을 문서와 숫자로 확인하는 것'],
    식신: ['꾸준한 생산과 생활의 안정', '작게라도 매일 결과물을 쌓고 몸의 리듬을 일정하게 유지하는 것'],
    상관: ['표현·변화·기존 방식에 대한 문제 제기', '할 말의 내용과 전달 시점을 분리해 불필요한 충돌을 줄이는 것'],
    편재: ['외부 기회·유동 자원·넓은 인맥', '들어오는 제안을 빠르게 보되 손익과 지속 가능성을 먼저 계산하는 것'],
    정재: ['고정 수입·관리·현실적인 축적', '예산과 일정처럼 반복 가능한 관리 체계를 만드는 것'],
    편관: ['압박·책임·속도감 있는 결단', '급한 상황일수록 기준과 안전장치를 먼저 세우는 것'],
    정관: ['공식 책임·평가·질서', '신뢰와 절차를 지키면서 맡은 역할의 범위를 명확히 하는 것'],
    편인: ['새 관점·직감·비정형 학습', '생각을 넓히되 현실 검증과 마감 시점을 놓치지 않는 것'],
    정인: ['보호·학습·문서·회복', '배운 것을 실제 자격·기록·결과물로 연결하는 것']
  };

  const DOMAIN_COPY = {
    job: {
      high: '직업 점수가 높은 편이므로 책임이 커지는 장면을 피하기보다, 권한·평가기준·보상을 먼저 확인한 뒤 받아들이는 편이 좋습니다. 이직이나 역할 변경은 막연한 탈출보다 다음 자리에서 무엇을 맡고 무엇을 남길지까지 문장으로 정리할 때 유리합니다.',
      mid: '직업 흐름은 한 번에 크게 뛰기보다 실적과 신뢰를 축적하는 쪽에 가깝습니다. 눈에 띄는 자리만 좇기보다 반복 업무를 정리하고, 내가 잘하는 일을 다른 사람이 확인할 수 있는 결과물로 남기는 것이 다음 기회를 부릅니다.',
      low: '직업 영역은 성급한 승부보다 방어와 정리가 우선입니다. 업무 범위를 흐리게 만드는 구두 약속, 책임만 늘고 권한은 없는 제안, 감정적으로 결정하는 퇴사·이직은 한 번 더 검토하는 편이 안전합니다.'
    },
    money: {
      high: '재정 흐름에는 수입원을 넓히거나 묶여 있던 자원을 움직일 여지가 있습니다. 다만 호조일수록 지출도 함께 커질 수 있으므로, 수익을 생활비·비상금·장기자금으로 자동 분리해 남는 구조를 먼저 만드십시오.',
      mid: '재정은 큰 승부보다 현금흐름 관리에서 차이가 납니다. 고정비를 줄이고 예상 밖 지출의 상한을 정하며, 투자나 구매는 수익 가능성뿐 아니라 회수 기간과 최악의 경우까지 계산하는 편이 맞습니다.',
      low: '재정 영역은 잃지 않는 전략이 성과가 되는 시기입니다. 보증·동업·과도한 레버리지·충동 구매처럼 다른 사람의 판단과 내 돈이 섞이는 선택을 줄이고, 계약과 자동결제부터 정리하는 것이 우선입니다.'
    },
    love: {
      high: '관계 흐름은 사람을 만나고 마음을 표현하는 데 비교적 열려 있습니다. 새로운 인연은 빠른 확정보다 생활 방식과 돈·시간을 다루는 태도를 살피고, 기존 관계는 함께 결정할 작은 계획을 세울 때 신뢰가 깊어집니다.',
      mid: '관계는 강한 사건보다 대화의 질에서 달라집니다. 상대의 말을 추측으로 완성하지 말고 확인 질문을 사용하며, 서운함은 오래 쌓기보다 사실·감정·요청을 나누어 말하는 것이 좋습니다.',
      low: '관계 영역은 감정의 속도와 현실의 속도가 어긋나기 쉽습니다. 관계를 시험하는 말, 즉석에서 내리는 결별·약속, 제삼자의 평가에 기대는 판단을 줄이고 중요한 대화는 몸과 마음이 가라앉은 뒤 다시 잡으십시오.'
    },
    health: {
      high: '생활 리듬을 세우고 체력을 회복하기 좋은 편입니다. 무리한 단기 목표보다 수면·식사·걷기처럼 매일 반복할 수 있는 기준을 정하고, 상태가 좋을 때 예방 검진과 필요한 치료 일정을 챙기는 것이 효과적입니다.',
      mid: '몸의 상태는 일정 관리에 민감하게 반응할 수 있습니다. 바쁜 날과 회복하는 날을 구분하고, 피로가 누적되기 전에 수면·음주·카페인·식사 시간을 조정하십시오. 반복되는 증상은 운세로 판단하지 말고 의료진에게 확인해야 합니다.',
      low: '건강 영역은 버티는 힘보다 회복 여유를 확보하는 것이 중요합니다. 과로·수면 부족·과음·무리한 운동을 겹치지 않게 하고, 통증이나 이상 신호가 이어지면 미루지 말고 전문적인 검사와 상담을 우선하십시오.'
    },
    move: {
      high: '이동과 변화의 점수가 높아 자리·역할·생활환경을 바꾸는 선택이 현실적인 대안이 될 수 있습니다. 다만 움직임 자체를 성과로 착각하지 말고 비용·통근·계약·회복 기간을 포함한 전환 계획을 세우십시오.',
      mid: '큰 이동을 강제로 만들 필요는 없지만 필요한 변화는 실행할 수 있습니다. 이사·출장·직무 변경은 목적과 종료 조건을 분명히 하고, 한 번에 모든 것을 바꾸기보다 시험 기간을 두는 편이 좋습니다.',
      low: '이동 영역은 서두를수록 누락이 생길 수 있습니다. 부동산·차량·여행·이직 계약은 일정과 비용을 보수적으로 잡고, 취소 조건·하자·보험·인수인계처럼 되돌아올 때 문제가 되는 항목을 먼저 확인하십시오.'
    }
  };

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function scoreBand(score) {
    if (score >= 70) return 'high';
    if (score < 45) return 'low';
    return 'mid';
  }

  function scoreTone(score) {
    if (score >= 75) return 'strong';
    if (score < 45) return 'watch';
    return 'normal';
  }

  function godGuide(god) {
    return GOD_GUIDE[god] || ['상황에 맞는 역할 조정', '결정 전에 조건과 책임의 범위를 확인하는 것'];
  }

  function scoreSentence(label, score) {
    const band = scoreBand(score);
    if (band === 'high') return `${label} ${score}점은 활용 여지가 비교적 큰 영역입니다. 기회가 보일 때 준비된 선택으로 연결하되, 좋은 흐름을 과신하지 않는 관리가 필요합니다.`;
    if (band === 'low') return `${label} ${score}점은 속도보다 점검이 필요한 영역입니다. 결과를 억지로 만들기보다 손실을 줄이고 기준을 다시 세우는 과정 자체를 성과로 보십시오.`;
    return `${label} ${score}점은 선택과 관리에 따라 체감이 달라지는 구간입니다. 큰 결론보다 확인 가능한 작은 실행을 반복할수록 흐름이 안정됩니다.`;
  }

  function interactionSentence(input) {
    const harmony = number(input.harmony, 0);
    const conflict = number(input.conflict, 0);
    if (harmony > conflict + 1) {
      return `원국과 세운의 조화 지수(${harmony})가 긴장 지수(${conflict})보다 앞섭니다. 사람·환경과 맞물리는 접점이 생길 때 혼자 밀어붙이기보다 도움을 요청하고 역할을 나누는 편이 흐름을 더 크게 씁니다.`;
    }
    if (conflict > harmony + 1) {
      return `원국과 세운의 긴장 지수(${conflict})가 조화 지수(${harmony})보다 높습니다. 이것을 곧바로 나쁜 사건으로 보지는 않지만, 일정 충돌·말의 오해·계약 누락처럼 마찰이 커지는 지점을 미리 점검해야 합니다.`;
    }
    return `원국과 세운의 조화(${harmony})와 긴장(${conflict})이 비슷해 한쪽으로만 기울지 않습니다. 좋은 제안에도 조건이 붙고 부담스러운 변화에도 쓸모가 있으므로, 장단점을 함께 기록한 뒤 결정하는 태도가 중요합니다.`;
  }

  function strongest(scores) {
    return Object.entries(scores)
      .filter(([key]) => key !== 'overall')
      .sort((a, b) => b[1] - a[1])[0] || ['job', 50];
  }

  function weakest(scores) {
    return Object.entries(scores)
      .filter(([key]) => key !== 'overall')
      .sort((a, b) => a[1] - b[1])[0] || ['health', 50];
  }

  function monthGuidance(month, index) {
    const stemGuide = godGuide(month.stemGod);
    const branchGuide = godGuide(month.branchGod);
    const relation = number(month.harmony, 0) > number(month.conflict, 0)
      ? '원국과 맞물리는 접점이 있어 협력과 조율을 먼저 시도할 만합니다.'
      : number(month.conflict, 0) > number(month.harmony, 0)
        ? '마찰 신호가 더 크므로 일정·계약·말의 표현을 한 번 더 확인하는 편이 안전합니다.'
        : '합과 충이 한쪽으로 기울지 않아 평소의 준비와 선택이 결과를 좌우합니다.';
    return {
      month: number(month.month, index + 1),
      ganji: String(month.ganji || ''),
      label: `${number(month.month, index + 1)}월 · ${month.stemGod || '십신'} / ${month.branchGod || '십신'}`,
      guidance: `${month.stemGod || '천간'}의 ${stemGuide[0]}과 ${month.branchGod || '지지'}의 ${branchGuide[0]}이 함께 드러나는 달입니다. ${relation} 천간의 과제는 ${stemGuide[1]}이고, 지지의 과제는 ${branchGuide[1]}입니다. 둘을 한꺼번에 해결하려 하기보다 이번 달에 확인할 행동 하나와 멈출 행동 하나를 정하십시오.`
    };
  }

  function build(rawInput) {
    const source = rawInput || {};
    const rawYear = Number(source.year);
    if (!Number.isInteger(rawYear)) throw new TypeError('선택 연도는 정수여야 합니다.');
    if (rawYear < 1026 || rawYear > 2099) throw new RangeError('선택 연도는 1026년부터 2099년 사이여야 합니다.');
    const year = rawYear;
    const scores = {
      overall: number(source.scores?.overall, 50),
      love: number(source.scores?.love, 50),
      job: number(source.scores?.job, 50),
      money: number(source.scores?.money, 50),
      health: number(source.scores?.health, 50),
      move: number(source.scores?.move, 50)
    };
    const input = { ...source, scores };
    const ganji = String(input.seunGanji || '세운');
    const stemGod = String(input.seunStemGod || '천간 십신');
    const branchGod = String(input.seunBranchGod || '지지 십신');
    const stemGuide = godGuide(stemGod);
    const branchGuide = godGuide(branchGod);
    const [strongKey, strongScore] = strongest(scores);
    const [weakKey, weakScore] = weakest(scores);
    const age = number(input.age, year - number(input.birthYear, year));
    const daeunStartAge = number(input.daeunStartAge, NaN);
    const daeunEndAge = number(input.daeunEndAge, NaN);
    const daeunAgeSpan = Number.isFinite(daeunStartAge)
      ? `${daeunStartAge}세${Number.isFinite(daeunEndAge) ? `부터 ${daeunEndAge}세까지` : '부터'}`
      : '약 10년 동안';
    const strongLabel = DOMAIN_LABELS[strongKey];
    const weakLabel = DOMAIN_LABELS[weakKey];
    const balanceText = input.strong
      ? `원국이 비교적 힘을 가진 구조이므로 ${input.yongsin || '용신'} 기운처럼 힘을 밖으로 쓰고 조절하는 방향이 중요합니다.`
      : `원국이 도움을 받아 힘을 모으는 구조이므로 ${input.yongsin || '용신'} 기운처럼 기반과 회복을 보충하는 방향이 중요합니다.`;
    const yearRelation = interactionSentence(input);
    const overallBand = scoreBand(scores.overall);
    const overallLead = overallBand === 'high'
      ? '준비해 둔 일을 현실의 자리와 책임으로 연결하기 좋은 편입니다.'
      : overallBand === 'low'
        ? '확장보다 손실을 줄이고 기준을 다시 세우는 일이 먼저입니다.'
        : '큰 한 방보다 선택의 정확도와 꾸준한 관리가 결과를 만듭니다.';

    const sections = [
      {
        id: 'structure',
        title: `${ganji}년이 원국에 들어오는 방식`,
        summary: `${stemGod}·${branchGod}이 만드는 ${year}년의 중심 작용`,
        tone: scoreTone(scores.overall),
        paragraphs: [
          `${year}년 ${ganji}년의 천간은 ${stemGod}, 지지는 ${branchGod}으로 읽힙니다. 천간의 ${stemGuide[0]}은 겉으로 드러나는 사건과 선택의 방식을, 지지의 ${branchGuide[0]}은 생활 속에서 반복되는 감정·관계·환경의 압력을 보여줍니다. 두 기운을 따로 보지 말고, 무엇이 들어오고 그것을 어떤 태도로 처리하는지 한 묶음으로 보아야 합니다.`,
          `${input.name || '사용자'}님의 일간 ${input.dayStem || ''}(${input.dayElement || '오행'})에 ${input.annualStemElement || '세운'}와 ${input.annualBranchElement || '세운'}의 기운이 겹칩니다. ${balanceText} 따라서 ${year}년의 핵심은 운이 좋고 나쁨을 단정하는 데 있지 않고, 들어온 역할을 내 체력과 자원에 맞게 조절하는 데 있습니다.`,
          `${yearRelation} ${scoreSentence('종합 흐름', scores.overall)} ${overallLead} 특히 중요한 결정은 기대 효과뿐 아니라 감당해야 할 시간·비용·관계의 책임까지 한 문서에 적어 비교하십시오.`
        ]
      },
      {
        id: 'daeun',
        title: '대운과 세운이 겹치는 지점',
        summary: `${input.daeunGanji || '선택 연도 대운'} 위에 ${ganji} 세운이 올라오는 구조`,
        tone: 'normal',
        paragraphs: [
          `선택한 대운 ${input.daeunGanji || ''}의 천간 ${input.daeunStemGod || '십신'}과 지지 ${input.daeunBranchGod || '십신'}은 ${daeunAgeSpan} 이어지는 배경입니다. 그 위에 ${year}년의 ${stemGod}·${branchGod}이 올라오므로, 선택 연도의 사건은 갑자기 생긴 단독 신호라기보다 이미 진행 중인 대운의 과제를 더 분명하게 드러내는 촉발점으로 보는 편이 맞습니다.`,
          `대운은 방향을 만들고 세운은 시점을 선명하게 합니다. 대운에서 요구하는 역할과 ${year}년의 역할이 같다면 일이 빠르게 진행될 수 있지만 부담도 한곳에 몰립니다. 반대로 서로 다른 요구가 들어오면 직장과 가정, 안정과 변화, 내 기준과 타인의 기준 사이에서 우선순위를 다시 정해야 합니다.`,
          `연도 기준 ${age}세에 해당하는 이 해에는 결과만 보는 것보다 다음 해에도 남을 자산을 구분해야 합니다. 기술·자격·평판·저축·건강 습관처럼 시간이 지나도 남는 것을 먼저 선택하고, 즉각적인 인정이나 감정 해소만 남는 선택은 하루 이상 간격을 두고 다시 검토하십시오.`
        ]
      },
      {
        id: 'timing',
        title: '상반기와 하반기의 운용법',
        summary: '월운은 예언표가 아니라 행동 강도를 조절하는 달력입니다',
        tone: 'normal',
        paragraphs: [
          `1월부터 3월은 ${year}년의 조건을 확인하고 기준을 세우는 준비 구간으로 쓰십시오. 새 제안은 바로 확정하기보다 필요한 자료와 사람을 모으고, 지난 계약·일정·생활비에서 반복되는 누수를 찾는 편이 좋습니다. 초반에 기준이 선명할수록 중반의 속도를 감당하기 쉬워집니다.`,
          `4월부터 8월은 세운의 성격이 체감되기 쉬운 실행 구간입니다. ${stemGod}이 요구하는 ${stemGuide[0]}을 실제 결과물로 옮기되, 일정이 몰릴수록 쉬는 시간과 검토 단계를 먼저 확보하십시오. 잘 풀리는 일은 범위를 넓히고, 같은 문제가 두 번 반복되면 힘으로 밀기보다 구조를 바꾸어야 합니다.`,
          `9월부터 12월은 성과와 손실을 분리해 정리하는 구간입니다. 남길 관계·업무·지출과 끝낼 것을 구분하고, ${year}년의 경험을 다음 해 일정과 예산에 반영하십시오. 아래 월별 지도는 각 달의 월간지와 십신, 원국과의 합충을 요약한 참고표이며 실제 계약일·의료·투자 판단은 별도 확인이 필요합니다.`
        ]
      },
      {
        id: 'work',
        title: '일과 책임',
        summary: `${scores.job}점 · 역할, 평가, 이직과 성과의 사용법`,
        tone: scoreTone(scores.job),
        paragraphs: [
          `${scoreSentence('일과 책임', scores.job)} ${DOMAIN_COPY.job[scoreBand(scores.job)]}`,
          `세운 천간 ${stemGod}은 ${stemGuide[0]}을 통해 외부에 보이는 태도를 만들고, 지지 ${branchGod}은 ${branchGuide[0]}을 반복 과제로 만듭니다. 회의·보고·협상에서는 결론, 근거, 요청사항을 나누어 말하고 중요한 합의는 기록으로 남겨야 평가와 책임이 뒤섞이지 않습니다.`,
          `실행 순서는 세 가지면 충분합니다. 첫째 현재 역할에서 측정 가능한 결과 하나를 정하고, 둘째 그 결과에 필요한 권한과 시간을 확보하며, 셋째 중간 점검일을 달력에 넣으십시오. 이직·사업·승진을 검토한다면 보이는 직함보다 실제 업무 범위와 6개월 뒤 남을 경력을 비교하는 것이 중요합니다.`
        ]
      },
      {
        id: 'money',
        title: '재정과 자원',
        summary: `${scores.money}점 · 수입, 지출, 투자와 계약의 기준`,
        tone: scoreTone(scores.money),
        paragraphs: [
          `${scoreSentence('재정과 자원', scores.money)} ${DOMAIN_COPY.money[scoreBand(scores.money)]}`,
          `돈의 흐름은 재성만이 아니라 일의 지속성, 관계의 요구, 이동 비용과 함께 봐야 합니다. ${year}년에는 들어올 돈의 최대치보다 반드시 나갈 고정비와 예외 비용을 먼저 계산하고, 큰 결제·투자·대출은 낙관·기준·최악의 세 시나리오로 나누어 보십시오.`,
          `특히 가족·친구·동료와 돈이 섞이면 좋은 의도만으로는 부족합니다. 금액, 기간, 책임, 중도 종료 조건을 문서로 남기고 이해하지 못한 상품에는 서명하지 마십시오. 재정 점수가 높아도 집중 투자는 피하고, 낮아도 공포로 모든 기회를 닫기보다 감당 가능한 작은 규모로 검증하는 편이 낫습니다.`
        ]
      },
      {
        id: 'relationships',
        title: '관계와 인연',
        summary: `${scores.love}점 · 가까운 관계와 새로운 만남의 온도`,
        tone: scoreTone(scores.love),
        paragraphs: [
          `${scoreSentence('관계와 인연', scores.love)} ${DOMAIN_COPY.love[scoreBand(scores.love)]}`,
          `${year}년 관계의 관건은 ${stemGuide[0]}을 내 방식대로만 밀지 않고, 상대가 받아들일 수 있는 언어로 조율하는 것입니다. 새로운 만남은 첫인상의 강도보다 약속을 지키는 방식, 갈등을 다루는 태도, 돈과 시간을 쓰는 기준을 천천히 확인하십시오.`,
          `가까운 관계에서는 해결책을 제시하기 전에 상대가 원하는 것이 공감인지 결정인지 물어보는 습관이 도움이 됩니다. 반복되는 갈등은 누가 옳은지를 따지기보다 언제·어떤 조건에서 시작되는지 기록하면 구조가 보입니다. 위협·통제·폭력이 있는 관계라면 운세 해석보다 안전 확보와 전문 지원이 우선입니다.`
        ]
      },
      {
        id: 'health',
        title: '몸과 생활 리듬',
        summary: `${scores.health}점 · 체력, 회복, 습관을 지키는 방법`,
        tone: scoreTone(scores.health),
        paragraphs: [
          `${scoreSentence('몸과 생활 리듬', scores.health)} ${DOMAIN_COPY.health[scoreBand(scores.health)]}`,
          `세운의 ${input.annualStemElement || '오행'}·${input.annualBranchElement || '오행'} 기운은 특정 질병을 확정하는 표지가 아니라, 생활의 어느 부분이 과열되거나 부족해지는지 돌아보게 하는 참고 신호입니다. 수면 시간, 피로도, 통증, 음주와 운동을 간단히 기록하면 감각만으로 버티는 것보다 변화 시점을 빨리 알아차릴 수 있습니다.`,
          `일정표에는 일만 넣지 말고 회복 시간도 약속처럼 고정하십시오. 출장·야근·모임이 겹치는 주에는 운동 강도를 낮추고, 반복되는 불편이나 정신적 어려움은 사주로 원인을 단정하지 말고 의료기관이나 자격 있는 전문가에게 상담하십시오.`
        ]
      },
      {
        id: 'movement',
        title: `이동과 변화, ${year}년의 결론`,
        summary: `${scores.move}점 · 움직일 것과 지킬 것을 구분하는 기준`,
        tone: scoreTone(scores.move),
        paragraphs: [
          `${scoreSentence('이동과 변화', scores.move)} ${DOMAIN_COPY.move[scoreBand(scores.move)]}`,
          `${year}년에 가장 활용하기 좋은 영역은 ${strongLabel} ${strongScore}점이고, 가장 세심한 관리가 필요한 영역은 ${weakLabel} ${weakScore}점입니다. 강한 영역의 자원으로 약한 영역을 보완하십시오. 예를 들어 일의 기회가 강해도 건강이 약하면 일정의 상한을 정하고, 이동이 강해도 재정이 약하면 비용 한도를 먼저 세우는 방식입니다.`,
          `${year}년의 결론은 모든 기회를 잡는 것이 아니라, 내게 남을 결과를 골라 책임 있게 완성하는 것입니다. 결정 전에는 사실과 기대를 구분하고, 실행 중에는 중간 점검을 두며, 종료 후에는 무엇이 남았는지 기록하십시오. 이 세 단계를 지키면 ${ganji}년의 압력은 소모가 아니라 다음 흐름을 준비하는 경험으로 바뀝니다.`
        ]
      }
    ];

    const months = (Array.isArray(input.months) ? input.months : [])
      .slice(0, 12)
      .map((month, index) => monthGuidance(month || {}, index));

    return {
      year,
      ganji,
      eyebrow: 'ANNUAL COURSE / 선택 연도 상세 판독',
      title: `${year}년 ${ganji}년, ${input.name || '사용자'}님의 상세운`,
      deck: `${stemGod}의 ${stemGuide[0]}과 ${branchGod}의 ${branchGuide[0]}이 만나는 해입니다. ${overallLead} 아래 내용은 원국·대운·세운·월운을 함께 읽어 실제 선택에 쓸 수 있도록 풀어낸 안내입니다.`,
      evidence: [
        `일간 ${input.dayStem || ''} · ${input.dayElement || '오행'}`,
        `세운 ${ganji} · ${stemGod}/${branchGod}`,
        `대운 ${input.daeunGanji || ''} · ${input.daeunStemGod || '십신'}/${input.daeunBranchGod || '십신'}`,
        `조화 ${number(input.harmony, 0)} · 긴장 ${number(input.conflict, 0)}`
      ],
      sections,
      months,
      rules: [
        `가장 먼저 쓸 영역: ${strongLabel} ${strongScore}점의 자원을 구체적인 한 가지 결과로 연결하기`,
        `가장 먼저 지킬 영역: ${weakLabel} ${weakScore}점에 시간·돈·회복의 안전선 만들기`,
        `${stemGod}의 과제는 ${stemGuide[1]}`,
        `${branchGod}의 과제는 ${branchGuide[1]}`,
        '중요한 계약·투자·이직·치료 결정은 운세만으로 확정하지 않고 현실 자료와 전문가 의견을 함께 확인하기'
      ]
    };
  }

  global.SajuAnnualReading = Object.freeze({ build });
})(typeof globalThis !== 'undefined' ? globalThis : window);
