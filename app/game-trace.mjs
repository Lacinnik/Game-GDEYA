/** Snapshot author inputs before the next turn resets the draft. */
export function captureAuthoredStep(draft) {
  return {
    states: [...draft.states],
    reflection: draft.reflection,
    induction: draft.induction,
    inversion: draft.inversion,
    axisSelfReport: draft.axis,
  };
}

/** Serialize gameplay without promoting its simulated Q to an observed return. */
export function createGameTrace({ intent, invariant, mode, source, metrics, gradient, coherence, log, completed = false }) {
  const { q: qSim, ...otherMetrics } = metrics;
  return {
    schema: 'gdeya.subject-core.game-trace.v2',
    title: 'ЯДРО СУБЪЕКТА · ЖИВОЙ ЦИКЛ',
    intent, invariant, mode, source,
    evidenceStatus: 'simulation',
    q: null,
    returnObservation: null,
    progress: { status: completed ? 'completed' : 'partial', completedNodes: log.length },
    authoredSteps: log.map((entry, index) => ({
      node: index + 1,
      cardId: entry.card?.id ?? null,
      // Missing legacy data stays unknown; never reconstruct a player's words.
      record: entry.authored ? {
        ...entry.authored,
        states: [...entry.authored.states],
      } : null,
    })),
    compatibility: {
      sepPassport: false,
      externalAuthorization: false,
      note: 'Игровые баллы не преобразуются в фактический Q и не импортируются как паспорт SEP.',
    },
    simulation: {
      metrics: { ...otherMetrics, qSim }, gradient, coherence,
      log: log.map(({ deltas, ...entry }) => {
        delete entry.authored;
        const { q: qSimDelta, ...otherDeltas } = deltas;
        return { ...entry, deltas: { ...otherDeltas, qSim: qSimDelta } };
      }),
    },
  };
}
