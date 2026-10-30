import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  FileSearch,
  ScanLine,
  ShieldCheck,
  Check,
  CircleHelp,
} from "lucide-react";
import type { Study } from "../types";
import { Badge, Modal, time } from "./ui";

function explain(study: Study) {
  if (study.integrity === "Recovered")
    return {
      problem: "This scan needed help reaching the right record.",
      detail:
        "A reviewer approved an action, and a separate retrieval check confirmed the result.",
      gap: "The review and retrieval records now explain the outcome.",
      solution: "Check the recovery record.",
      next: "The original source evidence is retained so the decision can be reviewed.",
    };
  if (study.scenario === "identity" || study.scenario === "duplicate")
    return {
      problem: "We cannot safely tell which patient this scan belongs to.",
      detail:
        study.scenario === "identity"
          ? "The identifier on the scan disagrees with the order record."
          : "More than one order could match this examination.",
      gap: "A similar name, scan type, or appointment time does not prove identity.",
      solution: "Stop and verify the patient.",
      next: "Ask an authorized reviewer for independent identity evidence. Reassignment stays blocked while the conflict remains.",
    };
  if (study.scenario === "transfer" || study.scenario === "compound")
    return {
      problem: "The scan was taken, but its transfer failed.",
      detail:
        "The scanner recorded the examination. The transfer log records an interruption before archive availability was confirmed.",
      gap:
        study.scenario === "compound"
          ? "The order reference is also missing, so both gaps need review."
          : "We still need a successful archive retrieval, not just a sent message.",
      solution: "Review the failure, then retry safely.",
      next: "An authorized reviewer approves the simulated retry. Retrieve the image afterward and check its identifiers before calling it recovered.",
    };
  if (study.scenario === "acknowledgement")
    return {
      problem: "The scan was sent, but we cannot confirm it is available.",
      detail:
        "A transfer attempt is recorded. A reliable archive retrieval record is missing.",
      gap: "Missing confirmation does not mean the image is permanently lost.",
      solution: "Check the archive before taking action.",
      next: "Request a fresh archive query and retrieval check. If an action is needed, a reviewer must approve it first.",
    };
  if (study.scenario === "healthy")
    return {
      problem: "This scan has completed the normal workflow.",
      detail:
        "The examination was ordered, acquired, transferred, and confirmed in the archive.",
      gap: "No discrepancy was detected in this demonstration.",
      solution: "No recovery action is needed.",
      next: "Keep the source records available so the path from order to scan can be checked.",
    };
  return {
    problem: "The scan exists, but its link to the patient’s order is unclear.",
    detail:
      study.scenario === "worklist"
        ? `The scanner used ${study.patient}. The candidate order uses ${study.candidates[0]?.patient ?? "a different identifier"}.`
        : "The scan has no accession number — the reference that connects it to an imaging order.",
    gap:
      study.scenario === "worklist"
        ? "The worklist selection record is missing. A skipped worklist is a possible explanation, not a confirmed cause."
        : "Other records may suggest an order, but a suggestion is not a verified association.",
    solution: "Verify the order, then restore the link.",
    next: "A reviewer checks independent source records and approves a simulated correction. Then retrieve the scan and verify the identifiers.",
  };
}

