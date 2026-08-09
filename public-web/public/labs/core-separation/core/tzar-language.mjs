import { compileTzarLanguage } from "../../tzar-language-001.mjs";

export const TARGET_RELATION = "Сохранить источник действия в Ядре при влиянии значимого Другого";

const clean = (value, fallback = "") => String(value ?? "").trim().replace(/\s+/gu, " ").replace(/[.!?…]+$/u, "") || fallback;

function reflectedImage(interception) {
  return `узел ${interception.lawId} «${interception.law}»: ${interception.stateName}`;
}

function returnSentence(q, observation) {
  if (q == null) return "Фактический возврат ещё не наблюдался; Q остаётся null.";
  const action = q === 1 ? "действие сохранилось после реакции" : "действие было отменено или перехвачено реакцией";
  const form = clean(observation?.newForm);
  return `Возврат наблюдён: ${action}; Q=${q}.${form ? ` Новая форма — «${form}».` : ""}`;
}

function profileBias(action) {
  const text = clean(action).toLocaleLowerCase("ru");
  if (/сообщ|сказ|назов|назва|спрос|формулир/u.test(text)) return { azBias: { A19: 2 }, txBias: { TX4: 2, TX3: 1 } };
  if (/созда|собер|сдела|выпуст|предъяв|заверш/u.test(text)) return { azBias: { A6: 2 }, bukaBias: { B11: 1 }, txBias: { TX5: 2 } };
  if (/встро|интегр|закреп|обнов/u.test(text)) return { azBias: { A15: 2 }, bukaBias: { B24: 1 }, txBias: { TX6: 2 } };
  if (/отпуст|занов|перезап|новый цикл/u.test(text)) return { azBias: { A45: 2 }, txBias: { TX7: 2 } };
  return {};
}

export function compileSeparationLanguage({
  context,
  episode,
  interception,
  action,
  criterion,
  q = null,
  returnObservation = null,
  subjectConfirmed = false,
}) {
  if (!context?.id || !interception?.lawId) throw new Error("SEP_LANGUAGE_COORDINATES_INCOMPLETE");
  const object = clean(episode, "непредъявленный эпизод");
  const subjectTrace = clean(action, "непредъявленный субъектный шаг");
  const criterionText = clean(criterion, "наблюдаемый критерий ещё не предъявлен");
  const image = reflectedImage(interception);
  const bias = profileBias(subjectTrace);
  const generic = compileTzarLanguage({
    object,
    subjectTrace,
    innerImage: image,
    position: "субъект собственного действия",
    euclid: context.name,
    lobachevsky: interception.law,
    riemann: criterionText,
    projective: `${interception.stateName}; ${interception.stateDescription || "рабочая гипотеза эпизода"}`,
    supra: TARGET_RELATION,
    innerLevel: "источник действия в Ядре",
    outerDomain: context.name,
    coreNeed: "провести собственный выбор в действие, сохранив связь без сдачи Ядра",
    nextExperiment: subjectTrace,
    observedQ: q,
  }, {
    profile: "SEP-7x7",
    voice: "subject",
    targetRelation: TARGET_RELATION,
    context: `SEP-7×7 · ${context.name}`,
    subjectConfirmed,
    azTexts: [[subjectTrace, 5], [TARGET_RELATION, 4], [interception.law, 2], [interception.stateName, 1]],
    bukaTexts: [[criterionText, 5], [subjectTrace, 3], [interception.stateName, 2], [context.name, 1]],
    txTexts: [[subjectTrace, 6], [criterionText, 3], [interception.law, 2]],
    ...bias,
  });
  const publicStatement = [
    `В контуре «${context.name}» я различаю эпизод: «${object}».`,
    `Карта отражает ${image} — как рабочую гипотезу этого эпизода, а не оценку моей личности.`,
    `Мой субъектный след S — «${subjectTrace}».`,
    `Отношение R_g — «${TARGET_RELATION}».`,
    `Критерий проверки — «${criterionText}».`,
    returnSentence(q, returnObservation),
  ].join(" ");
  return {
    ...generic,
    contour: "SEP-7x7",
    coordinates: {
      O: object,
      S: subjectTrace,
      I: image,
      R_g: TARGET_RELATION,
      C: { id: context.id, name: context.name },
      Q: q,
    },
    layers: {
      ...generic.layers,
      publicStatement,
      feedbackCriterion: criterionText,
    },
    boundary: {
      ...generic.boundary,
      subjectConfirmed: Boolean(subjectConfirmed),
      evidenceStatus: q == null ? "hypothesis" : "observed",
    },
  };
}

export function languageFromPassport(passport, subjectConfirmed = passport?.language?.boundary?.subjectConfirmed === true) {
  if (!passport?.context || !passport?.interception) throw new Error("PASSPORT_LANGUAGE_SOURCE_INCOMPLETE");
  return compileSeparationLanguage({
    context: passport.context,
    episode: passport.object,
    interception: passport.interception,
    action: passport.oplus?.action,
    criterion: passport.oplus?.criterion,
    q: passport.q,
    returnObservation: passport.return,
    subjectConfirmed,
  });
}
