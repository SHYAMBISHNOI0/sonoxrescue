import { initialState, makeStudy, scenarios } from "../mocks/fixtures";
import type {
  AppState,
  Command,
  ExperimentConfig,
  Metric,
  Role,
  Service,
} from "../types";
export function runExperiment(config: ExperimentConfig): Metric[] {
  let seed = config.seed >>> 0;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const samples = Array.from({ length: config.count }, (_, i) => {
    const fault = i % 8;
    const faults = Array.from({length: fault === 0 ? 0 : config.faults}, (_, offset) => ((fault - 1 + offset) % 7) + 1);
    const missing = random() < config.missing;
    const corrupted = random() < config.corruption;
    return {
      fault,
      anomaly: fault !== 0 || corrupted,
      metadata: faults.some(f => [2, 3, 7].includes(f)) || corrupted,
      event: !missing && fault !== 0,
      conflict: faults.includes(3) || faults.includes(6) || corrupted,
      temporal: random() * config.noise > 12,
    };
  });
  return ["Metadata validation", "Weighted event matching", "TEG-UR"].map(
    (method, m) => {
      let tp = 0,
        fp = 0,
        tn = 0,
        fn = 0,
        unsafe = 0,
        abstain = 0,
        correct = 0;
      const start = performance.now();
      for (const s of samples) {
        const detected =
          m === 0
            ? s.metadata
            : m === 1
              ? Number(s.metadata) * 0.6 + Number(s.event) * 0.4 >=
                config.threshold
              : s.metadata || s.event || s.temporal;
        if (detected && s.anomaly) tp++;
        else if (detected) fp++;
        else if (s.anomaly) fn++;
        else tn++;
        const support = (s.event ? .7 : .2) + (s.metadata ? .2 : .1) - (s.temporal ? .2 : 0);
        const hold = m === 2 && (s.conflict || support < config.abstention);
        if (hold) abstain++;
        if (s.conflict && !hold) unsafe++;
        if (detected === s.anomaly) correct++;
      }
      const n = samples.length;
      return {
        method,
        precision: tp / Math.max(1, tp + fp),
        recall: tp / Math.max(1, tp + fn),
        accuracy: correct / n,
        unsafe: unsafe / n,
        abstention: abstain / n,
        falsePositive: fp / Math.max(1, fp + tn),
        review: (tp + fp + abstain) / Math.max(1, n + abstain),
        latency: (performance.now() - start) / n,
        tp,
        fp,
        tn,
        fn,
      };
    },
  );
}
export function reduceCommand(
  state: AppState,
  command: Command,
  role: Role,
): AppState {
  if (role === "Read-only observer")
    throw Error("Permission denied: observers cannot modify the environment.");
  const next = structuredClone(state);
  let before = "";
  let after = "";
  const rec = next.recovery.find((r) => r.id === command.id);
  const study = next.studies.find((s) => s.id === rec?.studyId);
  if (command.type === "reset") {
    if (role !== "Administrator")
      throw Error("Only an administrator can reset the environment.");
    return initialState();
  }
  if (command.type === "simulate") {
    const s = makeStudy(next.studies.length, command.scenario ?? "healthy");
    next.studies.unshift(s);
    after = s.id;
    if (s.integrity !== "Healthy") {
      const id = `INV-${String(next.studies.length).padStart(4, "0")}`;
      next.investigations.unshift({
        id,
        studyId: s.id,
        category: scenarios.find((x) => x.id === s.scenario)!.title,
        severity: s.integrity === "Identity conflict" ? "Critical" : "High",
        status: "Open",
        reviewer: "Unassigned",
        detected: new Date(Date.parse(s.time) + 480000).toISOString(),
        completeness: Math.round((s.events.length / 7) * 100),
      });
      next.recovery.unshift({
        id: `REC-${next.studies.length}`,
        investigationId: id,
        studyId: s.id,
        action:
          s.scenario === "transfer"
            ? "Retry simulated transfer"
            : "Review evidence and reconcile simulation",
        status: "Pending review",
        reason: "",
        evidence: "",
        reviewer: "Unassigned",
      });
    }
  } else if (command.type === "experiment") {
    if (!command.config) throw Error("Experiment configuration is required.");
    const exp = {
      id: `EXP-${next.experiments.length + 1}`,
      config: command.config,
      results: runExperiment(command.config),
      created: new Date().toISOString(),
      scope:
        "Browser feature-level synthetic benchmark; not clinical validation. Root-cause and candidate matching are not evaluated in this frontend benchmark.",
    };
    next.experiments.unshift(exp);
    after = exp.id;
  } else if (command.type === "assign" || command.type === "analyze") {
    const inv = next.investigations.find((i) => i.id === command.id);
    if (!inv) throw Error("Investigation not found.");
    before = inv.status;
    inv.status = "Investigating";
    inv.reviewer = "Demo reviewer";
    after = inv.status;
  } else {
    if (!rec || !study) throw Error("Recovery action not found.");
    if (
      ![
        "Administrator",
        "Radiology reviewer",
        "Clinical safety reviewer",
      ].includes(role)
    )
      throw Error("Permission denied: an authorized reviewer is required.");
    before = rec.status;
    if (command.type === "approve") {
      if (rec.status !== "Pending review")
        throw Error("Only pending actions may be approved.");
      if (["identity", "duplicate"].includes(study.scenario))
        throw Error(
          "Unresolved identity conflict: automatic association is blocked.",
        );
      if (!command.reason?.trim() || !command.evidence?.trim())
        throw Error(
          "A reason and independent verification reference are required.",
        );
      rec.status = "Approved";
      rec.reason = command.reason;
      rec.evidence = command.evidence;
      rec.reviewer = "Demo reviewer";
    } else if (command.type === "reject") {
      if (rec.status !== "Pending review")
        throw Error("Only pending actions may be rejected.");
      if (!command.reason?.trim())
        throw Error("A rejection reason is required.");
      rec.status = "Rejected";
      rec.reason = command.reason;
    } else if (command.type === "execute") {
      if (rec.status !== "Approved")
        throw Error("Approval is required before execution.");
      rec.status = "Executed";
      study.events.push({
        id: `EV-REC-${rec.id}`,
        type: "Simulated archive retrieval",
        source: "PACS simulator",
        time: new Date().toISOString(),
        detail: `Retrieved ${study.uid}; verified against independent reference ${rec.evidence}`,
        observed: true,
      });
    } else if (command.type === "verify") {
      if (
        rec.status !== "Executed" ||
        !study.events.some((e) => e.id === `EV-REC-${rec.id}`)
      )
        throw Error("Execution and retrieval evidence are required.");
      rec.status = "Verified";
      study.archive = "Verified";
      study.integrity = "Recovered";
      const inv = next.investigations.find((i) => i.id === rec.investigationId);
      if (inv) inv.status = "Resolved";
    }
    after = rec.status;
  }
  next.audit.unshift({
    id: `AUD-${next.audit.length + 1}`,
    actor: "Demo reviewer",
    role,
    action: command.type,
    target: command.id ?? after,
    time: new Date().toISOString(),
    before,
    after,
    reason: command.reason ?? "User initiated synthetic workflow",
    evidence: command.evidence ?? "",
    correlation: crypto.randomUUID(),
  });
  return next;
}
export class MockService implements Service {
  private state: AppState;
  constructor() {
    try {
      this.state =
        JSON.parse(localStorage.getItem("sonorescue-v1") ?? "null") ??
        initialState();
    } catch {
      this.state = initialState();
    }
  }
  async snapshot() {
    return structuredClone(this.state);
  }
  async command(command: Command, role: Role) {
    this.state = reduceCommand(this.state, command, role);
    localStorage.setItem("sonorescue-v1", JSON.stringify(this.state));
    return this.snapshot();
  }
}
