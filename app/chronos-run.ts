import {ChronosAI, type ChronosEventInput, type SequenceAnalysisResult} from "../public-web/chronos/chronos_ai_module";
import {importDataset} from "../public-web/public/labs/sc5-chronos/sc5-core.mjs";

export const CHRONOS_STORAGE_KEY = "gdeya.sc5.research.v1";
export const CHRONOS_RUN_VERSION = "GDEYA.ChronosRun.v1";
export const CHRONOS_LIMITATION = "Только пять числовых факторов самоотчёта SC-5. Текст, индукция, инверсия и смысловые признаки не анализируются. Семантический анализ не выполнен; в формулах движка остаются значения по умолчанию. Выводы — невалидированные эвристики, не диагностика, не научный прогноз и не основание для допуска или ограничения доступа.";

export interface ChronosRunResult {
  schema: typeof CHRONOS_RUN_VERSION;
  cycleId: string;
  eventCount: number;
  eventIds: string[];
  inputMode: "sc5-numeric-only";
  semanticAnalysis: false;
  researchOnly: true;
  prediction: false;
  diagnosis: false;
  accessDecision: false;
  limitation: string;
  analysis: SequenceAnalysisResult;
}

type Assessment = {assessmentId: string; timestamp: string; cycleId: string | null;
  complete: boolean; plate: ChronosEventInput["plate"]; phase: string | null;
  factors: NonNullable<ChronosEventInput["metrics"]>};

// A fresh engine per invocation: no profile/calibration from another cycle or run.
export async function runAuthorialChronosForCycle(cycleId: string): Promise<ChronosRunResult> {
  if (!/^cycle-[a-zA-Z0-9_-]{8,94}$/.test(cycleId)) throw Error("Недопустимый идентификатор цикла");
  let raw: string | null;
  try {
    raw = globalThis.localStorage.getItem(CHRONOS_STORAGE_KEY);
  } catch {
    throw Error("Локальная история SC-5 недоступна: чтение хранилища запрещено");
  }
  if (!raw || raw.length > 1_000_000) throw Error("Локальная история SC-5 недоступна или слишком велика");
  let records: Assessment[];
  try {
    // Same validator as lab imports: consent, source, 15 answers, aggregates,
    // metadata and globally unique IDs. Corrupt records are never silently dropped.
    records = importDataset(raw);
  } catch {
    throw Error("Неверный формат истории SC-5: проверьте согласие, ответы, метаданные и уникальность ID");
  }
  const rows = records.filter(r => r.cycleId === cycleId && r.complete);
  if (rows.length < 2) throw Error("Для Chronos требуется минимум два полных измерения SC-5 одного цикла");
  const events: ChronosEventInput[] = rows.map(r => ({
    ts: new Date(r.timestamp).toISOString(), userId: cycleId, plate: r.plate,
    metrics: {...r.factors},
    metadata: {assessmentId: r.assessmentId, cycleId, phase: r.phase ?? null,
      source: "SC5-self-report-unvalidated", inputMode: "sc5-numeric-only", semanticAnalysis: false},
  }));
  // Normalized timestamps and code-point IDs avoid browser-locale ordering.
  // No wall-clock timestamps enter replay.
  events.sort((a, b) => {
    const time = Date.parse(a.ts!) - Date.parse(b.ts!);
    const idA = String(a.metadata!.assessmentId), idB = String(b.metadata!.assessmentId);
    return time || (idA < idB ? -1 : idA > idB ? 1 : 0);
  });
  const engine = new ChronosAI({maxEvents: events.length});
  let analysis: SequenceAnalysisResult;
  try {
    analysis = await engine.analyzeSequence(events, cycleId);
  } catch {
    throw Error("Не удалось выполнить Chronos AI; результат не сформирован");
  }
  return {schema: CHRONOS_RUN_VERSION, cycleId, eventCount: events.length,
    eventIds: events.map(e => String(e.metadata!.assessmentId)), inputMode: "sc5-numeric-only",
    semanticAnalysis: false, researchOnly: true, prediction: false, diagnosis: false,
    accessDecision: false, limitation: CHRONOS_LIMITATION, analysis};
}
