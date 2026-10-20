import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AXIS_HANDOFF_SCHEMA, AXIS_RECEIPT_SCHEMA, decodeEnvelope, encodeEnvelope, createAxisHandoff, createAxisReceipt, createExchangeRecord, readExchangeRecord, readExchangeRecords, validateAxisHandoff, validateAxisReturn, validateExchangeRecord } from "../public-web/public/labs/axis-cycle/protocol.mjs";

const draft = {
  object:"Запуск общего проекта", subject_manifestation:"Я удерживаю замысел и называю следующий шаг", reflected_image:"Мост между личной осью и голосами группы",
  target_relation:"Передать объект без передачи авторства", context:"Рабочая встреча трёх участников", next_action:"Собрать встречу и назначить владельца действия", invariant:"Сохранить дословный объект и отдельность голосов",
};

test("axis handoff preserves O/S/I/Rg/C and keeps Q null", () => {
  const handoff = createAxisHandoff(draft, { now:0, uuid:()=>"handoff-12345678" });
  assert.equal(handoff.schema, AXIS_HANDOFF_SCHEMA);
  assert.equal(handoff.object, draft.object);
  assert.equal(handoff.q, null);
  assert.ok(validateAxisHandoff(handoff));
  assert.deepEqual(decodeEnvelope(encodeEnvelope(handoff)), handoff);
});

test("axis return must match the handoff before observed Q can be recorded", () => {
  const handoff = createAxisHandoff(draft, { now:0, uuid:()=>"handoff-12345678" });
  const returned = {schema:"architectonica.axis-return/1.0.0",id:"return-12345678",created_at:new Date(1000).toISOString(),producer:"reson-field-check",recipient:"gdeya-axis",handoff_id:handoff.id,field_decision_id:"field-12345678",object:handoff.object,allow:true,links_verified:true,gate:"ok",q:null};
  assert.ok(validateAxisReturn(returned, handoff));
  assert.throws(()=>createAxisReceipt(handoff,returned,{observed_q:.75,observation:"коротко"}),/OBSERVATION_REQUIRED/u);
  const receipt=createAxisReceipt(handoff,returned,{observed_q:.75,observation:"Владелец выполнил шаг, группа вернулась с указанным артефактом."},{now:2000,uuid:()=>"receipt-12345678"});
  assert.equal(receipt.schema,AXIS_RECEIPT_SCHEMA);
  assert.equal(receipt.q,.75);
  assert.equal(receipt.evidence.class, "self-reported");
  assert.equal(receipt.evidence.verified, false);
});

test("ecosystem exchange wraps legacy axis records without asserting verification", () => {
  const handoff = createAxisHandoff(draft, { now:0, uuid:() => "handoff-12345678" });
  const exchange = createExchangeRecord(handoff, { now:1000, uuid:() => "exchange-12345678" });
  assert.equal(validateExchangeRecord(exchange), true);
  assert.equal(exchange.payload, handoff);
  assert.equal(exchange.verified, false);
  const fieldReturn = { schema:"architectonica.axis-return/1.0.0", id:"return-12345678", producer:"reson-field-check" };
  assert.equal(createExchangeRecord(fieldReturn).source.repository, "reason-");
  assert.equal(readExchangeRecord(handoff).payload.id, handoff.id);
  const journal = { schema:"architectonica.exchange-journal/1.0.0", entries:[exchange] };
  assert.equal(readExchangeRecords(journal)[0].id, exchange.id);
  assert.throws(() => readExchangeRecord({ schema:"unknown/1", id:"bad" }), /UNSUPPORTED_EXCHANGE_RECORD/u);
});

test("axis page exposes all three stages and is included in the offline shell", async () => {
  const root=new URL("../public-web/public/",import.meta.url);
  const [html,app,css,sw]=await Promise.all([readFile(new URL("labs/axis-cycle/index.html",root),"utf8"),readFile(new URL("labs/axis-cycle/app.mjs",root),"utf8"),readFile(new URL("labs/axis-cycle/styles.css",root),"utf8"),readFile(new URL("sw.js",root),"utf8")]);
  for(const stage of ["compose","handoff","return"]) assert.match(html,new RegExp(`data-stage=["']${stage}["']`,"u"));
  assert.match(app,/https:\/\/lacinnik\.github\.io\/reason-\/field-check\//u);
  assert.match(app,/serviceWorker\.register\("\.\.\/\.\.\/sw\.js"\)/u);
  assert.match(css,/@media\(max-width:680px\)/u);
  for(const name of ["index.html","styles.css","app.mjs","protocol.mjs","exchange.schema.json","CONTRACT.md"]) assert.match(sw,new RegExp(`labs/axis-cycle/${name.replace(".","\\.")}`,"u"));
  assert.match(html,/id="import-exchange"/u);
  assert.match(html,/внешнего наблюдателя/u);
  assert.match(html,/name="observed_at"/u);
  assert.match(app,/readExchangeRecords/u);
  assert.match(app,/JOURNAL_KEY/u);
});
