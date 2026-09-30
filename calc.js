/*
 * Расчёт государственной пошлины:
 *  - суды общей юрисдикции, мировые судьи, ВС РФ по ГПК/КАС — ст. 333.19, 333.20, 333.36 НК РФ;
 *  - арбитражные суды, ВС РФ по АПК — ст. 333.21, 333.22, 333.37 НК РФ;
 *  - возврат — ст. 333.40 НК РФ.
 * Редакция 259-ФЗ от 08.08.2024 (текст сверен по НК РФ в ред. от 15.12.2025 с изм. от 15.01.2026).
 * Применяется к заявлениям и жалобам, поданным после 08.09.2024.
 *
 * Чтобы обновить суммы при изменении закона, правьте блоки COURTS.soyu и COURTS.arb ниже.
 */
(function (root) {
  'use strict';

  const P = 'person', O = 'org';

  // ---------- Общие функции ----------
  function makeScale(steps, min, max) {
    // steps: [нижняя граница, фиксированная часть, процент с суммы свыше границы], по убыванию
    return function (price) {
      price = Math.max(0, Number(price) || 0);
      for (const [from, fixed, pct] of steps) {
        if (price > from) return Math.min(max, fixed + ((price - from) * pct) / 100);
      }
      return min;
    };
  }
  function makeScaleText(steps, min, max) {
    return function (price) {
      for (const [from, fixed, pct] of steps) {
        if (price > from) {
          const raw = fixed + ((price - from) * pct) / 100;
          const cap = raw > max ? `, но не более ${fmt(max)} ₽` : '';
          return `${fmt(fixed)} ₽ + ${String(pct).replace('.', ',')}% от суммы свыше ${fmt(from)} ₽${cap}`;
        }
      }
      return `цена иска до 100 000 ₽ — ${fmt(min)} ₽`;
    };
  }
  // Округление до полного рубля: менее 50 копеек отбрасывается, 50 копеек и более — до рубля (п. 6 ст. 52 НК)
  function roundRub(x) { return Math.floor(x + 0.5 + 1e-9); }
  function fmt(n) {
    const s = (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
    const [int, dec] = s.split('.');
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? ',' + dec : '');
  }

  // ============================================================
  // Суды общей юрисдикции (ст. 333.19, 333.20, 333.36)
  // ============================================================
  const SOYU_STEPS = [
    [100_000_000, 314_000, 0.15],
    [50_000_000, 214_000, 0.2],
    [24_000_000, 136_000, 0.3],
    [8_000_000, 80_000, 0.35],
    [3_000_000, 45_000, 0.7],
    [1_000_000, 25_000, 1],
    [500_000, 15_000, 2],
    [300_000, 10_000, 2.5],
    [100_000, 4_000, 3],
  ];
  const A19 = 'ст. 333.19', A20 = 'ст. 333.20';
  const soyu = {
    id: 'soyu',
    title: 'Суды общей юрисдикции',
    short: 'СОЮ',
    lawShort: 'ст. 333.19 НК РФ',
    firstInstance: 'районный суд, мировой судья, областной суд',
    scale: makeScale(SOYU_STEPS, 4_000, 900_000),
    scaleText: makeScaleText(SOYU_STEPS, 4_000, 900_000),
    nonprop: { [P]: 3000, [O]: 20000 },
    nonpropRef: `пп. 3 п. 1 ${A19}`,
    prikazMin: 0,
    types: [
      { id: 'property', group: 'Иски и административные иски', label: 'Имущественное требование, подлежащее оценке (взыскание денег, истребование имущества и т.п.)',
        ref: `пп. 1 п. 1 ${A19}`, kind: 'suitProperty', needsAmount: 'Цена иска, ₽' },
      { id: 'nonprop', group: 'Иски и административные иски', label: 'Неимущественное требование или имущественное, не подлежащее оценке (в т.ч. компенсация морального вреда)',
        ref: `пп. 3 п. 1 ${A19}`, kind: 'fixed', suit: true, rates: { [P]: 3000, [O]: 20000 } },
      { id: 'contract', group: 'Иски и административные иски', label: 'Спор о заключении, изменении или расторжении договора без требования о возврате исполненного; признание сделки недействительной без применения последствий',
        ref: `пп. 4 п. 1 ${A19}`, kind: 'fixed', suit: true, rates: { [P]: 3000, [O]: 20000 } },
      { id: 'invalidity', group: 'Иски и административные иски', label: 'Применение последствий недействительности сделки',
        ref: `пп. 15 п. 1 ${A20}`, kind: 'suitProperty', needsAmount: 'Стоимость имущества, подлежащего возврату, ₽' },
      { id: 'pledge', group: 'Иски и административные иски', label: 'Обращение взыскания на заложенное имущество',
        ref: `пп. 16 п. 1 ${A20}`, kind: 'suitProperty', needsAmount: 'Стоимость имущества, на которое обращается взыскание, ₽',
        option: { id: 'asNonProp', label: 'Заявлено вместе с денежным требованием по солидарному обязательству, пошлина по которому уплачена (тогда — как за неимущественное)' } },
      { id: 'division', group: 'Иски и административные иски', label: 'Раздел общего имущества, выдел доли, признание права на долю, истребование наследниками доли',
        ref: `пп. 3, 11 п. 1 ${A20}`, kind: 'suitProperty', needsAmount: 'Стоимость имущества (доли), ₽',
        option: { id: 'asNonProp', label: 'Право собственности истца на это имущество уже признано судом ранее (тогда — как за неимущественное)' } },
      { id: 'divorce', group: 'Иски и административные иски', label: 'Расторжение брака',
        ref: `пп. 5 п. 1 ${A19}`, kind: 'fixed', suit: true, rates: { [P]: 5000, [O]: 5000 },
        hint: 'Если одновременно заявлен раздел имущества, добавьте его отдельным требованием (пп. 12 п. 1 ст. 333.20).' },
      { id: 'alimony', group: 'Иски и административные иски', label: 'Взыскание алиментов',
        ref: `пп. 16 п. 1 ${A19}`, kind: 'fixed', suit: true, rates: { [P]: 150, [O]: 150 },
        option: { id: 'double', label: 'Алименты и на детей, и на содержание истца (пошлина удваивается)' },
        hint: 'Истцы по искам о взыскании алиментов освобождены (пп. 2 п. 1 ст. 333.36). Пошлина взыскивается с ответчика при вынесении решения.' },

      { id: 'npa', group: 'Административные дела (КАС РФ)', label: 'Оспаривание нормативных правовых актов, актов с нормативными свойствами, ненормативных актов Президента, палат ФС, Правительства и др.',
        ref: `пп. 6 п. 1 ${A19}`, kind: 'fixed', suit: true, rates: { [P]: 4000, [O]: 20000 } },
      { id: 'actions', group: 'Административные дела (КАС РФ)', label: 'Признание ненормативного акта недействительным, решений и действий (бездействия) органов и должностных лиц незаконными',
        ref: `пп. 7 п. 1 ${A19}`, kind: 'fixed', suit: true, rates: { [P]: 3000, [O]: 15000 } },
      { id: 'reasonable', group: 'Административные дела (КАС РФ)', label: 'Компенсация за нарушение права на судопроизводство или исполнение судебного акта в разумный срок',
        ref: `пп. 17 п. 1 ${A19}`, kind: 'fixed', suit: true, rates: { [P]: 300, [O]: 6000 } },
      { id: 'detention', group: 'Административные дела (КАС РФ)', label: 'Компенсация за нарушение условий содержания под стражей, в исправительном учреждении',
        ref: `пп. 18 п. 1 ${A19}`, kind: 'fixed', suit: true, rates: { [P]: 300, [O]: 300 } },

      { id: 'prikaz', group: 'Приказное и особое производство', label: 'Заявление о вынесении судебного приказа',
        ref: `пп. 2 п. 1 ${A19}`, kind: 'prikaz', needsAmount: 'Сумма требования, ₽' },
      { id: 'special', group: 'Приказное и особое производство', label: 'Заявление по делам особого производства (установление юридических фактов и др.)',
        ref: `пп. 8 п. 1 ${A19}`, kind: 'fixed', rates: { [P]: 3000, [O]: 3000 } },

      { id: 'succession', group: 'Заявления по делу и исполнению', label: 'Заявление о правопреемстве (кроме универсального)',
        ref: `пп. 9 п. 1 ${A19}`, kind: 'fixed', rates: { [P]: 2000, [O]: 15000 } },
      { id: 'duplicate', group: 'Заявления по делу и исполнению', label: 'Выдача дубликата исполнительного листа; пересмотр заочного решения вынесшим его судом',
        ref: `пп. 12 п. 1 ${A19}`, kind: 'fixed', rates: { [P]: 1500, [O]: 1500 } },
      { id: 'execution', group: 'Заявления по делу и исполнению', label: 'Восстановление срока предъявления исполнительного листа, отсрочка или рассрочка исполнения, изменение способа исполнения, поворот исполнения, разъяснение решения',
        ref: `пп. 13 п. 1 ${A19}`, kind: 'fixed', rates: { [P]: 3000, [O]: 3000 } },
      { id: 'newcirc', group: 'Заявления по делу и исполнению', label: 'Пересмотр по новым или вновь открывшимся обстоятельствам',
        ref: `пп. 14 п. 1 ${A19}`, kind: 'fixed', rates: { [P]: 10000, [O]: 10000 } },
      { id: 'security', group: 'Заявления по делу и исполнению', label: 'Обеспечение иска (в т.ч. рассматриваемого третейским судом), замена или отмена обеспечительной меры',
        ref: `пп. 15 п. 1 ${A19}`, kind: 'fixed', rates: { [P]: 10000, [O]: 10000 },
        hint: 'Кроме предварительных обеспечительных мер по защите авторских и смежных прав в интернете.' },

      { id: 'arbWrit', group: 'Третейские и иностранные решения', label: 'Выдача исполнительного листа на решение третейского суда; признание и исполнение решения иностранного суда или арбитража',
        ref: `пп. 10 п. 1 ${A19}`, kind: 'share', share: 0.3, needsAmount: 'Сумма, подтверждённая решением, ₽' },
      { id: 'arbCancel', group: 'Третейские и иностранные решения', label: 'Отмена решения третейского суда',
        ref: `пп. 11 п. 1 ${A19}`, kind: 'share', share: 1, needsAmount: 'Оспариваемая сумма, ₽' },
    ],
    appeals: {
      appeal: { label: 'Апелляция, частная жалоба', ref: `пп. 19 п. 1 ${A19}`, rates: { [P]: 3000, [O]: 15000 } },
      cassation: { label: 'Кассация (кассационный суд общей юрисдикции)', ref: `пп. 20 п. 1 ${A19}`, rates: { [P]: 5000, [O]: 20000 } },
      cassPrikaz: { label: 'Кассация на судебный приказ (кассационный суд общей юрисдикции)', ref: `пп. 19 п. 1 ${A19}`, rates: { [P]: 3000, [O]: 15000 } },
      supreme: { label: 'Верховный Суд РФ (кассация, надзор)', ref: `пп. 21 п. 1 ${A19}`, rates: { [P]: 7000, [O]: 25000 } },
    },
    benefits: [
      { id: 'none', label: 'Нет льгот' },
      { id: 'full', label: 'Полное освобождение (п. 1 ст. 333.36): трудовые споры, возмещение вреда здоровью и вреда от преступления, защита прав ребёнка, неимущественные иски инвалидов, прокурор, госорганы и др.' },
      { id: 'capped', label: 'Освобождение при цене иска до 1 млн ₽ (п. 2, 3 ст. 333.36): защита прав потребителей, инвалиды I и II группы, дети-инвалиды, инвалиды с детства, ветераны, пенсионеры по искам к СФР и НПФ, общественные организации инвалидов' },
      { id: 'housing', label: 'Иск имущественного характера о защите права на единственное жильё (освобождение от 70% пошлины)' },
    ],
    benefitNotes: {
      full: 'Истец освобождён от уплаты пошлины (п. 1 ст. 333.36). Если иск удовлетворят, пошлину взыщут с ответчика, если он не освобождён сам (пп. 8 п. 1 ст. 333.20).',
      capped: 'Льгота п. 2 ст. 333.36: при цене иска до 1 000 000 ₽ пошлина не уплачивается. Если цена выше, уплачивается разница между пошлиной по полной цене иска и пошлиной при цене 1 000 000 ₽. По неимущественным исковым требованиям льготник освобождён полностью.',
      housing: 'Льгота пп. 23 п. 1 ст. 333.36: истец освобождается от 70% пошлины по имущественным требованиям о защите прав на единственное пригодное для проживания жильё. Уплачивается 30%.',
    },
    appealNote: 'Соучастники и третьи лица на стороне заявителя кассационной жалобы пошлину не платят (пп. 7 п. 1 ст. 333.20).',
  };

  // ============================================================
  // Арбитражные суды (ст. 333.21, 333.22, 333.37)
  // ============================================================
  const ARB_STEPS = [
    [50_000_000, 725_000, 0.5],
    [10_000_000, 325_000, 1],
    [1_000_000, 55_000, 3],
    [100_000, 10_000, 5],
  ];
  const A21 = 'ст. 333.21', A22 = 'ст. 333.22';
  const arb = {
    id: 'arb',
    title: 'Арбитражные суды',
    short: 'АС',
    lawShort: 'ст. 333.21 НК РФ',
    firstInstance: 'арбитражный суд субъекта РФ, Суд по интеллектуальным правам',
    scale: makeScale(ARB_STEPS, 10_000, 10_000_000),
    scaleText: makeScaleText(ARB_STEPS, 10_000, 10_000_000),
    nonprop: { [P]: 15000, [O]: 50000 },
    nonpropRef: `пп. 4 п. 1 ${A21}`,
    prikazMin: 8000,
    types: [
      { id: 'property', group: 'Иски и заявления', label: 'Имущественное требование, подлежащее оценке (взыскание долга, неустойки, процентов, убытков и т.п.)',
        ref: `пп. 1 п. 1 ${A21}`, kind: 'suitProperty', needsAmount: 'Цена иска, ₽',
        hint: 'В цену иска включаются заявленные неустойка (штрафы, пени) и проценты (пп. 2 п. 1 ст. 333.22).' },
      { id: 'nonprop', group: 'Иски и заявления', label: 'Неимущественное требование или имущественное, не подлежащее оценке',
        ref: `пп. 4 п. 1 ${A21}`, kind: 'fixed', suit: true, rates: { [P]: 15000, [O]: 50000 } },
      { id: 'contract', group: 'Иски и заявления', label: 'Спор о заключении, изменении или расторжении договора без требования о возврате исполненного; признание сделки недействительной без применения последствий',
        ref: `пп. 2 п. 1 ${A21}`, kind: 'fixed', suit: true, rates: { [P]: 15000, [O]: 50000 } },
      { id: 'invalidity', group: 'Иски и заявления', label: 'Применение последствий недействительности сделки',
        ref: `пп. 8 п. 1 ${A22}`, kind: 'suitProperty', needsAmount: 'Стоимость имущества, подлежащего возврату, ₽' },
      { id: 'pledge', group: 'Иски и заявления', label: 'Обращение взыскания на заложенное имущество',
        ref: `пп. 9 п. 1 ${A22}`, kind: 'suitProperty', needsAmount: 'Стоимость имущества, на которое обращается взыскание, ₽',
        option: { id: 'asNonProp', label: 'Заявлено вместе с денежным требованием по солидарному обязательству, пошлина по которому уплачена (тогда — как за неимущественное)' } },
      { id: 'budget', group: 'Иски и заявления', label: 'Возврат (возмещение) денежных средств из бюджета',
        ref: `пп. 5 п. 1 ${A22}`, kind: 'suitProperty', needsAmount: 'Оспариваемая сумма, ₽' },
      { id: 'thirdParty', group: 'Иски и заявления', label: 'Вступление в дело третьего лица с самостоятельными требованиями',
        ref: `пп. 11 п. 1 ${A21}`, kind: 'suitProperty', needsAmount: 'Оспариваемая третьим лицом сумма, ₽',
        option: { id: 'asNonProp', label: 'Спор неимущественный или иск не подлежит оценке (тогда — как за неимущественное)' } },

      { id: 'ipNpa', group: 'Административные и публичные споры', label: 'Оспаривание нормативных актов ФОИВ в сфере интеллектуальной собственности (патенты, товарные знаки, ноу-хау и др.), в т.ч. актов с нормативными свойствами',
        ref: `пп. 5, 6 п. 1 ${A21}`, kind: 'fixed', suit: true, rates: { [P]: 10000, [O]: 60000 } },
      { id: 'actions', group: 'Административные и публичные споры', label: 'Признание ненормативного акта недействительным, решений и действий (бездействия) органов и должностных лиц незаконными',
        ref: `пп. 7 п. 1 ${A21}`, kind: 'fixed', suit: true, rates: { [P]: 10000, [O]: 50000 } },
      { id: 'reasonable', group: 'Административные и публичные споры', label: 'Компенсация за нарушение права на судопроизводство или исполнение судебного акта в разумный срок',
        ref: `пп. 18 п. 1 ${A21}`, kind: 'fixed', suit: true, rates: { [P]: 300, [O]: 6000 } },

      { id: 'bankruptcy', group: 'Банкротство', label: 'Заявление о признании должника банкротом',
        ref: `пп. 8 п. 1 ${A21}`, kind: 'fixed', rates: { [P]: 10000, [O]: 100000 },
        option: { id: 'selfDebtor', label: 'Заявление подаёт сам должник (пошлина не взимается)' } },
      { id: 'bankruptcyDispute', group: 'Банкротство', label: 'Обособленный спор, заявление или требование в деле о банкротстве (50% пошлины по существу требования)',
        ref: `пп. 9 п. 1 ${A21}`, kind: 'half', needsAmount: 'Сумма требования, ₽ (для имущественного)',
        option: { id: 'asNonProp', label: 'Требование неимущественное (50% от пошлины за неимущественное)' } },

      { id: 'prikaz', group: 'Приказное производство и установление фактов', label: 'Заявление о выдаче судебного приказа',
        ref: `пп. 3 п. 1 ${A21}`, kind: 'prikaz', needsAmount: 'Сумма требования, ₽' },
      { id: 'facts', group: 'Приказное производство и установление фактов', label: 'Установление фактов, имеющих юридическое значение',
        ref: `пп. 10 п. 1 ${A21}`, kind: 'fixed', rates: { [P]: 30000, [O]: 30000 } },

      { id: 'succession', group: 'Заявления по делу и исполнению', label: 'Заявление о правопреемстве (кроме универсального)',
        ref: `пп. 12 п. 1 ${A21}`, kind: 'fixed', rates: { [P]: 5000, [O]: 25000 } },
      { id: 'execution', group: 'Заявления по делу и исполнению', label: 'Дубликат исполнительного листа, восстановление срока его предъявления, отсрочка или рассрочка, изменение способа исполнения, поворот исполнения, разъяснение судебного акта',
        ref: `пп. 15 п. 1 ${A21}`, kind: 'fixed', rates: { [P]: 10000, [O]: 10000 } },
      { id: 'newcirc', group: 'Заявления по делу и исполнению', label: 'Пересмотр по новым или вновь открывшимся обстоятельствам',
        ref: `пп. 16 п. 1 ${A21}`, kind: 'fixed', rates: { [P]: 30000, [O]: 30000 } },
      { id: 'security', group: 'Заявления по делу и исполнению', label: 'Обеспечение иска (в т.ч. рассматриваемого третейским судом), замена или отмена обеспечительной меры',
        ref: `пп. 17 п. 1 ${A21}`, kind: 'fixed', rates: { [P]: 30000, [O]: 30000 } },

      { id: 'arbWrit', group: 'Третейские и иностранные решения', label: 'Выдача исполнительного листа на решение третейского суда; признание и приведение в исполнение решения иностранного суда или арбитража',
        ref: `пп. 13 п. 1 ${A21}`, kind: 'share', share: 0.3, needsAmount: 'Сумма, подтверждённая решением, ₽' },
      { id: 'arbCancel', group: 'Третейские и иностранные решения', label: 'Отмена решения третейского суда',
        ref: `пп. 14 п. 1 ${A21}`, kind: 'share', share: 1, needsAmount: 'Оспариваемая сумма, ₽' },
    ],
    appeals: {
      appeal: { label: 'Апелляция (арбитражный апелляционный суд)', ref: `пп. 19 п. 1 ${A21}`, rates: { [P]: 10000, [O]: 30000 } },
      cassation: { label: 'Кассация (арбитражный суд округа)', ref: `пп. 20 п. 1 ${A21}`, rates: { [P]: 20000, [O]: 50000 } },
      cassPrikaz: { label: 'Кассация на судебный приказ (арбитражный суд округа)', ref: `пп. 19 п. 1 ${A21}`, rates: { [P]: 10000, [O]: 30000 } },
      supreme: { label: 'Верховный Суд РФ (кассация, надзор)', ref: `пп. 21 п. 1 ${A21}`, rates: { [P]: 30000, [O]: 80000 } },
    },
    benefits: [
      { id: 'none', label: 'Нет льгот' },
      { id: 'full', label: 'Полное освобождение (п. 1 ст. 333.37): прокуроры и органы в защиту публичных интересов, госорганы и органы МСУ, защита прав ребёнка, принудительная лицензия, гражданин-банкрот по обособленным спорам, кредитор с подтверждённым судом требованием о включении в реестр' },
      { id: 'capped', label: 'Освобождение при цене иска до 1 млн ₽ (п. 2, 3 ст. 333.37): истцы — инвалиды I и II группы, общественные организации инвалидов' },
    ],
    benefitNotes: {
      full: 'Заявитель освобождён от уплаты пошлины (п. 1 ст. 333.37). Если иск удовлетворят, пошлину взыщут с ответчика пропорционально удовлетворённым требованиям, если он не освобождён сам (пп. 4 п. 1 ст. 333.22).',
      capped: 'Льгота п. 2 ст. 333.37: при цене иска до 1 000 000 ₽ пошлина не уплачивается. Если цена выше, уплачивается разница между пошлиной по полной цене иска и пошлиной при цене 1 000 000 ₽ (55 000 ₽). По неимущественным исковым требованиям льготник освобождён полностью.',
    },
    appealNote: '',
  };

  const COURTS = { soyu, arb };

  // ---------- Расчёт ----------
  // input: { court: 'soyu'|'arb', payer: 'person'|'org', claims: [{ type, amount, options }], benefit, alreadyPaid }
  function calculate(input) {
    const C = COURTS[input.court] || soyu;
    const payer = input.payer === O ? O : P;
    const lines = [];
    const warnings = [];
    const suitParts = [];
    let suitPrice = 0;
    let hasPrikaz = false;
    let hasSuit = false;
    const nonpropLine = (t, extraRef) => ({
      type: t.id, label: t.label, ref: `${t.ref}; ${C.nonpropRef}`, base: 'как за неимущественное требование', amount: C.nonprop[payer], suit: true,
    });

    for (const c of input.claims || []) {
      const t = C.types.find((x) => x.id === c.type);
      if (!t) continue;
      const opts = c.options || {};
      const amount = Math.max(0, Number(c.amount) || 0);

      switch (t.kind) {
        case 'suitProperty': {
          hasSuit = true;
          if (t.option && t.option.id === 'asNonProp' && opts.asNonProp) lines.push(nonpropLine(t));
          else { suitPrice += amount; suitParts.push(t); }
          break;
        }
        case 'fixed': {
          if (t.suit) hasSuit = true;
          let rate = t.rates[payer];
          let base = t.rates[P] === t.rates[O] ? 'твёрдая сумма' : payer === O ? 'для организаций' : 'для физических лиц';
          if (t.id === 'alimony' && opts.double) { rate *= 2; base = 'удвоенный размер'; }
          if (t.id === 'bankruptcy' && opts.selfDebtor) { rate = 0; base = 'заявление должника — пошлина не взимается'; }
          lines.push({ type: t.id, label: t.label, ref: t.ref, base, amount: rate, suit: !!t.suit });
          break;
        }
        case 'prikaz': {
          hasPrikaz = true;
          const full = C.scale(amount);
          let duty = full * 0.5;
          let base = `50% от ${fmt(roundRub(full))} ₽ (${C.scaleText(amount)})`;
          if (C.prikazMin && duty < C.prikazMin) { duty = C.prikazMin; base += `, но не менее ${fmt(C.prikazMin)} ₽`; }
          lines.push({ type: t.id, label: t.label, ref: t.ref, base, amount: duty, priceForBenefit: amount });
          break;
        }
        case 'share': {
          const full = C.scale(amount);
          const base = t.share === 1 ? C.scaleText(amount) : `30% от ${fmt(roundRub(full))} ₽ (${C.scaleText(amount)})`;
          lines.push({ type: t.id, label: t.label, ref: t.ref, base, amount: full * t.share, priceForBenefit: amount });
          break;
        }
        case 'half': {
          if (opts.asNonProp) {
            lines.push({ type: t.id, label: t.label, ref: `${t.ref}; ${C.nonpropRef}`, base: `50% от ${fmt(C.nonprop[payer])} ₽ за неимущественное требование`, amount: C.nonprop[payer] * 0.5 });
          } else {
            const full = C.scale(amount);
            lines.push({ type: t.id, label: t.label, ref: `${t.ref}; пп. 1 п. 1 ${A21}`, base: `50% от ${fmt(roundRub(full))} ₽ (${C.scaleText(amount)})`, amount: full * 0.5 });
          }
          break;
        }
      }
    }

    // Имущественные требования одного иска складываются в цену иска (ст. 91 ГПК, ст. 104 КАС, ст. 103 АПК)
    if (suitParts.length) {
      const refs = [...new Set([`пп. 1 п. 1 ${C.id === 'arb' ? A21 : A19}`, ...suitParts.map((t) => t.ref)])].join('; ');
      lines.unshift({
        type: 'suitPrice',
        label: suitParts.length === 1 ? suitParts[0].label : 'Имущественные требования (цена иска по сумме требований)',
        ref: refs, base: `цена иска ${fmt(suitPrice)} ₽: ${C.scaleText(suitPrice)}`,
        amount: C.scale(suitPrice), priceForBenefit: suitPrice, suit: true,
      });
    }
    if (hasPrikaz && hasSuit) warnings.push('Судебный приказ выдаётся по отдельному заявлению. Посчитайте его отдельно от искового заявления.');

    // Льготы
    const benefit = C.benefits.some((b) => b.id === input.benefit) ? input.benefit : 'none';
    for (const l of lines) {
      l.gross = l.amount;
      if (benefit === 'full') l.amount = 0;
      else if (benefit === 'capped') {
        if (l.type === 'suitPrice') {
          const price = l.priceForBenefit || 0;
          l.amount = price <= 1_000_000 ? 0 : Math.max(0, C.scale(price) - C.scale(1_000_000));
        } else if (l.suit && l.type !== 'alimony' && l.type !== 'divorce' && l.type !== 'detention') {
          l.amount = 0;
        }
      } else if (benefit === 'housing' && l.type === 'suitPrice') {
        l.amount = l.amount * 0.3;
      }
      l.amount = roundRub(l.amount);
      l.gross = roundRub(l.gross);
      if (l.type === 'alimony') { l.fromDefendant = l.gross; l.payable = 0; } else l.payable = l.amount;
    }

    const first = lines.reduce((s, l) => s + l.payable, 0);
    const firstGross = lines.reduce((s, l) => s + l.gross, 0);
    const alreadyPaid = Math.max(0, Number(input.alreadyPaid) || 0);
    const toPay = Math.max(0, first - alreadyPaid);
    const refund = Math.max(0, alreadyPaid - first);

    const appeals = [];
    if (hasPrikaz && !hasSuit) {
      appeals.push({ stage: 'appeal', label: 'Апелляция', na: 'Судебный приказ в апелляционном порядке не обжалуется' });
      appeals.push({ stage: 'cassation', ...C.appeals.cassPrikaz });
    } else {
      appeals.push({ stage: 'appeal', ...C.appeals.appeal });
      appeals.push({ stage: 'cassation', ...C.appeals.cassation });
    }
    appeals.push({ stage: 'supreme', ...C.appeals.supreme });

    // Возврат при мировом соглашении, отказе от иска, признании иска (пп. 3 п. 1 ст. 333.40)
    const settlement = first > 0 ? [
      { stage: 'До решения суда первой инстанции', pct: 70, amount: roundRub(first * 0.7) },
      { stage: 'В суде апелляционной инстанции', pct: 50, amount: roundRub(first * 0.5) },
      { stage: 'В кассации или надзоре', pct: 30, amount: roundRub(first * 0.3) },
    ] : [];

    return {
      court: C.id, courtTitle: C.title, lawShort: C.lawShort, firstInstance: C.firstInstance, appealNote: C.appealNote,
      payer, lines, first, firstGross, alreadyPaid, toPay, refund, appeals, settlement,
      benefitNote: C.benefitNotes[benefit] || null, warnings, suitPrice,
    };
  }

  const api = {
    COURTS, calculate, roundRub, fmt,
    // совместимость со старой версией
    TYPES: soyu.types, BENEFITS: soyu.benefits, propertyDuty: soyu.scale,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Duty = api;
})(typeof window !== 'undefined' ? window : globalThis);
