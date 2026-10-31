import {useRef, useState} from "react";
import {CHRONOS_LIMITATION, runAuthorialChronosForCycle} from "./chronos-run";

export function ChronosPanel({cycleId}: {cycleId: string}) {
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  async function run() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setReport("");
    try {
      const r = await runAuthorialChronosForCycle(cycleId);
      const {analysis: a} = r;
      setReport(`Chronos AI · ${r.limitation} Измерений SC-5: ${r.eventCount}. Окно итоговой траектории: ${a.count}. Тип (эвристика): ${a.latest?.trajectoryType ?? "нет данных"}. Режим (эвристика): ${a.latest?.recommendedMode ?? "не определён"}. Повторяемость (эвристика): ${a.loop.loopKind}${a.loop.windowSize < 4 ? " — недостаточно истории для проверки" : ""}.`);
    } catch (e) {
      setReport(e instanceof Error ? e.message : "Ошибка анализа; результат не сформирован");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return <section aria-label="Chronos AI · исследование">
    <p className="endText">{CHRONOS_LIMITATION} Игровые баллы Qsim в расчёт не поступают.</p>
    <button className="secondary" disabled={busy} onClick={run}>{busy ? "АНАЛИЗ..." : "ЗАПУСТИТЬ CHRONOS AI · ИССЛЕДОВАНИЕ"}</button>
    <p role="status" aria-live="polite" className="endText">{report}</p>
  </section>;
}
