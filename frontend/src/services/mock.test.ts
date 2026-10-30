import { describe, it, expect } from "vitest";
import { initialState } from "../mocks/fixtures";
import { reduceCommand, runExperiment } from "./mock";
describe("recovery safety and shared state", () => {
  it("does not create an incident for a healthy workflow", () => {
    const s = initialState();
    const n = reduceCommand(
      s,
      { type: "simulate", scenario: "healthy" },
      "Administrator",
    );
    expect(n.studies).toHaveLength(33);
    expect(n.investigations).toHaveLength(s.investigations.length);
    expect(n.audit).toHaveLength(2);
  });
  it("creates studies, investigations and recovery actions together", () => {
    const n = reduceCommand(
      initialState(),
      { type: "simulate", scenario: "transfer" },
      "Imaging technician",
    );
    expect(n.investigations[0].studyId).toBe(n.studies[0].id);
    expect(n.recovery[0].studyId).toBe(n.studies[0].id);
  });
  it("blocks wrong patient and ambiguous identity approvals", () => {
    for (const scenario of ["identity", "duplicate"]) {
      const s = initialState();
      const study = s.studies.find((x) => x.scenario === scenario)!;
      const r = s.recovery.find((x) => x.studyId === study.id)!;
      expect(() =>
        reduceCommand(
          s,
          {
            type: "approve",
            id: r.id,
            reason: "Reviewed",
            evidence: "RIS log",
          },
          "Administrator",
        ),
      ).toThrow(/identity conflict/);
    }
  });
  it("requires approval, execution and retrieval evidence independently", () => {
    let s = initialState();
    const r = s.recovery.find(
      (x) => x.studyId === s.studies.find((x) => x.scenario === "transfer")!.id,
    )!;
    expect(() =>
      reduceCommand(s, { type: "verify", id: r.id }, "Administrator"),
    ).toThrow();
    expect(() =>
      reduceCommand(s, { type: "execute", id: r.id }, "Administrator"),
    ).toThrow();
    s = reduceCommand(
      s,
      {
        type: "approve",
        id: r.id,
        reason: "Verified source",
        evidence: "LOG-42",
      },
      "Radiology reviewer",
    );
    expect(s.studies.find((x) => x.id === r.studyId)!.integrity).not.toBe(
      "Recovered",
    );
    s = reduceCommand(s, { type: "execute", id: r.id }, "Radiology reviewer");
    s = reduceCommand(s, { type: "verify", id: r.id }, "Radiology reviewer");
    expect(s.studies.find((x) => x.id === r.studyId)!.integrity).toBe(
      "Recovered",
    );
    expect(s.audit).toHaveLength(4);
  });
  it("rejects missing independent evidence and unauthorized mutations", () => {
    const s = initialState();
    expect(() =>
      reduceCommand(
        s,
        { type: "approve", id: "REC-1", reason: "Reviewed" },
        "Administrator",
      ),
    ).toThrow(/reference/);
    expect(() =>
      reduceCommand(s, { type: "simulate" }, "Read-only observer"),
    ).toThrow(/Permission/);
    expect(() =>
      reduceCommand(s, { type: "approve", id: "REC-1" }, "Imaging technician"),
    ).toThrow(/Permission/);
  });
  it("computes reproducible metrics except wall-clock timing", () => {
    const config = {
      seed: 42,
      count: 128,
      missing: 0.2,
      noise: 5,
      corruption: 0.1,
      faults: 1,
      threshold: 0.5,
      abstention: 0.8,
    };
    const strip = () =>
      runExperiment(config).map(({ latency, ...m }) => ({
        ...m,
        measured: Number.isFinite(latency),
      }));
    expect(strip()).toEqual(strip());
    expect(strip()[2].unsafe).toBe(0);
  });
});
