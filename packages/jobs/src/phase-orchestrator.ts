type PhaseLogValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | ReadonlyArray<PhaseLogValue>
  | { readonly [key: string]: PhaseLogValue };
type PhaseLogFields = Record<string, PhaseLogValue>;

type PhaseLog = {
  emit: () => void;
  error: (message: string) => void;
  info: (message: string) => void;
  set: (fields: PhaseLogFields) => void;
};

type PhasePayload<Phase extends string> = {
  initialFanoutDone?: boolean;
  phase: Phase;
  startedAt: string;
};

type PhaseOrchestratorSpec<
  Phase extends string,
  Counts extends PhaseLogFields,
  Payload extends PhasePayload<Phase> & PhaseLogFields,
  Context extends PhaseLogFields = PhaseLogFields,
> = {
  afterInitialFanout?: () => Promise<Partial<Payload>>;
  context?: Context;
  fanout: (phase: Phase) => Promise<void>;
  isPhase?: (value: string) => value is Phase;
  label: string;
  log: PhaseLog;
  markDone: (carry: Partial<Payload>) => Promise<void>;
  payload: Payload;
  reEnqueue: (payload: Payload) => Promise<void>;
  tick: () => Promise<{ carry?: Partial<Payload>; counts: Counts; next: Phase }>;
};

const runPhaseOrchestrator = async <
  Phase extends string,
  Counts extends PhaseLogFields,
  Payload extends PhasePayload<Phase> & PhaseLogFields,
>(
  spec: PhaseOrchestratorSpec<Phase, Counts, Payload>,
): Promise<void> => {
  const {
    afterInitialFanout,
    context,
    fanout,
    isPhase,
    label,
    log,
    markDone,
    payload,
    reEnqueue,
    tick,
  } = spec;

  if (context) {
    log.set(context);
  }

  if (isPhase && !isPhase(payload.phase)) {
    log.set({ phase: payload.phase });
    log.error(`${label}: unknown phase, ending orchestrator chain`);
    await markDone({});
    log.emit();
    return;
  }

  if (payload.initialFanoutDone !== true && payload.phase !== "DONE") {
    log.set({ phase: payload.phase });
    await fanout(payload.phase);
    const carried = (await afterInitialFanout?.()) ?? {};
    log.set(carried);
    log.info(`${label}: initial fanout`);
    log.emit();
    await reEnqueue({ ...payload, ...carried, initialFanoutDone: true });
    return;
  }

  const { carry, counts, next } = await tick();
  log.set({ counts, next, phase: payload.phase });
  log.info(`${label}: tick`);

  if (next === "DONE") {
    log.info(`${label}: complete`);
    await markDone(carry ?? {});
    log.emit();
    return;
  }
  if (next !== payload.phase) {
    await fanout(next);
  }
  log.emit();
  await reEnqueue({ ...payload, ...carry, initialFanoutDone: true, phase: next });
};

export { runPhaseOrchestrator };
export type { PhaseLog, PhaseOrchestratorSpec, PhasePayload };
