/*
 * Расчёт государственной пошлины в судах общей юрисдикции и Верховном Суде РФ
 * по ст. 333.19, 333.20, 333.36, 333.40 НК РФ (в ред. Федерального закона от 08.08.2024 № 259-ФЗ;
 * текст сверен по редакции НК РФ от 15.12.2025 с изм. от 15.01.2026).
 * Применяется к заявлениям и жалобам, поданным после 08.09.2024.
 */
(function (root) {
  'use strict';

  // ---------- Шкала для имущественных требований (пп. 1 п. 1 ст. 333.19) ----------
  const SCALE = [
    // [нижняя граница, фикс., процент с суммы, превышающей границу]
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
  const SCALE_MAX = 900_000;

  function propertyDuty(price) {
    price = Math.max(0, Number(price) || 0);
    for (const [from, fixed, pct] of SCALE) {
      if (price > from) return Math.min(SCALE_MAX, fixed + ((price - from) * pct) / 100);
    }
    return 4_000;
  }

  function describeScale(price) {
    const f = (n) => fmt(n);
    for (const [from, fixed, pct] of SCALE) {
      if (price > from) {
        const raw = fixed + ((price - from) * pct) / 100;
        const cap = raw > SCALE_MAX ? `, но не более ${f(SCALE_MAX)} ₽` : '';
        return `${f(fixed)} ₽ + ${String(pct).replace('.', ',')}% от суммы свыше ${f(from)} ₽${cap}`;
      }
    }
    return 'цена иска до 100 000 ₽ — 4 000 ₽';
  }

  // Округление до полного рубля: менее 50 копеек отбрасывается, 50 копеек и более — до рубля (п. 6 ст. 52 НК)
  function roundRub(x) { return Math.floor(x + 0.5 + 1e-9); }

  function fmt(n) {
    const s = (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
    const [int, dec] = s.split('.');
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (dec ? ',' + dec : '');
  }

  // ---------- Виды требований и заявлений ----------
  // kind: 'suitProperty' — входит в цену иска (суммируется по ст. 91 ГПК / ст. 104 КАС);
  //       'fixed' — твёрдая сумма; 'separate' — отдельное заявление со своей базой.
  const P = 'person', O = 'org';
  const TYPES = [
    // Исковые требования
    { id: 'property', group: 'Иски и административные иски', label: 'Имущественное требование, подлежащее оценке (взыскание денег, истребование имущества и т.п.)',
      ref: 'пп. 1 п. 1 ст. 333.19', kind: 'suitProperty', needsAmount: 'Цена иска, ₽' },
    { id: 'nonprop', group: 'Иски и административные иски', label: 'Неимущественное требование или имущественное, не подлежащее оценке (в т.ч. компенсация морального вреда)',
      ref: 'пп. 3 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 3000, [O]: 20000 } },
    { id: 'contract', group: 'Иски и административные иски', label: 'Спор о заключении, изменении или расторжении договора без требования о возврате исполненного; признание сделки недействительной без применения последствий',
      ref: 'пп. 4 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 3000, [O]: 20000 } },
    { id: 'invalidity', group: 'Иски и административные иски', label: 'Применение последствий недействительности сделки',
      ref: 'пп. 15 п. 1 ст. 333.20', kind: 'suitProperty', needsAmount: 'Стоимость имущества, подлежащего возврату, ₽' },
    { id: 'pledge', group: 'Иски и административные иски', label: 'Обращение взыскания на заложенное имущество',
      ref: 'пп. 16 п. 1 ст. 333.20', kind: 'suitProperty', needsAmount: 'Стоимость имущества, на которое обращается взыскание, ₽',
      option: { id: 'withDebt', label: 'Заявлено вместе с денежным требованием по солидарному обязательству, пошлина по которому уплачена (тогда — как за неимущественное)' } },
    { id: 'division', group: 'Иски и административные иски', label: 'Раздел общего имущества, выдел доли, признание права на долю, истребование наследниками доли',
      ref: 'пп. 3, 11 п. 1 ст. 333.20', kind: 'suitProperty', needsAmount: 'Стоимость имущества (доли), ₽',
      option: { id: 'rightDecided', label: 'Право собственности истца на это имущество уже признано судом ранее (тогда — как за неимущественное)' } },
    { id: 'divorce', group: 'Иски и административные иски', label: 'Расторжение брака',
      ref: 'пп. 5 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 5000, [O]: 5000 },
      hint: 'Если одновременно заявлен раздел имущества, добавьте его отдельным требованием (пп. 12 п. 1 ст. 333.20).' },
    { id: 'alimony', group: 'Иски и административные иски', label: 'Взыскание алиментов',
      ref: 'пп. 16 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 150, [O]: 150 },
      option: { id: 'double', label: 'Алименты и на детей, и на содержание истца (пошлина удваивается)' },
      hint: 'Истцы по искам о взыскании алиментов освобождены (пп. 2 п. 1 ст. 333.36). Пошлина взыскивается с ответчика при вынесении решения.' },

    // Административное судопроизводство
    { id: 'npa', group: 'Административные дела (КАС РФ)', label: 'Оспаривание нормативных правовых актов, актов с нормативными свойствами, ненормативных актов Президента, палат ФС, Правительства и др.',
      ref: 'пп. 6 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 4000, [O]: 20000 } },
    { id: 'actions', group: 'Административные дела (КАС РФ)', label: 'Признание ненормативного акта недействительным, решений и действий (бездействия) органов и должностных лиц незаконными',
      ref: 'пп. 7 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 3000, [O]: 15000 } },
    { id: 'reasonable', group: 'Административные дела (КАС РФ)', label: 'Компенсация за нарушение права на судопроизводство или исполнение судебного акта в разумный срок',
      ref: 'пп. 17 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 300, [O]: 6000 } },
    { id: 'detention', group: 'Административные дела (КАС РФ)', label: 'Компенсация за нарушение условий содержания под стражей, в исправительном учреждении',
      ref: 'пп. 18 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 300, [O]: 300 } },

    // Особые производства и заявления
    { id: 'prikaz', group: 'Приказное и особое производство', label: 'Заявление о вынесении судебного приказа',
      ref: 'пп. 2 п. 1 ст. 333.19', kind: 'separate', needsAmount: 'Сумма требования, ₽', prikaz: true },
    { id: 'special', group: 'Приказное и особое производство', label: 'Заявление по делам особого производства (установление юридических фактов и др.)',
      ref: 'пп. 8 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 3000, [O]: 3000 } },

    { id: 'succession', group: 'Заявления по делу и исполнению', label: 'Заявление о правопреемстве (кроме универсального)',
      ref: 'пп. 9 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 2000, [O]: 15000 } },
    { id: 'duplicate', group: 'Заявления по делу и исполнению', label: 'Выдача дубликата исполнительного листа; пересмотр заочного решения вынесшим его судом',
      ref: 'пп. 12 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 1500, [O]: 1500 } },
    { id: 'execution', group: 'Заявления по делу и исполнению', label: 'Восстановление срока предъявления исполнительного листа, отсрочка или рассрочка исполнения, изменение способа исполнения, поворот исполнения, разъяснение решения',
      ref: 'пп. 13 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 3000, [O]: 3000 } },
    { id: 'newcirc', group: 'Заявления по делу и исполнению', label: 'Пересмотр по новым или вновь открывшимся обстоятельствам',
      ref: 'пп. 14 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 10000, [O]: 10000 } },
    { id: 'security', group: 'Заявления по делу и исполнению', label: 'Обеспечение иска (в т.ч. рассматриваемого третейским судом), замена или отмена обеспечительной меры',
      ref: 'пп. 15 п. 1 ст. 333.19', kind: 'fixed', rates: { [P]: 10000, [O]: 10000 },
      hint: 'Кроме предварительных обеспечительных мер по защите авторских и смежных прав в интернете.' },

    { id: 'arbWrit', group: 'Третейские и иностранные решения', label: 'Выдача исполнительного листа на решение третейского суда; признание и исполнение решения иностранного суда или арбитража',
      ref: 'пп. 10 п. 1 ст. 333.19', kind: 'separate', needsAmount: 'Сумма, подтверждённая решением, ₽', share: 0.3 },
    { id: 'arbCancel', group: 'Третейские и иностранные решения', label: 'Отмена решения третейского суда',
      ref: 'пп. 11 п. 1 ст. 333.19', kind: 'separate', needsAmount: 'Оспариваемая сумма, ₽', share: 1 },
  ];

  // Жалобы (одинаковы для любых требований после 259-ФЗ)
  const APPEALS = {
    appeal: { label: 'Апелляционная или частная жалоба', ref: 'пп. 19 п. 1 ст. 333.19', rates: { [P]: 3000, [O]: 15000 } },
    cassation: { label: 'Кассационная жалоба в кассационный суд общей юрисдикции', ref: 'пп. 20 п. 1 ст. 333.19', rates: { [P]: 5000, [O]: 20000 } },
    cassPrikaz: { label: 'Кассационная жалоба на судебный приказ', ref: 'пп. 19 п. 1 ст. 333.19', rates: { [P]: 3000, [O]: 15000 } },
    supreme: { label: 'Кассационная или надзорная жалоба в Верховный Суд РФ', ref: 'пп. 21 п. 1 ст. 333.19', rates: { [P]: 7000, [O]: 25000 },
      note: 'Столько же — жалоба на определение судьи ВС РФ об отказе в передаче жалобы в судебное заседание.' },
  };

  // Льготы
  const BENEFITS = [
    { id: 'none', label: 'Нет льгот' },
    { id: 'full', label: 'Полное освобождение (п. 1 ст. 333.36): трудовые споры, возмещение вреда здоровью и вреда от преступления, защита прав ребёнка, неимущественные иски инвалидов, прокурор, госорганы и др.', ref: 'п. 1 ст. 333.36' },
    { id: 'capped', label: 'Освобождение при цене иска до 1 млн ₽ (п. 2, 3 ст. 333.36): защита прав потребителей, инвалиды I и II группы, дети-инвалиды, инвалиды с детства, ветераны, пенсионеры по искам к СФР и НПФ, общественные организации инвалидов', ref: 'пп. 2, 3 ст. 333.36' },
    { id: 'housing', label: 'Иск имущественного характера о защите права на единственное жильё (освобождение от 70% пошлины)', ref: 'пп. 23 п. 1 ст. 333.36' },
  ];

  // ---------- Расчёт ----------
  // input: { payer: 'person'|'org', claims: [{ type, amount, options: {} }], benefit, alreadyPaid }
  function calculate(input) {
    const payer = input.payer === O ? O : P;
    const lines = [];
    const warnings = [];
    let suitPrice = 0;
    const suitParts = [];
    let hasPrikaz = false;
    let hasSuit = false;

    for (const c of input.claims || []) {
      const t = TYPES.find((x) => x.id === c.type);
      if (!t) continue;
      const opts = c.options || {};
      const amount = Math.max(0, Number(c.amount) || 0);

      if (t.kind === 'suitProperty') {
        hasSuit = true;
        const asNonProp = (t.id === 'division' && opts.rightDecided) || (t.id === 'pledge' && opts.withDebt);
        if (asNonProp) {
          const rate = payer === O ? 20000 : 3000;
          lines.push({ type: t.id, label: t.label, ref: `${t.ref}; пп. 3 п. 1 ст. 333.19`, base: 'как за неимущественное требование', amount: rate, property: false });
        } else {
          suitPrice += amount;
          suitParts.push({ t, amount });
        }
        continue;
      }
      if (t.kind === 'fixed') {
        if (['property', 'nonprop', 'contract', 'npa', 'actions', 'reasonable', 'detention', 'divorce', 'alimony'].includes(t.id)) hasSuit = true;
        let rate = t.rates[payer];
        let base = payer === O ? 'для организаций' : 'для физических лиц';
        if (t.rates[P] === t.rates[O]) base = 'твёрдая сумма';
        if (t.id === 'alimony' && opts.double) { rate *= 2; base = 'удвоенный размер'; }
        lines.push({ type: t.id, label: t.label, ref: t.ref, base, amount: rate, property: false, hint: t.hint });
        continue;
      }
      if (t.kind === 'separate') {
        if (t.prikaz) {
          hasPrikaz = true;
          const full = propertyDuty(amount);
          lines.push({ type: t.id, label: t.label, ref: t.ref, base: `50% от ${fmt(roundRub(full))} ₽ (${describeScale(amount)})`, amount: full * 0.5, property: true, priceForBenefit: amount });
        } else {
          const full = propertyDuty(amount);
          const base = t.share === 1 ? describeScale(amount) : `30% от ${fmt(roundRub(full))} ₽ (${describeScale(amount)})`;
          lines.push({ type: t.id, label: t.label, ref: t.ref, base, amount: full * t.share, property: true, priceForBenefit: amount });
        }
      }
    }

    // Все имущественные требования одного иска складываются в цену иска (ст. 91 ГПК РФ, ст. 104 КАС РФ)
    if (suitParts.length) {
      const duty = propertyDuty(suitPrice);
      const label = suitParts.length === 1
        ? suitParts[0].t.label
        : 'Имущественные требования (цена иска по сумме требований)';
      lines.unshift({
        type: 'suitPrice', label, ref: [...new Set(['пп. 1 п. 1 ст. 333.19', ...suitParts.map((p) => p.t.ref)])].join('; '),
        base: `цена иска ${fmt(suitPrice)} ₽: ${describeScale(suitPrice)}`, amount: duty, property: true, priceForBenefit: suitPrice,
      });
    }

    if (hasPrikaz && hasSuit) warnings.push('Судебный приказ выдаётся по отдельному заявлению. Посчитайте его отдельно от искового заявления.');

    // Льготы
    const benefit = input.benefit || 'none';
    let benefitNote = null;
    for (const l of lines) {
      l.gross = l.amount;
      if (benefit === 'full') {
        l.amount = 0;
      } else if (benefit === 'capped') {
        // Льгота распространяется на исковые требования (п. 2, 3 ст. 333.36)
        if (l.type === 'suitPrice') {
          const price = l.priceForBenefit || 0;
          l.amount = price <= 1_000_000 ? 0 : Math.max(0, propertyDuty(price) - propertyDuty(1_000_000));
        } else if (['nonprop', 'contract', 'division', 'pledge', 'npa', 'actions', 'reasonable'].includes(l.type)) {
          l.amount = 0;
        }
      } else if (benefit === 'housing') {
        if (l.type === 'suitPrice') l.amount = l.amount * 0.3;
      }
      if (benefit === 'full' && l.type === 'alimony') l.amount = 0;
      l.amount = roundRub(l.amount);
      l.gross = roundRub(l.gross);
    }
    // Алименты: истец освобождён всегда
    for (const l of lines) if (l.type === 'alimony') { l.payable = 0; l.fromDefendant = l.gross; } else l.payable = l.amount;

    if (benefit === 'full') benefitNote = 'Истец освобождён от уплаты пошлины (п. 1 ст. 333.36). Если иск удовлетворят, пошлину взыщут с ответчика, если он не освобождён сам (пп. 8 п. 1 ст. 333.20).';
    if (benefit === 'capped') benefitNote = 'Льгота п. 2 ст. 333.36: при цене иска до 1 000 000 ₽ пошлина не уплачивается. Если цена выше, уплачивается разница между пошлиной по полной цене иска и пошлиной при цене 1 000 000 ₽ (25 000 ₽). По неимущественным требованиям льготник освобождён полностью.';
    if (benefit === 'housing') benefitNote = 'Льгота пп. 23 п. 1 ст. 333.36: истец освобождается от 70% пошлины по имущественным требованиям о защите прав на единственное пригодное для проживания жильё. Уплачивается 30%.';

    const firstGross = lines.reduce((s, l) => s + l.gross, 0);
    let first = lines.reduce((s, l) => s + l.payable, 0);
    const alreadyPaid = Math.max(0, Number(input.alreadyPaid) || 0);
    const toPay = Math.max(0, first - alreadyPaid);
    const refund = Math.max(0, alreadyPaid - first);

    // Жалобы
    const appeals = [];
    if (hasPrikaz && !hasSuit) {
      appeals.push({ stage: 'appeal', label: 'Апелляция', na: 'Судебный приказ в апелляционном порядке не обжалуется' });
      appeals.push({ stage: 'cassation', label: 'Кассация (кассационный суд общей юрисдикции)', ...APPEALS.cassPrikaz });
    } else {
      appeals.push({ stage: 'appeal', label: 'Апелляция, частная жалоба', ...APPEALS.appeal });
      appeals.push({ stage: 'cassation', label: 'Кассация (кассационный суд общей юрисдикции)', ...APPEALS.cassation });
    }
    appeals.push({ stage: 'supreme', label: 'Верховный Суд РФ (кассация, надзор)', ...APPEALS.supreme });

    // Возврат при мировом соглашении, отказе от иска, признании иска (пп. 3 п. 1 ст. 333.40)
    const refundBase = first;
    const settlement = refundBase > 0 ? [
      { stage: 'До решения суда первой инстанции', pct: 70, amount: roundRub(refundBase * 0.7) },
      { stage: 'В суде апелляционной инстанции', pct: 50, amount: roundRub(refundBase * 0.5) },
      { stage: 'В кассации или надзоре', pct: 30, amount: roundRub(refundBase * 0.3) },
    ] : [];

    return { payer, lines, first, firstGross, alreadyPaid, toPay, refund, appeals, settlement, benefitNote, warnings, suitPrice };
  }

  const api = { TYPES, APPEALS, BENEFITS, propertyDuty, calculate, roundRub, fmt, describeScale, SCALE_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Duty = api;
})(typeof window !== 'undefined' ? window : globalThis);
