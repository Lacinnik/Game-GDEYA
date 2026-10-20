import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CORE_LICENSE_SCHEMA,
  GATE_DEFINITIONS,
  buildCoreLicenseDossier,
  validateCoreLicenseDossier,
} from "../public-web/public/labs/core-license/protocol.mjs";
import {
  CREATOR_ACCESS_SCHEMA,
  buildCreatorAccessRequest,
  validateCreatorAccessRequest,
} from "../public-web/public/labs/creator-gate/protocol.mjs";

const licenseInput = {
  object:"Архитектура принятия решений", targetRelation:"Передать ограниченный рабочий контур", context:"Пилот одной команды на четыре недели", invariant:"Не передавать закрытое ядро",
  organization:"Тестовая организация", responsibleParty:"Назначенный владелец пилота", application:"Разбор одного операционного процесса",
  modules:["gdeya","tactics"], allowedUse:"Один внутренний пилот", excludedUse:"Перепродажа и публичное обучение",
  implementationBoundary:"Автор проектирует, организация исполняет", evidencePlan:"Артефакты до и после, журнал решений и внешнее наблюдение",
  gates:{},
};

const accessInput = {
  object:"Закрытый корпус Архитектоники", subjectManifestation:"Собрал три рабочих артефакта", reflectedImage:"Вижу необходимость различить смысл и структуру",
  targetRelation:"Запросить ограниченное исследовательское рассмотрение", context:"Личная работа без публичного распространения", invariant:"Не присваивать роль",
  role:"research", purpose:"Сверить один методический фрагмент", priorTrace:"Три экспортированных паспорта", contribution:"Подготовить точный отчёт",
  requestedMaterial:"Один фрагмент корпуса", boundaries:"Без персональных данных", sponsorReference:"нет", consent:true, confidentiality:true, nonAssignment:true,
};

test("Core License Lab makes all five final decisions explicit and unresolved by default", () => {
  const dossier = buildCoreLicenseDossier(licenseInput, { now:Date.parse("2026-10-20T10:00:00Z"), uuid:()=>"test" });
  assert.equal(dossier.schema, CORE_LICENSE_SCHEMA);
  assert.deepEqual(dossier.readiness.unresolved_gates, GATE_DEFINITIONS.map(({id}) => id));
  assert.equal(dossier.readiness.state, "scope-dossier");
  assert.equal(dossier.readiness.license_issued, false);
  assert.equal(dossier.verified, false);
  assert.equal(dossier.q, null);
  assert.equal(validateCoreLicenseDossier(dossier), true);
});

test("Core License Lab requires a statement and source for every declared gate", () => {
  assert.throws(() => buildCoreLicenseDossier({...licenseInput,gates:{canon:{status:"declared"}}}), /CANON_STATEMENT_REQUIRED/u);
  const declared = Object.fromEntries(GATE_DEFINITIONS.map(({id}) => [id,{status:"declared",statement:`Решение ${id}`,reference:`source/${id}`} ]));
  const dossier = buildCoreLicenseDossier({...licenseInput,gates:declared});
  assert.equal(dossier.readiness.state, "ready-for-author-review");
  assert.equal(dossier.readiness.license_issued, false);
  assert.equal(dossier.verified, false);
  assert.equal(dossier.q, null);
});

test("Creator Gate produces a review request and can never self-grant access", () => {
  const request = buildCreatorAccessRequest(accessInput, { now:Date.parse("2026-10-20T11:00:00Z"), uuid:()=>"test" });
  assert.equal(request.schema, CREATOR_ACCESS_SCHEMA);
  assert.equal(request.tensor.O, accessInput.object);
  assert.equal(request.tensor.Q, null);
  assert.equal(request.review.decision, null);
  assert.equal(request.review.access_granted, false);
  assert.equal(request.verified, false);
  assert.equal(validateCreatorAccessRequest(request), true);
});

test("Creator Gate refuses incomplete consent and unknown roles", () => {
  assert.throws(() => buildCreatorAccessRequest({...accessInput, consent:false}), /ACKNOWLEDGEMENTS_REQUIRED/u);
  assert.throws(() => buildCreatorAccessRequest({...accessInput, role:"source"}), /ROLE_REQUIRED/u);
});

test("the public product line exposes all six handoffs and versioned offline assets", async () => {
  const root = new URL("../public-web/public/", import.meta.url);
  const [html, app, sw, licenseHtml, creatorHtml] = await Promise.all([
    readFile(new URL("product-line/index.html", root), "utf8"), readFile(new URL("product-line/app.mjs", root), "utf8"), readFile(new URL("sw.js", root), "utf8"),
    readFile(new URL("labs/core-license/index.html", root), "utf8"), readFile(new URL("labs/creator-gate/index.html", root), "utf8"),
  ]);
  for (const id of ["gdeya-practical","reson","architectonics-tactics","living-materialization-module","core-architecture-license","architect-creator"]) assert.match(app, new RegExp(id));
  assert.match(html, /6\/6/u); assert.match(html, /0<\/span> выдуманных/u);
  assert.match(licenseHtml, /НЕ ЛИЦЕНЗИЯ/u); assert.match(creatorHtml, /ЗАПРОС ≠ ДОПУСК/u);
  for (const path of ["product-line/index.html","labs/core-license/index.html","labs/creator-gate/index.html"]) assert.match(sw, new RegExp(path.replace(/[./-]/gu,"\\$&")));
});
