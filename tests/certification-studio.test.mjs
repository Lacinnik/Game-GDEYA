import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CERTIFICATION_STAGES, DRAFT_COMPETENCIES } from "../public-web/public/labs/certification/catalog.mjs";
import {
  attachAuthorizationPackage,
  attachSupervisedCase,
  attachSupervisionReview,
  buildAuthorizationPackage,
  buildCertificationDossier,
  buildSupervisedCase,
  buildSupervisionReview,
  getAuthorizationReadiness,
  validateAuthorizationPackage,
  validateCertificationDossier,
} from "../public-web/public/labs/certification/protocol.mjs";

const NOW = Date.parse("2026-10-20T12:00:00.000Z");

const base = {
  candidateName:"Кандидат 01", candidateRole:"Ведущий практики", requestedScope:"Групповая практика ГДЕЯ", methodScope:"ГДЕЯ и РЕЗОН",
  prerequisiteTrace:"Три учебных протокола и один самостоятельный цикл", supervisionPlan:"Три кейса под наблюдением заявленного супервизора",
  object:"Подготовка к ограниченному допуску ведущего", subjectManifestation:"Кандидат собрал учебный контур и запросил супервизию",
  reflectedImage:"Подготовка воспринимается как достаточная для проверки", targetRelation:"Собрать проверяемое досье без самоприсвоения роли",
  context:"Учебная группа и локальные записи", invariant:"Авторство участника и право остановки сохраняются",
  canonReference:"draft/canon-v0.1", competencyVersion:"draft-0.1", ethicsReference:"draft/ethics-v0.1",
  authorshipAck:true, consentAck:true, boundaryAck:true, authorizationAck:true,
};

const caseInput = (number) => ({
  caseTitle:`Супервизируемый кейс ${number}`, practiceDate:"2026-10-20", participantScope:"Добровольный участник без персональных данных",
  participantConsent:true, consentTrace:`consent/case-${number}.md`, object:"Один проектный переход", observedTrace:"Участник сформулировал объект и сам выбрал следующий шаг",
  candidateReflection:"Ведущий удержал процесс и не выбирал за участника", supervisorReference:`supervision/case-${number}.md`, evidencePointer:`evidence/case-${number}.json`,
  evidenceStatus:"observed", incidentState:"none",
});

const reviewInput = {
  reviewerName:"Заявленный супервизор", reviewerRole:"Супервизор практики", reviewDate:"2026-10-20", recommendation:"ready-for-authorized-review",
  reviewNote:"Три кейса разобраны; рекомендация относится только к передаче на рассмотрение.",
  assessments:Object.fromEntries(DRAFT_COMPETENCIES.map((item) => [item.id, { status:"observed", basis:`Наблюдаемый след по ${item.title}` }])),
};

function dossierWithCases(count = 3) {
  let dossier = buildCertificationDossier(base, { now:NOW - 86_400_000, uuid:() => "candidate" });
  for (let index = 1; index <= count; index += 1) {
    const supervisedCase = buildSupervisedCase(dossier, caseInput(index), { now:NOW + index, uuid:() => `case-${index}` });
    dossier = attachSupervisedCase(dossier, supervisedCase, { now:NOW + index + 10 });
  }
  return dossier;
}

test("six-stage route and draft competence frame are explicit", () => {
  assert.equal(CERTIFICATION_STAGES.length, 6);
  assert.equal(DRAFT_COMPETENCIES.length, 5);
  assert.equal(CERTIFICATION_STAGES.at(-1).id, "authorization");
});

test("dossier preserves TeZar axis and cannot issue rights", () => {
  const dossier = buildCertificationDossier(base, { now:0, uuid:() => "candidate" });
  assert.equal(dossier.tensor.O, base.object);
  assert.equal(dossier.tensor.Q, null);
  assert.equal(dossier.q, null);
  assert.equal(dossier.candidate.identity_verified, false);
  assert.deepEqual(dossier.flags, { certificate_issued:false, access_granted:false, role_assigned:false, reviewer_identity_verified:false, canon_approved:false, outcome_confirmed:false });
  assert.equal(dossier.progress.status, "practice-in-progress");
  assert.equal(validateCertificationDossier(dossier), true);
  assert.equal(validateCertificationDossier({ ...dossier, flags:{ ...dossier.flags, certificate_issued:true } }), false);
});

