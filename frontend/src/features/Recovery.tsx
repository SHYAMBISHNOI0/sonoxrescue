import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  LockKeyhole,
} from "lucide-react";
import type { AppState, Recovery as RecoveryType } from "../types";
import {
  Badge,
  Empty,
  Field,
  Modal,
  PageHeader,
  Panel,
  SearchField,
} from "../components/ui";
import { useAction, usePreferences } from "../services";
export default function Recovery({ data }: { data: AppState }) {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("study") ?? ""),
    [status, setStatus] = useState("all"),
    [selected, setSelected] = useState<RecoveryType | null>(null),
    [decision, setDecision] = useState<"approve" | "reject">("approve"),
    [reason, setReason] = useState(""),
    [evidence, setEvidence] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const action = useAction();
  const role = usePreferences((s) => s.role);
  const allowed = [
    "Administrator",
    "Clinical safety reviewer",
    "Radiology reviewer",
  ].includes(role);
  const rows = data.recovery.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      `${r.id} ${r.studyId} ${r.action}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const open = (r: RecoveryType, d: "approve" | "reject") => {
    setSelected(r);
    setDecision(d);
    setReason("");
    setEvidence("");
    setConfirmed(false);
  };
  return (
    <>
      <PageHeader
        title="Recovery, with a human in the loop"
        eyebrow="WORKSPACE / RECOVERY CENTER"
        description="Evidence-backed actions. Explicit approvals. Independently verified outcomes."
      />
      <div className="safety-banner">
        <ShieldCheck size={22} />
        <div>
          <strong>Patient identity is a boundary, not a best guess.</strong>
          <p>
            Conflicting identities cannot be approved. All changes apply only to
            this simulated environment.
          </p>
        </div>
      </div>
      {!allowed && (
        <div className="callout" role="alert">
          <LockKeyhole size={18} /> Your {role.toLowerCase()} role cannot
          approve or execute recovery actions.
        </div>
      )}
      <Panel>
        <div className="toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search recovery actions or studies…"
          />
          <select
            aria-label="Recovery state"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All recovery states</option>
            {[
              "Pending review",
              "Approved",
              "Executed",
              "Verified",
              "Rejected",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="recovery-list">
          {rows.map((r) => {
            const s = data.studies.find((x) => x.id === r.studyId)!;
            const blocked = ["identity", "duplicate"].includes(s.scenario);
            return (
              <article className="recovery-card" key={r.id}>
                <div className={`recovery-icon ${blocked ? "blocked" : ""}`}>
                  {blocked ? (
                    <ShieldAlert size={23} />
                  ) : (
                    <ShieldCheck size={23} />
                  )}
                </div>
                <div className="recovery-main">
                  <div className="recovery-title">
                    <h3>{r.action}</h3>
                    <Badge>{r.status}</Badge>
                  </div>
                  <p>
                    <span className="mono">
                      {r.id} · {r.studyId}
                    </span>{" "}
                    <span>·</span> {s.patient} <span>·</span> {s.modality}
                  </p>
                  {blocked ? (
                    <div className="blocked-note">
                      <LockKeyhole size={13} /> Unresolved identity conflict ·
                      approval blocked
                    </div>
                  ) : (
                    <small>
                      {s.events.length} source events · independent verification
                      required
                    </small>
                  )}
                  <details>
                    <summary>Compare candidate evidence</summary>
                    <div className="candidate-cards">
                      {s.candidates.map((c) => (
                        <div key={c.id}>
                          <strong>{c.id}</strong>
                          <dl>
                            <dt>Patient / issuer</dt>
                            <dd>
                              {c.patient} / {c.issuer}
                            </dd>
                            <dt>Accession</dt>
                            <dd>{c.accession}</dd>
                            <dt>Timing / modality</dt>
                            <dd>
                              {c.delta} min / {c.modality}
                            </dd>
                            <dt>Source evidence</dt>
                            <dd>{c.evidence.join(", ")}</dd>
                            <dt>Constraint</dt>
                            <dd>
                              {c.conflict
                                ? "Conflicting identity — blocked"
                                : "Independent verification required"}
                            </dd>
                          </dl>
                        </div>
                      ))}
                    </div>
                  </details>
                  {r.evidence && (
                    <small>
                      Reviewer: {r.reviewer} · Verification: {r.evidence}
                    </small>
                  )}
                </div>
                <div className="recovery-actions">
                  <Link
                    className="text-link"
                    to={`/investigations/${r.investigationId}`}
                  >
                    Evidence <ArrowRight size={14} />
                  </Link>
                  {r.status === "Pending review" && (
                    <>
                      <button
                        className="button primary small"
                        disabled={!allowed || blocked}
                        onClick={() => open(r, "approve")}
                      >
                        {blocked ? "Association blocked" : "Review & approve"}
                      </button>
                      <button
                        className="button small"
                        disabled={!allowed}
                        onClick={() => open(r, "reject")}
                      >
                        Reject action
                      </button>
                    </>
                  )}
                  {r.status === "Approved" && (
                    <button
                      className="button primary"
                      disabled={!allowed || action.isPending}
                      onClick={() =>
                        action.mutate({ type: "execute", id: r.id })
                      }
                    >
                      Execute simulation
                    </button>
                  )}
                  {r.status === "Executed" && (
                    <button
                      className="button primary"
                      disabled={!allowed || action.isPending}
                      onClick={() =>
                        action.mutate({ type: "verify", id: r.id })
                      }
                    >
                      Verify retrieval
                    </button>
                  )}
                  {r.status === "Verified" && (
                    <span className="verified-note">
                      <ShieldCheck size={15} /> Retrieval confirmed
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {!rows.length && (
          <Empty
            title="No recovery actions in this view"
            detail="Change the filters or create a workflow discrepancy in the simulator."
          />
        )}
      </Panel>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          decision === "approve"
            ? "Approve a limited simulated action"
            : "Reject proposed recovery"
        }
        description="Your decision and verification references will be recorded in the audit trail."
      >
        <p>
          <strong>{selected?.id}</strong> · {selected?.action}
        </p>
        <Field label="Reason for decision">
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe what you verified and why this action is appropriate."
          />
        </Field>
        {decision === "approve" && (
          <>
            <Field label="Independent verification reference">
              <input
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="e.g. Demo worklist log RIS-42, verified by reviewer"
              />
            </Field>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I reviewed the source records and confirmed no unresolved identity
              conflict.
            </label>
            <div className="callout">
              Approval does not mean recovery succeeded. Execution and retrieval
              verification are separate steps.
            </div>
          </>
        )}
        <button
          className={`button ${decision === "approve" ? "primary" : "danger"}`}
          disabled={
            !reason.trim() ||
            (decision === "approve" && (!evidence.trim() || !confirmed)) ||
            action.isPending
          }
          onClick={() =>
            action.mutate(
              { type: decision, id: selected?.id, reason, evidence },
              { onSuccess: () => setSelected(null) },
            )
          }
        >
          {decision === "approve" ? "Confirm approval" : "Confirm rejection"}
        </button>
      </Modal>
    </>
  );
}
