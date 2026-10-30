import { lazy, Suspense, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  FileSearch,
  ShieldAlert,
  Check,
  Layers,
} from "lucide-react";
import type { AppState } from "../types";
import {
  Badge,
  Empty,
  PageHeader,
  Panel,
  SearchField,
  time,
} from "../components/ui";
import { useAction } from "../services";
import CaseExplainer from "../components/CaseExplainer";
const EvidenceGraph = lazy(() => import("../components/EvidenceGraph"));
export default function Investigations({
  data,
  graphOnly = false,
}: {
  data: AppState;
  graphOnly?: boolean;
}) {
  const location = useLocation(),
    navigate = useNavigate();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [focused, setFocused] = useState(data.investigations[0]?.id ?? ""),
    [hypothesis, setHypothesis] = useState(0);
  const action = useAction();
  const id = graphOnly ? focused : location.pathname.split("/")[2];
  const investigation = data.investigations.find((i) => i.id === id);
  const study = data.studies.find((s) => s.id === investigation?.studyId);
  const rows = data.investigations.filter(
    (i) =>
      `${i.id} ${i.category} ${i.studyId} ${i.reviewer}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" || i.status === filter),
  );
  if ((graphOnly || id) && study && investigation)
    return (
      <>
        <Link className="back-link" to="/investigations">
          <ArrowLeft size={14} /> All investigations
        </Link>
        <PageHeader
          title={graphOnly ? "Follow the evidence" : investigation.category}
          eyebrow={`${investigation.id} / EVIDENCE WORKSPACE`}
          description="Check what happened, open the source records, and decide the next safe step."
          actions={
            <>
              <select
                aria-label="Focus investigation"
                value={investigation.id}
                onChange={(e) =>
                  graphOnly
                    ? setFocused(e.target.value)
                    : navigate(`/investigations/${e.target.value}`)
                }
              >
                {data.investigations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.id} · {i.category}
                  </option>
                ))}
              </select>
              <button
                className="button primary"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({ type: "analyze", id: investigation.id })
                }
              >
                <FileSearch size={15} /> Analyze evidence
              </button>
            </>
          }
        />
        {!graphOnly && <CaseExplainer study={study} />}
        <div className="investigation-layout">
          <Panel title="Case context" className="case-context">
            <Badge>{investigation.severity}</Badge>
            <h3>{study.id}</h3>
            <p>{study.description}</p>
            <dl>
              <dt>Patient identifier</dt>
              <dd className="mono">{study.patient}</dd>
              <dt>Accession number</dt>
              <dd>{study.accession || "Not recorded"}</dd>
              <dt>Modality / device</dt>
              <dd>
                {study.modality} · {study.device}
              </dd>
              <dt>Detected at</dt>
              <dd>{time(investigation.detected)} IST</dd>
              <dt>Review state</dt>
              <dd>
                <Badge>{investigation.status}</Badge>
              </dd>
              <dt>Reviewer</dt>
              <dd>{investigation.reviewer}</dd>
            </dl>
            <button
              className="button full"
              onClick={() =>
                action.mutate({ type: "assign", id: investigation.id })
              }
            >
              Assign to me
            </button>
            <div className="evidence-completeness">
              <span>Workflow events observed</span>
              <strong>{study.events.length} / 7 expected</strong>
              <progress value={study.events.length} max="7" />
              <small>Completeness is not confidence.</small>
            </div>
          </Panel>
          <Panel
            title="Temporal evidence graph"
            subtitle="Each box is a recorded event. Select it to see where it came from."
            className="investigation-graph"
          >
            <Suspense fallback={<p>Loading graph…</p>}>
              <EvidenceGraph study={study} />
            </Suspense>
          </Panel>
          <Panel title="What the evidence suggests" className="findings">
            <div className="finding-label">
              <Layers size={15} /> TEG-UR · INTERPRETABLE RULES
            </div>
            <h3>{investigation.category}</h3>
            <Badge tone="amber">
              {["duplicate", "acknowledgement"].includes(study.scenario)
                ? "Insufficient evidence"
                : "Supported hypothesis"}
            </Badge>
            <p>
              {study.scenario === "identity"
                ? "Observed patient identifier disagrees with the candidate order. Similarity cannot establish identity."
                : study.scenario === "acknowledgement"
                  ? "Transport evidence does not establish storage commitment or archive retrievability."
                  : study.scenario === "duplicate"
                    ? "Multiple plausible orders remain. Timing and modality alone cannot resolve the association."
                    : "The observed source events support this explanation. Independent verification is required before any correction."}
            </p>
            <div className="finding-tabs">
              <button
                className={hypothesis === 0 ? "active" : ""}
                onClick={() => setHypothesis(0)}
              >
                Records we have
              </button>
              <button
                className={hypothesis === 1 ? "active" : ""}
                onClick={() => setHypothesis(1)}
              >
                Still uncertain
              </button>
            </div>
            {hypothesis === 0 ? (
              <ul className="evidence-list">
                {study.events.slice(-3).map((e) => (
                  <li key={e.id}>
                    <Check size={14} />
                    <div>
                      {e.type}
                      <small>
                        {e.id} · {e.source} · {time(e.time)}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="callout">
                <strong>Alternative explanation</strong>
                <p>
                  Missing source events or device clock differences can produce
                  an incomplete sequence.
                </p>
                <small>
                  Missing: independent source reconciliation, archive query
                  confirmation. No calibrated probabilities are available.
                </small>
              </div>
            )}
            <div className="safety-note">
              <ShieldAlert size={18} />
              <div>
                <strong>Human verification required</strong>
                <p>
                  {study.integrity === "Identity conflict"
                    ? "Hard identity conflict. Automatic association is blocked."
                    : "Review original source evidence before approving a limited simulated action."}
                </p>
              </div>
            </div>
            <Link
              className="button primary full"
              to={`/recovery?study=${study.id}`}
            >
              Review recovery options <ArrowUpRight size={15} />
            </Link>
          </Panel>
        </div>
        <Panel
          title="Orders that may belong to this scan"
          subtitle="Compare the identifiers and source records. A higher score does not prove a patient match."
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>PATIENT / AUTHORITY</th>
                  <th>ACCESSION</th>
                  <th>MODALITY</th>
                  <th>TIME Δ</th>
                  <th>RANKING</th>
                  <th>CONSTRAINT</th>
                </tr>
              </thead>
              <tbody>
                {study.candidates.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.id}</td>
                    <td>
                      {c.patient}
                      <small>{c.issuer}</small>
                    </td>
                    <td>{c.accession}</td>
                    <td>{c.modality}</td>
                    <td>{c.delta} min</td>
                    <td>{c.score} points</td>
                    <td>
                      <Badge tone={c.conflict ? "red" : "amber"}>
                        {c.conflict
                          ? "Identity conflict"
                          : "Requires verification"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </>
    );
  return (
    <>
      <PageHeader
        title="A discrepancy is a starting point"
        eyebrow="WORKSPACE / INVESTIGATIONS"
        description="Understand what happened, what is known, and what needs a second look."
      />
      <div className="mini-metrics">
        <span>
          <strong>{rows.length}</strong> investigations
        </span>
        <span>
          <strong>
            {rows.filter((i) => i.severity === "Critical").length}
          </strong>{" "}
          critical priority
        </span>
        <span>
          <strong>{rows.filter((i) => i.status === "Resolved").length}</strong>{" "}
          resolved with verification
        </span>
      </div>
      <Panel>
        <div className="toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search investigations…"
          />
          <select
            aria-label="Investigation status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All review states</option>
            {[
              "Open",
              "Investigating",
              "Awaiting verification",
              "Recovery proposed",
              "Approved",
              "Rejected",
              "Resolved",
              "Closed without correction",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CASE / STUDY</th>
                <th>DETECTED ISSUE</th>
                <th>PRIORITY</th>
                <th>REVIEW STATE</th>
                <th>EVIDENCE</th>
                <th>REVIEWER</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link
                      className="mono table-link"
                      to={`/investigations/${i.id}`}
                    >
                      {i.id}
                    </Link>
                    <small>{i.studyId}</small>
                  </td>
                  <td>{i.category}</td>
                  <td>
                    <Badge>{i.severity}</Badge>
                  </td>
                  <td>
                    <Badge>{i.status}</Badge>
                  </td>
                  <td>
                    <progress value={i.completeness} max="100" />
                    <small>{i.completeness}% events present</small>
                  </td>
                  <td>
                    {i.reviewer}
                    <small>{time(i.detected)} IST</small>
                  </td>
                  <td>
                    <Link
                      aria-label={`Open ${i.id}`}
                      to={`/investigations/${i.id}`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="No investigations found"
            detail="Adjust your search or run a workflow simulation."
          />
        )}
      </Panel>
    </>
  );
}