test("four boundary acknowledgements and participant consent are mandatory", () => {
  assert.throws(() => buildCertificationDossier({ ...base, authorizationAck:false }), /ACKNOWLEDGEMENTS_REQUIRED/u);
  const dossier = buildCertificationDossier(base);
  assert.throws(() => buildSupervisedCase(dossier, { ...caseInput(1), participantConsent:false }), /PARTICIPANT_CONSENT_REQUIRED/u);
});

test("three observed cases plus supervision open only the review-package gate", () => {
  let dossier = dossierWithCases();
  assert.equal(dossier.progress.eligible_cases, 3);
  assert.equal(dossier.progress.supervised_practice_complete, true);
  assert.throws(() => buildAuthorizationPackage(dossier, {}), /READINESS_GATES_INCOMPLETE/u);
  const review = buildSupervisionReview(dossier, reviewInput, { now:NOW + 20, uuid:() => "review" });
  dossier = attachSupervisionReview(dossier, review, { now:NOW + 21 });
  assert.equal(dossier.progress.status, "ready-to-assemble-review-package");
  assert.equal(review.reviewer.identity_verified, false);
  assert.equal(review.authorization_decision, null);
  assert.ok(Object.values(review.flags).every((value) => value === false));
});

test("authorization package stays a request and never becomes a certificate", () => {
  let dossier = dossierWithCases();
  dossier = attachSupervisionReview(dossier, buildSupervisionReview(dossier, reviewInput, { now:NOW + 10, uuid:() => "review" }));
  const reviewPackage = buildAuthorizationPackage(dossier, {
    canonReference:"declared/canon-v1", competencyReference:"declared/competencies-v1", ethicsReference:"declared/ethics-v1",
    accessPolicyReference:"declared/access-v1", legalReviewReference:"declared/legal-review-01", requestedDecision:"Рассмотреть ограниченный допуск к одной групповой практике",
  }, { now:NOW + 11, uuid:() => "package" });
  assert.equal(validateAuthorizationPackage(reviewPackage), true);
  assert.equal(reviewPackage.status, "ready-for-authorized-review");
  assert.equal(reviewPackage.decision, null);
  assert.equal(reviewPackage.flags.certificate_issued, false);
  assert.equal(reviewPackage.flags.access_granted, false);
  assert.equal(reviewPackage.flags.role_assigned, false);
  assert.equal(reviewPackage.readiness_scope, "technical-package-only");
  assert.ok(Object.values(reviewPackage.verification).every((value) => value === false));
  assert.deepEqual(reviewPackage.case_ids, dossier.reviews[0].case_ids);
  assert.deepEqual(reviewPackage.review_ids, [dossier.reviews[0].id]);
  assert.equal(reviewPackage.q, null);
  dossier = attachAuthorizationPackage(dossier, reviewPackage);
  assert.equal(validateCertificationDossier(dossier), true);
});

test("ready recommendation cannot precede three cases or hide an unobserved competency", () => {
  const empty = buildCertificationDossier(base, { now:NOW, uuid:() => "candidate" });
  assert.throws(() => buildSupervisionReview(empty, reviewInput, { now:NOW, uuid:() => "review" }), /READY_RECOMMENDATION_REQUIRES_CASES/u);
  const dossier = dossierWithCases();
  const assessments = structuredClone(reviewInput.assessments);
  assessments["process-boundary"].status = "needs-review";
  assert.throws(() => buildSupervisionReview(dossier, { ...reviewInput, assessments }, { now:NOW, uuid:() => "review" }), /READY_RECOMMENDATION_REQUIRES_OBSERVED_COMPETENCIES/u);
});

