// The same vocabulary is available before and after the pause.
// A changed or more positive state is not required for a valid self-report.
export const OBSERVATION_STATES = Object.freeze([
  "рассеянность", "напряжение", "неопределённость", "перегруз", "остановка", "фоновый шум",
  "ясность", "тишина", "устойчивость", "собранность", "направленность", "простота",
]);

export const DELTAS = Object.freeze([
  { id: "density_shift", label: "Плотность", quadrant: "resource" },
  { id: "impulse_break", label: "Прерывание", quadrant: "power" },
  { id: "distance_collapse", label: "Схлопывание", quadrant: "relations" },
  { id: "auto_form", label: "Самоформа", quadrant: "result" },
]);

export function isCompleteObservation(state) {
  return Boolean(state && OBSERVATION_STATES.includes(state.pre) && OBSERVATION_STATES.includes(state.post)
    && DELTAS.some(delta => delta.id === state.delta?.id && delta.quadrant === state.delta?.quadrant)
    && Number.isInteger(state.stability) && state.stability >= 0 && state.stability <= 3);
}
