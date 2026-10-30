import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import {
  Activity,
  Database,
  Server,
  ShieldCheck,
  Download,
  Play,
  RefreshCw,
  Check,
  ArrowUpRight,
} from "lucide-react";
import type { AppState, ExperimentConfig, Role } from "../types";
import {
  Badge,
  Empty,
  ExportButton,
  Field,
  PageHeader,
  Panel,
  SearchField,
  Stat,
  csv,
  download,
} from "../components/ui";
import { isHttp, useAction, usePreferences } from "../services";
import { scenarios } from "../mocks/fixtures";
export default function Insights({
  data,
  page,
}: {
  data: AppState;
  page: string;
}) {
  if (page === "analytics") return <Analytics data={data} />;
  if (page === "audit") return <Audit data={data} />;
  if (page === "health") return <Health data={data} />;
  if (page === "research") return <Research data={data} />;
  return <Settings data={data} />;
}
function Analytics({ data }: { data: AppState }) {
  const [modality, setModality] = useState("all"),
    [system, setSystem] = useState("all"),
    [category, setCategory] = useState("all"),
    [date, setDate] = useState("");
  const studies = data.studies.filter(
    (s) =>
      (modality === "all" || s.modality === modality) &&
      (system === "all" || s.system === system) &&
      (category === "all" || s.scenario === category) &&
      (!date || s.time.startsWith(date)),
  );
  const counts = scenarios.map((s) => ({
    name: s.title.replace("workflow", "").replace("identifier", "ID"),
    count: studies.filter((x) => x.scenario === s.id).length,
  }));
  const latencies = data.investigations.flatMap(i => {
    const study=studies.find(s=>s.id===i.studyId);
    return study ? [(Date.parse(i.detected)-Date.parse(study.time))/60000] : [];
  });
  const averageLatency=latencies.length?latencies.reduce((a,b)=>a+b,0)/latencies.length:null;
  const trend = [...new Set(studies.map((s) => s.time.slice(11, 13)))]
    .sort()
    .map((hour) => ({
      hour: `${hour}:00 UTC`,
      verified: studies.filter(
        (s) => s.time.slice(11, 13) === hour && s.archive === "Verified",
      ).length,
      review: studies.filter(
        (s) => s.time.slice(11, 13) === hour && s.integrity !== "Healthy",
      ).length,
    }));
  return (
    <>
      <PageHeader
        title="The patterns behind the pipeline"
        eyebrow="WORKSPACE / ANALYTICS"
        description="Operational measurements derived from the current synthetic environment."
        actions={<ExportButton data={counts} />}
      />
      <div className="toolbar standalone">
        <select
          aria-label="Analytics modality"
          value={modality}
          onChange={(e) => setModality(e.target.value)}
        >
          <option value="all">All modalities</option>
          <option>US</option>
          <option>CT</option>
          <option>MR</option>
        </select>
        <select
          aria-label="Analytics system"
          value={system}
          onChange={(e) => setSystem(e.target.value)}
        >
          <option value="all">All systems</option>
          <option>Main campus</option>
          <option>North wing</option>
        </select>
        <select
          aria-label="Failure category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Analytics date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="stats-grid">
        <Stat
          label="Examinations in view"
          value={studies.length}
          detail="Current filters"
          onClick={() => download("analytics-studies.json", studies)}
        />
        <Stat
          label="Archive verified"
          value={studies.filter((s) => s.archive === "Verified").length}
          detail="Verified availability"
          onClick={() =>
            download(
              "archive-status.json",
              studies.map((s) => ({ id: s.id, archive: s.archive })),
            )
          }
        />
        <Stat
          label="Review escalation"
          value={`${Math.round((studies.filter((s) => s.integrity !== "Healthy").length / Math.max(1, studies.length)) * 100)}%`}
          detail="Non-healthy studies / studies"
          onClick={() =>
            download(
              "review-queue.json",
              studies.filter((s) => s.integrity !== "Healthy"),
            )
          }
        />
        <Stat
          label="Detection latency"
          value={averageLatency===null?'—':`${averageLatency.toFixed(1)} min`}
          detail="Detection minus acquisition time"
          onClick={() =>
            download("latency-definition.json", {
              minutes: averageLatency,
              source: "Fixture detection time minus acquisition time",
              measured: false,
            })
          }
        />
      </div>
      <div className="two-columns">
        <Panel
          title="Integrity over acquisition time"
          subtitle="Counts by acquisition hour · UTC"
        >
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area dataKey="verified" stroke="#167d78" fill="#e4f2ef" />
                <Area dataKey="review" stroke="#b97a27" fill="#fcf0d9" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Workflow categories"
          subtitle="Select a category below to inspect its source records."
        >
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={counts}
                layout="vertical"
                margin={{ left: 30, right: 20 }}
              >
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#167d78" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <div className="two-columns">
        <Panel title="Archive verification">
          <div className="distribution">
            {["Verified", "Unverified", "Transfer failed", "Missing"].map(
              (s) => (
                <Link key={s} to={`/studies?status=${encodeURIComponent(s)}`}>
                  <Badge>{s}</Badge>
                  <strong>
                    {studies.filter((x) => x.archive === s).length}
                  </strong>
                  <ArrowUpRight size={15} />
                </Link>
              ),
            )}
          </div>
        </Panel>
        <Panel title="Recovery outcomes">
          <div className="distribution">
            {[
              "Pending review",
              "Approved",
              "Executed",
              "Verified",
              "Rejected",
            ].map((s) => (
              <Link key={s} to="/recovery">
                <Badge>{s}</Badge>
                <strong>
                  {
                    data.recovery.filter(
                      (r) =>
                        r.status === s &&
                        studies.some((x) => x.id === r.studyId),
                    ).length
                  }
                </strong>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        </Panel>
      </div>
      <p className="callout">
        Detection precision, recall, false-positive rate, and unsafe match rate
        require ground truth. These are measured separately in Research Lab;
        operational charts do not establish research efficacy.
      </p>
    </>
  );
}
function Audit({ data }: { data: AppState }) {
  const [query, setQuery] = useState(""),
    [action, setAction] = useState("all");
  const role = usePreferences((s) => s.role);
  const rows = data.audit.filter(
    (a) =>
      JSON.stringify(a).toLowerCase().includes(query.toLowerCase()) &&
      (action === "all" || a.action === action),
  );
  return (
    <>
      <PageHeader
        title="A record of every decision"
        eyebrow="WORKSPACE / AUDIT TRAIL"
        description="Who acted, what changed, and the evidence behind it."
        actions={
          role === "Administrator" ? (
            <ExportButton
              data={rows.map((a) => ({ ...a }))}
              name="audit-trail"
            />
          ) : (
            <Badge>Export restricted</Badge>
          )
        }
      />
      <div className="callout">
        <ShieldCheck size={17} />
        {isHttp
          ? "Backend audit records use an append-only application interface and a SHA-256 hash chain."
          : "Local demo records are append-only through the application; browser storage is editable and is not tamper-evident."}
      </div>
      <Panel>
        <div className="toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search actor, action, target or evidence…"
          />
          <select
            aria-label="Audit action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="all">All actions</option>
            {[...new Set(data.audit.map((a) => a.action))].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="audit-list">
          {rows.map((a) => (
            <details key={a.id}>
              <summary>
                <span className="audit-icon">
                  <Activity size={17} />
                </span>
                <span>
                  <strong>{a.action}</strong>
                  <small>
                    {a.actor} · {a.role} · {a.target}
                  </small>
                </span>
                <span className="mono">
                  {new Date(a.time).toLocaleString("en-GB")}
                </span>
                <Badge>{a.after || "Recorded"}</Badge>
              </summary>
              <div className="audit-detail">
                <dl>
                  <dt>Previous state</dt>
                  <dd>{a.before || "—"}</dd>
                  <dt>New state</dt>
                  <dd>{a.after || "—"}</dd>
                  <dt>Reason</dt>
                  <dd>{a.reason}</dd>
                  <dt>Evidence reference</dt>
                  <dd>{a.evidence || "No reference supplied"}</dd>
                  <dt>Correlation ID</dt>
                  <dd className="mono">{a.correlation}</dd>
                </dl>
              </div>
            </details>
          ))}
        </div>
        {!rows.length && (
          <Empty
            title="No matching audit entries"
            detail="Adjust the filters or complete a simulated action."
          />
        )}
      </Panel>
    </>
  );
}
function Health({ data }: { data: AppState }) {
  const [checked, setChecked] = useState("Not checked this session");
  const [services, setServices] = useState<
    { name: string; status: string; detail: string }[] | null
  >(null);
  const notify = usePreferences((s) => s.notify);
  const pending = data.recovery.filter(
    (r) => r.status === "Pending review",
  ).length;
  const defaults = [
    "Hospital information service",
    "Radiology scheduling",
    "Imaging device simulator",
    "PACS archive",
    "DICOM transfer service",
    "Workflow database",
    "Investigation engine",
    "Background processing",
  ].map((name, i) => ({
    name,
    status:
      i === 4 && data.studies.some((s) => s.archive === "Transfer failed")
        ? "Degraded"
        : "Healthy",
    detail:
      i === 4
        ? "Synthetic transfer failures observed"
        : "Local deterministic simulation",
  }));
  async function check() {
    if (isHttp) {
      try {
        const res = await fetch("/api/v1/system/services", {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("sonorescue-token")}`,
          },
        });
        if (!res.ok) throw Error("Health probe failed");
        setServices(await res.json());
      } catch (e) {
        notify(String(e));
        return;
      }
    }
    setChecked(new Date().toLocaleTimeString());
  }
  return (
    <>
      <PageHeader
        title="Systems in focus"
        eyebrow="WORKSPACE / SYSTEM HEALTH"
        description="Availability is an observation. Image integrity requires its own evidence."
        actions={
          <button className="button" onClick={check}>
            <RefreshCw size={15} /> Run health checks
          </button>
        }
      />
      <div className="health-summary">
        <span className="health-orb">
          <Activity size={30} />
        </span>
        <div>
          <h2>
            {isHttp ? "Connected services" : "Local simulation environment"}
          </h2>
          <p>
            {pending} actions in the review queue · Last checked: {checked}
          </p>
        </div>
        <Badge tone="neutral">
          {isHttp ? "Live probes" : "Simulated service states"}
        </Badge>
      </div>
      <div className="health-grid">
        {(services ?? defaults).map((s, i) => (
          <Panel key={s.name}>
            <div className="service-icon">
              {i === 3 || i === 5 ? (
                <Database size={23} />
              ) : (
                <Server size={23} />
              )}
            </div>
            <h3>{s.name}</h3>
            <Badge>{s.status}</Badge>
            <p>{s.detail}</p>
            <small>Availability ≠ verified archival integrity</small>
          </Panel>
        ))}
      </div>
      <div className="callout">
        Unknown or unavailable services require investigation. Never interpret a
        timeout as proof that imaging data is permanently lost.
      </div>
    </>
  );
}
function Research({ data }: { data: AppState }) {
  const [config, setConfig] = useState<ExperimentConfig>({
    seed: 42,
    count: 400,
    missing: 0.1,
    noise: 5,
    corruption: 0.05,
    faults: 1,
    threshold: 0.5,
    abstention: 0.8,
  });
  const action = useAction();
  const latest = data.experiments[0];
  const [resultId, setResultId] = useState("");
  const result = data.experiments.find((e) => e.id === resultId) ?? latest;
  const controls: [keyof ExperimentConfig, string, number, number, number][] = [
    ["seed", "Random seed", 1, 999999, 1],
    ["count", "Number of scenarios", 16, 10000, 16],
    ["missing", "Missing-event rate", 0, 0.9, 0.1],
    ["noise", "Timestamp noise (minutes)", 0, 60, 1],
    ["corruption", "Identifier corruption rate", 0, 0.9, 0.05],
    ["faults", "Simultaneous faults", 1, 3, 1],
    ["threshold", "Matching threshold", 0, 1, 0.05],
    ["abstention", "Abstention threshold", 0, 1, 0.05],
  ];
  return (
    <>
      <PageHeader
        title="A hypothesis worth testing"
        eyebrow="WORKSPACE / RESEARCH LAB"
        description="Compare simpler methods against temporal evidence reasoning. Report what the data says."
        actions={
          result ? (
            <button
              className="button"
              onClick={() => download(`${result.id}.json`, result)}
            >
              <Download size={15} /> Export experiment
            </button>
          ) : undefined
        }
      />
      <div className="research-intro">
        <span className="research-mark">
          TEG<span>—</span>UR
        </span>
        <div>
          <h2>Temporal Evidence Graph for Uncertainty-Aware Recovery</h2>
          <p>
            A proposed research method, evaluated on reproducible synthetic
            workflows. No clinical efficacy or novelty claim is made.
          </p>
        </div>
      </div>
      <div className="research-layout">
        <Panel
          title="Experiment configuration"
          subtitle="Seeded, synthetic workflow data."
        >
          <Field label="Dataset">
            <select>
              <option>Synthetic workflow benchmark v1</option>
            </select>
          </Field>
          <div className="config-grid">
            {controls.map(([key, label, min, max, step]) => (
              <Field label={label} key={key}>
                <input
                  type="number"
                  value={config[key]}
                  min={min}
                  max={max}
                  step={step}
                  onChange={(e) =>
                    setConfig({ ...config, [key]: Number(e.target.value) })
                  }
                />
              </Field>
            ))}
          </div>
          <button
            className="button primary full"
            disabled={
              action.isPending ||
              controls.some(
                ([k, , min, max]) =>
                  !Number.isFinite(config[k]) ||
                  config[k] < min ||
                  config[k] > max,
              )
            }
            onClick={() =>
              action.mutate(
                { type: "experiment", config },
                { onSuccess: () => setResultId("") },
              )
            }
          >
            <Play size={16} />{" "}
            {action.isPending ? "Running experiment…" : "Run experiment"}
          </button>
          <p className="quiet-note">
            {isHttp
              ? "Server executes event-level graph analysis against held-out ground truth."
              : "Browser benchmark evaluates feature-level detection and abstention rules. Full event-level evaluation requires backend mode."}
          </p>
        </Panel>
        <Panel
          title="Measured results"
          subtitle={
            result
              ? `${result.id} · ${result.config.count} scenarios · seed ${result.config.seed}`
              : "No experiment has run yet."
          }
          actions={
            result && (
              <select
                aria-label="Experiment history"
                value={result.id}
                onChange={(e) => setResultId(e.target.value)}
              >
                {data.experiments.map((e) => (
                  <option key={e.id}>{e.id}</option>
                ))}
              </select>
            )
          }
        >
          {!result ? (
            <Empty
              title="Evidence starts with an experiment"
              detail="Choose a reproducible configuration and run all three methods. Results will be computed, not prefilled."
            />
          ) : (
            <>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.results}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="method" tick={{ fontSize: 10 }} />
                    <YAxis
                      domain={[0, 1]}
                      tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    />
                    <Tooltip
                      formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                    />
                    <Legend />
                    <Bar
                      dataKey="precision"
                      name="Precision"
                      fill="#167d78"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="recall"
                      name="Recall"
                      fill="#8bb2a4"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="abstention"
                      name="Abstention"
                      fill="#d3a562"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>METHOD</th>
                      <th>PRECISION</th>
                      <th>RECALL</th>
                      <th>UNSAFE / ALL</th>
                      <th>ABSTENTION</th>
                      <th>FP RATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((m) => (
                      <tr key={m.method}>
                        <td>{m.method}</td>
                        {[
                          m.precision,
                          m.recall,
                          m.unsafe,
                          m.abstention,
                          m.falsePositive,
                        ].map((v, i) => (
                          <td key={i}>{(v * 100).toFixed(1)}%</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="confusion-grid">
                {result.results.map((m) => (
                  <div key={m.method}>
                    <h4>{m.method}</h4>
                    <div className="confusion">
                      <span>
                        TP <strong>{m.tp}</strong>
                      </span>
                      <span>
                        FP <strong>{m.fp}</strong>
                      </span>
                      <span>
                        FN <strong>{m.fn}</strong>
                      </span>
                      <span>
                        TN <strong>{m.tn}</strong>
                      </span>
                    </div>
                    <small>
                      {m.latency.toFixed(4)} ms / sample · processing time
                    </small>
                  </div>
                ))}
              </div>
              <p className="callout">{result.scope}</p>
              <button
                className="button"
                onClick={() =>
                  download(
                    `${result.id}.csv`,
                    csv(result.results.map((m) => ({ ...m }))),
                    true,
                  )
                }
              >
                Export metrics CSV
              </button>
            </>
          )}
        </Panel>
      </div>
      <Panel title="What the metrics mean">
        <div className="metric-definitions">
          <div>
            <strong>Detection precision</strong>
            <p>True incidents / all flagged incidents.</p>
          </div>
          <div>
            <strong>Detection recall</strong>
            <p>Detected incidents / all injected incidents.</p>
          </div>
          <div>
            <strong>Unsafe acceptance rate</strong>
            <p>
              Incorrect accepted associations / all samples. Inspect the
              denominator before comparing papers.
            </p>
          </div>
          <div>
            <strong>Abstention rate</strong>
            <p>
              Cases withheld from association / all samples. Safer selection can
              increase review burden.
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}
function Settings({ data }: { data: AppState }) {
  const { role, setRole, reduced, setReduced, notify } = usePreferences();
  const [notifications, setNotifications] = useState(
    () => localStorage.getItem("sonorescue-notifications") !== "off",
  );
  const [compact, setCompact] = useState(false);
  return (
    <>
      <PageHeader
        title="Make room for your workflow"
        eyebrow="WORKSPACE / SETTINGS"
        description="Display preferences, synthetic roles, and research environment controls."
      />
      <div className="settings-grid">
        <Panel title="Profile & permissions">
          <div className="profile-card">
            <span className="avatar large">DR</span>
            <div>
              <h3>Demo reviewer</h3>
              <p>Synthetic research account</p>
            </div>
          </div>
          <Field label="Active role">
            <select
              disabled={isHttp}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {[
                "Administrator",
                "Imaging technician",
                "Radiology reviewer",
                "Clinical safety reviewer",
                "Read-only observer",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <p>
            {isHttp
              ? "Sign in through your profile to change authenticated role."
              : "Switch roles to test permission boundaries in mock mode."}
          </p>
          <div className="permission-list">
            <span>
              <Check size={15} /> Read synthetic evidence
            </span>
            <span>
              {role === "Read-only observer" ? "—" : "✓"} Run simulations
            </span>
            <span>
              {[
                "Administrator",
                "Radiology reviewer",
                "Clinical safety reviewer",
              ].includes(role)
                ? "✓"
                : "—"}{" "}
              Review recovery actions
            </span>
            <span>
              {role === "Administrator" ? "✓" : "—"} Export audit & reset
              environment
            </span>
          </div>
        </Panel>
        <Panel title="Display & notifications">
          <label className="setting-row">
            <span>
              <strong>Reduced motion</strong>
              <small>Simplify transitions and animated connections.</small>
            </span>
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => {
                setReduced(e.target.checked);
                document.documentElement.classList.toggle(
                  "reduced-motion",
                  e.target.checked,
                );
              }}
            />
          </label>
          <label className="setting-row">
            <span>
              <strong>Compact tables</strong>
              <small>Reduce row spacing for dense investigations.</small>
            </span>
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => {
                setCompact(e.target.checked);
                document.documentElement.classList.toggle(
                  "compact-tables",
                  e.target.checked,
                );
              }}
            />
          </label>
          <label className="setting-row">
            <span>
              <strong>Incident notifications</strong>
              <small>Persist this browser's notification preference.</small>
            </span>
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => {
                setNotifications(e.target.checked);
                localStorage.setItem(
                  "sonorescue-notifications",
                  e.target.checked ? "on" : "off",
                );
                notify("Notification preference saved.");
              }}
            />
          </label>
        </Panel>
        <Panel title="Environment configuration">
          <dl>
            <dt>Service mode</dt>
            <dd>{isHttp ? "Authenticated HTTP API" : "Local mock service"}</dd>
            <dt>Patient data</dt>
            <dd>Synthetic only</dd>
            <dt>Research method</dt>
            <dd>TEG-UR · explicit constraints & abstention</dd>
            <dt>Identity policy</dt>
            <dd>Hard conflicts always block association</dd>
            <dt>Audit policy</dt>
            <dd>Append-only through application commands</dd>
          </dl>
          <Link className="button" to="/research">
            Configure research experiments <ArrowUpRight size={14} />
          </Link>
        </Panel>
        <Panel title="Data portability">
          <p>
            Export a copy of the current synthetic environment. No source
            evidence is removed.
          </p>
          <button
            className="button"
            disabled={role !== "Administrator"}
            onClick={() => download("sonorescue-environment.json", data)}
          >
            <Download size={15} /> Export environment
          </button>
          <p className="quiet-note">
            Environment exports include review decisions and audit records.
            Administrator role required.
          </p>
          <Link className="text-link" to="/simulator">
            Demo reset controls <ArrowUpRight size={14} />
          </Link>
        </Panel>
      </div>
    </>
  );
}