test("duplicate case cannot manufacture the three-case threshold", () => {
  let dossier = buildCertificationDossier(base, { now:NOW, uuid:() => "candidate" });
  const supervisedCase = buildSupervisedCase(dossier, caseInput(1), { now:NOW, uuid:() => "case-1" });
  dossier = attachSupervisedCase(dossier, supervisedCase, { now:NOW + 1 });
  assert.throws(() => attachSupervisedCase(dossier, supervisedCase, { now:NOW + 2 }), /CASE_ID_DUPLICATE/u);
  const duplicateRecord = { ...supervisedCase, id:"supervised-case-copy" };
  assert.throws(() => attachSupervisedCase(dossier, duplicateRecord, { now:NOW + 3 }), /CASE_RECORD_DUPLICATE/u);
  assert.equal(dossier.progress.eligible_cases, 1);
});

test("latest pause recommendation closes an earlier readiness gate", () => {
  let dossier = dossierWithCases();
  const ready = buildSupervisionReview(dossier, reviewInput, { now:NOW + 10, uuid:() => "ready-review" });
  dossier = attachSupervisionReview(dossier, ready, { now:NOW + 11 });
  assert.equal(getAuthorizationReadiness(dossier).ready, true);
  const pause = buildSupervisionReview(dossier, { ...reviewInput, recommendation:"pause", reviewNote:"Нужно проверить основание повторно." }, { now:NOW + 20, uuid:() => "pause-review" });
  dossier = attachSupervisionReview(dossier, pause, { now:NOW + 21 });
  assert.equal(getAuthorizationReadiness(dossier).ready, false);
  assert.throws(() => buildAuthorizationPackage(dossier, {}), /READINESS_GATES_INCOMPLETE/u);
});

test("escalated incident and future date do not create an eligible case", () => {
  let dossier = buildCertificationDossier(base, { now:NOW, uuid:() => "candidate" });
  assert.throws(() => buildSupervisedCase(dossier, { ...caseInput(1), practiceDate:"2026-10-21" }, { now:NOW, uuid:() => "future" }), /PRACTICE_DATE_INVALID/u);
  const escalated = buildSupervisedCase(dossier, { ...caseInput(1), incidentState:"escalated" }, { now:NOW, uuid:() => "escalated" });
  dossier = attachSupervisedCase(dossier, escalated, { now:NOW + 1 });
  assert.equal(dossier.progress.eligible_cases, 0);
});

test("validators reject missing safety flags and foreign evidence links", () => {
  const dossier = dossierWithCases();
  assert.equal(validateCertificationDossier({ ...dossier, flags:{} }), false);
  const forgedCase = { ...dossier.cases[0], dossier_id:"certification-dossier-foreign" };
  assert.equal(validateCertificationDossier({ ...dossier, cases:[forgedCase, ...dossier.cases.slice(1)] }), false);
});

test("catalog keeps certification in final phase but exposes its readiness studio", async () => {
  const catalog = JSON.parse(await readFile(new URL("../public-web/public/ecosystem/catalog.json", import.meta.url), "utf8"));
  const item = catalog.items.find((candidate) => candidate.id === "facilitator-certification");
  assert.equal(item.delivery_stage, "final-phase");
  assert.equal(item.entrypoint, "../labs/certification/");
  assert.match(item.evidence.join(" "), /студия подготовки/u);
});

test("shell, local journal and offline route are wired", async () => {
  const root = new URL("../public-web/public/labs/certification/", import.meta.url);
  const [html, app, worker] = await Promise.all([readFile(new URL("index.html", root), "utf8"), readFile(new URL("app.mjs", root), "utf8"), readFile(new URL("../../sw.js", root), "utf8")]);
  assert.match(html, /CERTIFICATE ISSUED = FALSE/u);
  assert.match(html, /styles\.css\?v=certification-20261020-r1/u);
  assert.match(html, /app\.mjs\?v=certification-20261022-r2/u);
  assert.match(app, /architectonica\.certification\.dossiers\.v1/u);
  assert.match(worker, /CACHE_REVISION = 'certification-audit-20261022-r2'/u);
  assert.match(worker, /\.\/labs\/certification\/index\.html/u);
});
