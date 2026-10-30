import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  CircleCheck,
  ScanLine,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Network from "../components/Network";
import CaseExplainer from "../components/CaseExplainer";
import { Badge, PageHeader, Panel, Stat, time } from "../components/ui";
import type { AppState } from "../types";
export default function Overview({ data }: { data: AppState }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [range, setRange] = useState("all");
  const [exampleType, setExampleType] = useState("worklist");
  const example =
    data.studies.find(
      (s) => s.scenario === exampleType && s.integrity !== "Recovered",
    ) ??
    data.studies.find((s) => s.scenario === exampleType) ??
    data.studies[0];
  const studies = useMemo(
    () =>
      data.studies.filter(
        (s) => range === "all" || s.time.startsWith("2026-10-22"),
      ),
    [data.studies, range],
  );
  const verified = studies.filter((s) => s.archive === "Verified").length;
  const incidents = data.investigations.filter((i) => i.status !== "Resolved");
  const integrity = Math.round((verified / studies.length) * 100);
  const pipeline = [
    ["Scheduled", studies.length],
    [
      "Acquired",
      studies.filter((s) => s.events.some((e) => e.type === "Scan acquired"))
        .length,
    ],
    [
      "Transferred",
      studies.filter((s) => s.events.some((e) => e.type === "Storage accepted"))
        .length,
    ],
    [
      "Archived",
      studies.filter((s) =>
        s.events.some((e) => e.type === "Archive retrieved"),
      ).length,
    ],
    ["Verified", verified],
  ] as const;
  return (
    <>
      <PageHeader
        title="Find the scan. Understand what happened."
        description="A scan can be performed but missing from the expected patient record. Here’s how we investigate it."
        actions={
          <>
            <label className="date-select">
              <CalendarDays size={15} />
              <select
                aria-label="Overview date range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="all">22 Oct 2026 · All demo records</option>
                <option value="today">22 Oct 2026 only</option>
              </select>
            </label>
            <button
              className="icon-button bordered"
              aria-label="Refresh dashboard"
              onClick={() => qc.invalidateQueries({ queryKey: ["state"] })}
            >
              <RefreshCw size={17} />
            </button>
          </>
        }
      />
      {example && (
        <CaseExplainer
          study={example}
          investigationId={
            data.investigations.find((i) => i.studyId === example.id)?.id
          }
          selector={
            <label className="example-selector">
              <span>Example</span>
              <select
                aria-label="Example problem"
                value={exampleType}
                onChange={(e) => setExampleType(e.target.value)}
              >
                <option value="worklist">Scan linked incorrectly</option>
                <option value="transfer">Scan transfer failed</option>
                <option value="identity">Patient details conflict</option>
                <option value="healthy">Normal workflow</option>
              </select>
            </label>
          }
        />
      )}
      <div className="stats-grid">
        <Stat
          label="Scans performed"
          value={studies.length}
          detail="Across 3 imaging modalities"
          onClick={() => navigate("/studies")}
        />
        <Stat
          label="Confirmed in the archive"
          value={verified}
          detail={`${integrity}% of examinations verified`}
          onClick={() => navigate("/studies?status=Verified")}
        />
        <Stat
          label="Cases to investigate"
          value={incidents.length}
          detail="Evidence available for review"
          onClick={() => navigate("/investigations")}
        />
        <Stat
          label="Waiting for approval"
          value={
            data.recovery.filter((r) => r.status === "Pending review").length
          }
          detail="Human verification required"
          onClick={() => navigate("/recovery")}
        />
      </div>
      <div className="dashboard-main">
        <Panel
          title="Where we look for evidence"
          subtitle="Select a system to see which records it provides for the example above."
          actions={
            <div className="live-label">
              <span className="live-dot" /> SIMULATION ACTIVE
            </div>
          }
          className="network-panel"
        >
          <Network data={data} study={example} />
          <div className="network-legend">
            <span>
              <i className="legend-dot teal-dot" />
              Observed connection
            </span>
            <span>
              <i className="legend-dot amber-dot" />
              Needs attention
            </span>
            <Link to="/graph">
              Explore evidence graph <ArrowUpRight size={14} />
            </Link>
          </div>
        </Panel>
        <Panel
          title="Can the scans be found?"
          subtitle="Confirmed availability in the image archive"
          className="integrity-panel"
        >
          <div
            className="integrity-ring"
            style={{
              background: `conic-gradient(#167d78 ${integrity}%,#edf1ed 0)`,
            }}
          >
            <div>
              <strong>
                {integrity}
                <span>%</span>
              </strong>
              <small>archive verified</small>
            </div>
          </div>
          <div className="integrity-items">
            <button onClick={() => navigate("/studies?status=Unverified")}>
              <span>
                <i className="legend-dot amber-dot" />
                Unverified examinations
              </span>
              <b>{studies.filter((s) => s.archive === "Unverified").length}</b>
            </button>
            <button
              onClick={() => navigate("/studies?integrity=Identity%20conflict")}
            >
              <span>
                <i className="legend-dot red-dot" />
                Identity conflicts
              </span>
              <b>
                {
                  studies.filter((s) => s.integrity === "Identity conflict")
                    .length
                }
              </b>
            </button>
            <button onClick={() => navigate("/recovery")}>
              <span>
                <i className="legend-dot teal-dot" />
                Verified recoveries
              </span>
              <b>
                {data.recovery.filter((r) => r.status === "Verified").length}
              </b>
            </button>
          </div>
          <div className="quiet-note">
            <ShieldCheck size={15} /> Identity changes always require review.
          </div>
        </Panel>
      </div>
      <Panel
        title="The examination journey"
        subtitle="Where studies move forward. Where they need a hand."
        actions={
          <Link className="text-link" to="/simulator">
            Open simulator <ArrowUpRight size={14} />
          </Link>
        }
      >
        <div className="pipeline">
          {pipeline.map(([label, n], i) => (
            <div className="pipeline-stage" key={label}>
              <span className="stage-number">0{i + 1}</span>
              <div>
                <span>{label}</span>
                <strong>
                  {n}
                  <small> studies</small>
                </strong>
              </div>
              {i === 4 ? <CircleCheck size={22} /> : <ChevronRight size={19} />}
            </div>
          ))}
        </div>
      </Panel>
      <div className="dashboard-bottom">
        <Panel
          title="Investigations requiring attention"
          subtitle="Prioritized by impact. Grounded in source evidence."
          actions={
            <Link className="text-link" to="/investigations">
              View all <ArrowRight size={15} />
            </Link>
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>INVESTIGATION</th>
                  <th>DISCREPANCY</th>
                  <th>PRIORITY</th>
                  <th>DETECTED</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {incidents.slice(0, 4).map((i) => (
                  <tr
                    key={i.id}
                    onClick={() => navigate(`/investigations/${i.id}`)}
                  >
                    <td>
                      <Link to={`/investigations/${i.id}`} className="mono">
                        {i.id}
                      </Link>
                      <small>{i.studyId}</small>
                    </td>
                    <td>{i.category}</td>
                    <td>
                      <Badge>{i.severity}</Badge>
                    </td>
                    <td className="muted">{time(i.detected)} IST</td>
                    <td>
                      <ArrowUpRight size={15} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="Latest activity"
          actions={<span className="tiny-label">AUDIT CONNECTED</span>}
        >
          <div className="activity-list">
            {data.studies.slice(0, 4).map((s, i) => (
              <div key={s.id}>
                <span className={`activity-icon ${i === 1 ? "warm" : ""}`}>
                  {i === 1 ? <ScanLine size={15} /> : <CircleCheck size={15} />}
                </span>
                <div>
                  <strong>{s.events.at(-1)?.type}</strong>
                  <p>
                    {s.id} · {s.device}
                  </p>
                  <small>{time(s.events.at(-1)?.time ?? s.time)} IST</small>
                </div>
              </div>
            ))}
          </div>
          <Link className="activity-link" to="/audit">
            View complete audit trail <ArrowRight size={14} />
          </Link>
        </Panel>
      </div>
      <div className="research-strip">
        <span className="research-mark">
          TEG<span>—</span>UR
        </span>
        <div>
          <strong>Evidence first. Uncertainty acknowledged.</strong>
          <p>Explore the temporal evidence graph behind each recommendation.</p>
        </div>
        <Link to="/research">
          Inside the research <ArrowUpRight size={16} />
        </Link>
      </div>
    </>
  );
}