export default function CaseExplainer({
  study,
  investigationId,
  selector,
}: {
  study: Study;
  investigationId?: string;
  selector?: ReactNode;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const copy = explain(study);
  const order = study.events.find((e) => e.type === "Order created");
  const scan = study.events.find((e) => e.type === "Scan acquired");
  const transfer = study.events.find(
    (e) => e.type === "Transfer failed" || e.type === "Transfer attempted",
  );
  const archive = study.events.find((e) => e.type === "Archive retrieved");
  const sources = [
    {
      name: "Hospital scheduling system",
      question: "What was ordered, and for whom?",
      event: order,
      detail: study.candidates.length
        ? `${study.candidates.length} candidate order${study.candidates.length === 1 ? "" : "s"} available for comparison.`
        : "No candidate order is available.",
    },
    {
      name: "Scanner / acquisition log",
      question: "Was the scan actually performed?",
      event: scan,
      detail: `${study.device} · ${study.modality} · original patient ID ${study.patient}`,
    },
    {
      name: "Transfer service log",
      question: "Was delivery attempted, or did it fail?",
      event: transfer,
      detail: transfer?.detail ?? "Request the original transfer log.",
    },
    {
      name: "Image archive (PACS)",
      question: "Can the stored scan be retrieved?",
      event: archive,
      detail: archive
        ? "An archive retrieval event exists. Patient association must still be verified separately."
        : "A successful retrieval record is still needed.",
    },
  ];
  return (
    <section
      className="case-explainer"
      aria-label="Problem, evidence and solution"
    >
      <div className="case-explainer-heading">
        <div>
          <span className="eyebrow">UNDERSTAND ONE CASE</span>
          <span className="case-reference">
            {study.id} <span>·</span> Synthetic example
          </span>
        </div>
        {selector}
      </div>
      <div className="explanation-steps">
        <article>
          <div className="explanation-label">
            <span>1</span>
            <ScanLine size={16} /> The problem
          </div>
          <h2>{copy.problem}</h2>
          <p>{copy.detail}</p>
          <Link className="text-link" to={`/studies?study=${study.id}`}>
            See the scan record <ArrowRight size={14} />
          </Link>
        </article>
        <article>
          <div className="explanation-label">
            <span>2</span>
            <FileSearch size={16} /> Where we get evidence
          </div>
          <h2>Compare the records left by each system.</h2>
          <p>
            The hospital’s order, the scanner log, the scan’s metadata, and the
            transfer and archive records.
          </p>
          <button className="text-button" onClick={() => setEvidenceOpen(true)}>
            Show the source records <ArrowRight size={14} />
          </button>
        </article>
        <article>
          <div className="explanation-label">
            <span>3</span>
            <ShieldCheck size={16} /> The safe next step
          </div>
          <h2>{copy.solution}</h2>
          <p>{copy.next}</p>
          {study.scenario === "healthy" ? (
            <Link className="text-link" to={`/studies?study=${study.id}`}>
              Check the completed workflow <ArrowRight size={14} />
            </Link>
          ) : (
            <Link
              className="text-link"
              to={
                investigationId
                  ? `/investigations/${investigationId}`
                  : `/recovery?study=${study.id}`
              }
            >
              {investigationId
                ? "Follow this investigation"
                : "Review the proposed action"}{" "}
              <ArrowRight size={14} />
            </Link>
          )}
        </article>
      </div>
      <div className="explanation-gap">
        <CircleHelp size={15} />
        <p>
          <strong>What this means:</strong> {copy.gap}
        </p>
      </div>
      <Modal
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        title="Where does the evidence come from?"
        description={`${study.id} · These are synthetic source records for this case, not live hospital connections.`}
      >
        <div className="source-guide">
          {sources.map((source) => (
            <section key={source.name}>
              <div className="source-guide-title">
                <h3>{source.name}</h3>
                <Badge tone={source.event ? "green" : "amber"}>
                  {source.event ? "Record available" : "Record missing"}
                </Badge>
              </div>
              <p>{source.question}</p>
              <small>{source.detail}</small>
              {source.event && (
                <details>
                  <summary>
                    <Check size={13} /> Inspect {source.event.id}
                  </summary>
                  <dl>
                    <dt>Recorded event</dt>
                    <dd>{source.event.type}</dd>
                    <dt>Source / timestamp</dt>
                    <dd>
                      {source.event.source} · {time(source.event.time)} IST
                    </dd>
                    <dt>Original record</dt>
                    <dd>{source.event.detail}</dd>
                  </dl>
                </details>
              )}
            </section>
          ))}
        </div>
        <div className="metadata-explanation">
          <h3>Inside the scan file: DICOM metadata</h3>
          <p>
            These fields help compare the image with an order. They do not, by
            themselves, prove the patient’s identity.
          </p>
          <dl>
            <dt>Original patient ID</dt>
            <dd>{study.patient}</dd>
            <dt>Order reference (accession)</dt>
            <dd>{study.accession || "Not recorded"}</dd>
            <dt>Unique scan identifier</dt>
            <dd className="mono">{study.uid}</dd>
          </dl>
        </div>
        <p className="callout">
          SonoRescue compares these records and proposes an explanation. A
          missing record is a gap in evidence, not proof that a scan was lost.
        </p>
      </Modal>
    </section>
  );
}
