import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  Check,
  Maximize2,
  ShieldCheck,
  ScanLine,
  CircleAlert,
} from "lucide-react";
import type { AppState, Scenario } from "../types";
import { scenarios, stages } from "../mocks/fixtures";
import { Badge, Modal, PageHeader, Panel } from "../components/ui";
import { useAction, usePreferences } from "../services";
const scenes = [
  "A healthy beginning",
  "A hidden workflow failure",
  "Detection & investigation",
  "Reconstruct the evidence",
  "Human-reviewed recovery",
  "Verify archive retrieval",
  "Abstain on identity conflict",
  "Compare research methods",
];
export default function Simulator({ data }: { data: AppState }) {
  const [params] = useSearchParams();
  const [scenario, setScenario] = useState<Scenario>("worklist"),
    [step, setStep] = useState(-1),
    [playing, setPlaying] = useState(false),
    [created, setCreated] = useState(""),
    [guided, setGuided] = useState(params.has("guided")),
    [scene, setScene] = useState(0),
    [reset, setReset] = useState(false);
  const action = useAction();
  const { role, notify } = usePreferences();
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (step >= 6) {
        setPlaying(false);
        return;
      }
      setStep((s) => s + 1);
    }, 950);
    return () => clearTimeout(t);
  }, [playing, step]);
  const preset = scenarios.find((s) => s.id === scenario)!;
  async function finish() {
    const next = await action
      .mutateAsync({ type: "simulate", scenario })
      .catch(() => null);
    if (next) {
      setCreated(next.studies[0].id);
      setStep(6);
      setPlaying(false);
    }
  }
  function restart() {
    setPlaying(false);
    setStep(-1);
    setCreated("");
  }
  const failed = ["transfer", "compound"].includes(scenario);
  const blocked = scenario === "identity" || scenario === "duplicate";
  return (
    <>
      <PageHeader
        title="See how a study gets lost"
        eyebrow="WORKSPACE / WORKFLOW SIMULATOR"
        description="Introduce a failure. Follow the evidence. Make the next decision safely."
        actions={
          <>
            <button className="button" onClick={() => setGuided(!guided)}>
              <Play size={15} /> {guided ? "Hide guided demo" : "Guided demo"}
            </button>
            <button
              className="icon-button bordered"
              aria-label="Presentation mode"
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen();
                else
                  document.documentElement
                    .requestFullscreen()
                    .catch(() =>
                      notify("Fullscreen is unavailable in this browser."),
                    );
              }}
            >
              <Maximize2 size={17} />
            </button>
          </>
        }
      />
      {guided && (
        <div className="guided-banner">
          <span className="demo-step">
            {scene + 1}
            <small>/ 8</small>
          </span>
          <div>
            <small>GUIDED DEMONSTRATION</small>
            <h3>{scenes[scene]}</h3>
            <p>
              {
                [
                  "Run a healthy workflow and confirm no incident is generated.",
                  "Choose worklist bypass; observe the absent scheduling relationship.",
                  "Complete the run and open its new investigation.",
                  "Use the graph timeline to inspect source provenance.",
                  "Open Recovery Center and record independent verification.",
                  "Execute the approved simulation, then verify retrieval.",
                  "Run an identity conflict; demonstrate the blocked approval.",
                  "Run a seeded experiment and inspect measured results.",
                ][scene]
              }
            </p>
          </div>
          <div>
            <button
              className="button small"
              disabled={!scene}
              onClick={() => setScene(scene - 1)}
            >
              Previous
            </button>
            <button
              className="button primary small"
              disabled={scene === 7}
              onClick={() => {
                setScene(scene + 1);
                if (scene === 0) {
                  setScenario("worklist");
                  restart();
                }
                if (scene === 5) {
                  setScenario("identity");
                  restart();
                }
              }}
            >
              Next scene
            </button>
          </div>
        </div>
      )}
      <div className="simulator-layout">
        <Panel
          title="Choose a scenario"
          subtitle="Eight reproducible paths through the workflow."
        >
          <div className="scenario-list">
            {scenarios.map((s, i) => (
              <button
                className={scenario === s.id ? "selected" : ""}
                key={s.id}
                onClick={() => {
                  setScenario(s.id);
                  restart();
                }}
              >
                <span className="scenario-number">0{i + 1}</span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.description}</p>
                </div>
                {scenario === s.id && <Check size={17} />}
              </button>
            ))}
          </div>
        </Panel>
        <div>
          <Panel
            title={preset.title}
            subtitle={preset.description}
            actions={<Badge tone="neutral">SIMULATION ONLY</Badge>}
          >
            <div className="simulation-stage">
              <div className={`scan-device ${playing ? "scanning" : ""}`}>
                <div className="scan-device-top">
                  <ScanLine size={54} />
                  <div className="scan-sweep" />
                </div>
                <div className="scan-device-base" />
                <span>MODALITY SIMULATOR</span>
              </div>
              <div className="stage-display">
                <small>WORKFLOW STATE {Math.max(0, step + 1)} / 7</small>
                <h2>{step < 0 ? "Ready when you are" : stages[step]}</h2>
                <p>
                  {step >= 4 && failed
                    ? "Transfer interrupted. No archive receipt is available."
                    : step >= 2 && scenario === "worklist"
                      ? "Acquisition proceeds with a local identifier. The worklist selection is absent."
                      : step >= 3 && blocked
                        ? "Patient association requires review. No automatic reassignment is permitted."
                        : "Each source event becomes part of the investigation record."}
                </p>
                <Badge
                  tone={
                    step >= 4 && failed
                      ? "red"
                      : step >= 2 && scenario !== "healthy"
                        ? "amber"
                        : "green"
                  }
                >
                  {step < 0
                    ? "Ready"
                    : step === 6
                      ? "Ready to publish evidence"
                      : step >= 4 && failed
                        ? "Interrupted"
                        : "In progress"}
                </Badge>
              </div>
            </div>
            <div className="simulation-steps">
              {stages.map((s, i) => (
                <div
                  key={s}
                  className={`${step >= i ? "complete" : ""} ${i === 2 && scenario === "worklist" && step >= 2 ? "fault" : ""} ${i === 4 && failed && step >= 4 ? "fault" : ""}`}
                >
                  <span>
                    {i === 2 && scenario === "worklist" && step >= 2 ? (
                      <CircleAlert size={14} />
                    ) : step >= i ? (
                      <Check size={14} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <small>{s}</small>
                </div>
              ))}
            </div>
            <div className="simulation-controls">
              <button
                className="button primary"
                disabled={!!created}
                onClick={() => {
                  setPlaying(!playing);
                  if (step === 6) setStep(-1);
                }}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
                {playing ? "Pause" : "Run workflow"}
              </button>
              <button
                className="button"
                disabled={step === 6 || !!created}
                onClick={() => {
                  setPlaying(false);
                  setStep((s) => Math.min(6, s + 1));
                }}
              >
                Next event <ArrowRight size={15} />
              </button>
              <button
                className="icon-button bordered"
                aria-label="Reset current run"
                onClick={restart}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </Panel>
          <Panel title="Expected safe response">
            <div className="expected-response">
              <ShieldCheck size={24} />
              <div>
                <h3>{preset.expected}</h3>
                <p>
                  {blocked
                    ? "SonoRescue must abstain when identity evidence conflicts. A ranking score cannot override this safety boundary."
                    : "Evidence is retained throughout the simulation. Recovery is considered complete only after a separate retrieval verification."}
                </p>
              </div>
            </div>
            <div className="panel-action-footer">
              {created ? (
                <>
                  <Badge tone="green">Run recorded · {created}</Badge>
                  <Link
                    className="button primary"
                    to={
                      scenario === "healthy"
                        ? `/studies?study=${created}`
                        : `/investigations/${data.investigations.find((i) => i.studyId === created)?.id ?? ""}`
                    }
                  >
                    Inspect results <ArrowRight size={15} />
                  </Link>
                </>
              ) : (
                <>
                  <small>
                    Publish this run to studies, investigations, and audit.
                  </small>
                  <button
                    className="button primary"
                    disabled={
                      step < 6 ||
                      action.isPending ||
                      role === "Read-only observer"
                    }
                    onClick={finish}
                  >
                    Complete simulation <ArrowRight size={15} />
                  </button>
                </>
              )}
            </div>
          </Panel>
          <button className="text-button" onClick={() => setReset(true)}>
            Reset the entire demo environment
          </button>
        </div>
      </div>
      <Modal
        open={reset}
        onClose={() => setReset(false)}
        title="Reset synthetic environment"
        description="This replaces local simulated studies, experiments, and review decisions with the original deterministic fixtures."
      >
        <p>
          Only an administrator can reset the demo. Export research results
          first if you want to retain them.
        </p>
        <button
          className="button danger"
          onClick={() => {
            action.mutate(
              { type: "reset" },
              {
                onSuccess: () => {
                  restart();
                  setReset(false);
                },
              },
            );
          }}
        >
          Reset demo data
        </button>
      </Modal>
    </>
  );
}
