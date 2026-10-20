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
  validateAuthorizationPackage,
  validateCertificationDossier,
} from "../public-web/public/labs/certification/protocol.mjs";

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
  let dossier = buildCertificationDossier(base, { now:0, uuid:() => "candidate" });
  for (let index = 1; index <= 3; index += 1) {
    const entry = buildSupervisedCase(dossier, caseInput(index), { now:index, uuid:() => `case-${index}` });
    dossier = attachSupervisedCase(dossier, entry, { now:index + 10 });
  }
  assert.equal(dossier.progress.eligible_cases, 3);
  assert.equal(dossier.progress.supervised_practice_complete, true);
  assert.throws(() => buildAuthorizationPackage(dossier, {}), /READINESS_GATES_INCOMPLETE/u);
  const review = buildSupervisionReview(dossier, reviewInput, { now:20, uuid:() => "review" });
  dossier = attachSupervisionReview(dossier, review, { now:21 });
  assert.equal(dossier.progress.status, "ready-to-assemble-review-package");
  assert.equal(review.reviewer.identity_verified, false);
  assert.equal(review.authorization_decision, null);
  assert.ok(Object.values(review.flags).every((value) => value === false));
});

test("authorization package stays a request and never becomes a certificate", () => {
  let dossier = buildCertificationDossier(base, { now:0, uuid:() => "candidate" });
  for (let index = 1; index <= 3; index += 1) dossier = attachSupervisedCase(dossier, buildSupervisedCase(dossier, caseInput(index), { now:index, uuid:() => `case-${index}` }));
  dossier = attachSupervisionReview(dossier, buildSupervisionReview(dossier, reviewInput, { now:10, uuid:() => "review" }));
  const reviewPackage = buildAuthorizationPackage(dossier, {
    canonReference:"approved/canon-v1", competencyReference:"approved/competencies-v1", ethicsReference:"approved/ethics-v1",
    accessPolicyReference:"approved/access-v1", legalReviewReference:"legal/review-01", requestedDecision:"Рассмотреть ограниченный допуск к одной групповой практике",
  }, { now:11, uuid:() => "package" });
  assert.equal(validateAuthorizationPackage(reviewPackage), true);
  assert.equal(reviewPackage.status, "ready-for-authorized-review");
  assert.equal(reviewPackage.decision, null);
  assert.equal(reviewPackage.flags.certificate_issued, false);
  assert.equal(reviewPackage.flags.access_granted, false);
  assert.equal(reviewPackage.flags.role_assigned, false);
  assert.equal(reviewPackage.q, null);
  dossier = attachAuthorizationPackage(dossier, reviewPackage);
  assert.equal(validateCertificationDossier(dossier), true);
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
  assert.match(html, /app\.mjs\?v=certification-20261020-r1/u);
  assert.match(app, /architectonica\.certification\.dossiers\.v1/u);
  assert.match(worker, /CACHE_REVISION = 'exchange-20261021-r1'/u);
  assert.match(worker, /\.\/labs\/certification\/index\.html/u);
});
