import type { AppState, Scenario, Study } from "../types";
export const scenarios: {
  id: Scenario;
  title: string;
  description: string;
  expected: string;
}[] = [
  {
    id: "healthy",
    title: "Healthy workflow",
    description: "An examination, accounted for from order to retrieval.",
    expected: "Verified archive · no incident",
  },
  {
    id: "worklist",
    title: "Worklist bypass",
    description: "Acquisition completes without the scheduled worklist.",
    expected: "Unverified study · human review",
  },
  {
    id: "accession",
    title: "Missing accession",
    description: "The order reference is absent from DICOM metadata.",
    expected: "Missing metadata · candidate comparison",
  },
  {
    id: "identity",
    title: "Wrong patient identifier",
    description: "Patient identity conflicts with the originating order.",
    expected: "Hard conflict · automatic association blocked",
  },
  {
    id: "transfer",
    title: "Interrupted transfer",
    description: "A network interruption prevents DICOM delivery.",
    expected: "Failed transfer · eligible retry",
  },
  {
    id: "acknowledgement",
    title: "Missing archive confirmation",
    description: "Transport succeeds, but archive retrieval is unconfirmed.",
    expected: "Unconfirmed archive · request evidence",
  },
  {
    id: "duplicate",
    title: "Ambiguous candidate orders",
    description: "Two similar orders have overlapping acquisition windows.",
    expected: "Insufficient evidence · abstain",
  },
  {
    id: "compound",
    title: "Compound workflow failure",
    description: "A missing accession and a failed transfer overlap.",
    expected: "Multiple hypotheses · preserve uncertainty",
  },
];
export const stages = [
  "Patient registered",
  "Order created",
  "Worklist selected",
  "Scan acquired",
  "Transfer attempted",
  "Storage accepted",
  "Archive retrieved",
];
export function makeStudy(index: number, scenario: Scenario): Study {
  const patient = `SYN-${String(1040 + index).padStart(5, "0")}`;
  const accession = `ACC-26-${7200 + index}`;
  const time = new Date(Date.UTC(2026, 9, 22, 5, 0 + index * 7)).toISOString();
  const events = stages.flatMap((type, i) => {
    if (
      (scenario === "worklist" && i === 2) ||
      (["transfer", "compound"].includes(scenario) && i > 4) ||
      (scenario === "acknowledgement" && i > 4)
    )
      return [];
    return [
      {
        id: `EV-${index}-${i}`,
        type:
          scenario === "transfer" || scenario === "compound"
            ? i === 4
              ? "Transfer failed"
              : type
            : type,
        source: [
          "HIS",
          "RIS",
          "Modality",
          "US-01",
          "DICOM gateway",
          "PACS",
          "Review station",
        ][i],
        time: new Date(Date.parse(time) + i * 60000).toISOString(),
        detail:
          i === 4 && ["transfer", "compound"].includes(scenario)
            ? "Connection interrupted; no archive receipt."
            : `${type} recorded by source system.`,
        observed: true,
      },
    ];
  });
  const candidates = [
    {
      id: `ORD-${7200 + index}`,
      patient,
      issuer: "DEMO-HOSPITAL",
      accession,
      modality: index % 3 === 0 ? "CT" : index % 3 === 1 ? "US" : "MR",
      delta: 4,
      score: scenario === "duplicate" ? 62 : 88,
      conflict: scenario === "identity",
      evidence: [
        "Scheduling record",
        "Device acquisition log",
        "Assigning authority",
      ],
    },
  ];
  if (scenario === "duplicate")
    candidates.push({
      ...candidates[0],
      id: `ORD-${8200 + index}`,
      patient: `SYN-${2040 + index}`,
      delta: 5,
      score: 61,
      conflict: true,
    });
  return {
    id: `ST-${String(index + 1).padStart(4, "0")}`,
    uid: `1.2.826.0.1.3680043.10.543.${1000 + index}`,
    patient:
      scenario === "identity"
        ? "SYN-99999"
        : scenario === "worklist"
          ? `LOCAL-${index}`
          : patient,
    issuer: "DEMO-HOSPITAL",
    accession: ["accession", "compound", "worklist"].includes(scenario)
      ? ""
      : accession,
    modality: candidates[0].modality,
    description: [
      "Chest examination",
      "Abdominal examination",
      "Spine examination",
    ][index % 3],
    device: index % 3 === 0 ? "CT-02" : index % 3 === 1 ? "US-01" : "MR-01",
    system: index % 2 ? "North wing" : "Main campus",
    time,
    archive:
      scenario === "healthy"
        ? "Verified"
        : ["transfer", "compound"].includes(scenario)
          ? "Transfer failed"
          : scenario === "identity"
            ? "Verified"
            : "Unverified",
    integrity:
      scenario === "healthy"
        ? "Healthy"
        : ["identity", "duplicate"].includes(scenario)
          ? "Identity conflict"
          : "Needs review",
    scenario,
    events,
    candidates,
  };
}
export function initialState(): AppState {
  const studies = Array.from({ length: 32 }, (_, i) =>
    makeStudy(i, i < 8 ? scenarios[i].id : "healthy"),
  );
  const investigations = studies
    .filter((s) => s.integrity !== "Healthy")
    .map((s, i) => ({
      id: `INV-${String(i + 1).padStart(4, "0")}`,
      studyId: s.id,
      category: scenarios.find((x) => x.id === s.scenario)!.title,
      severity:
        s.integrity === "Identity conflict"
          ? ("Critical" as const)
          : s.scenario === "transfer"
            ? ("High" as const)
            : ("Medium" as const),
      status: "Open",
      reviewer: "Unassigned",
      detected: new Date(Date.parse(s.time) + 480000).toISOString(),
      completeness: Math.round((s.events.length / 7) * 100),
    }));
  return {
    studies,
    investigations,
    recovery: investigations.map((inv, i) => ({
      id: `REC-${i + 1}`,
      investigationId: inv.id,
      studyId: inv.studyId,
      action:
        studies.find((s) => s.id === inv.studyId)!.scenario === "transfer"
          ? "Retry simulated transfer"
          : "Review evidence and reconcile simulation",
      status: "Pending review",
      reason: "",
      evidence: "",
      reviewer: "Unassigned",
    })),
    audit: [
      {
        id: "AUD-1",
        actor: "System",
        role: "Administrator",
        action: "Synthetic environment initialized",
        target: "Demo hospital",
        time: "2026-10-22T05:00:00Z",
        before: "Empty",
        after: "32 synthetic studies",
        reason: "Deterministic seed 42",
        evidence: "Fixture generator v1",
        correlation: "INIT-42",
      },
    ],
    experiments: [],
  };
}
