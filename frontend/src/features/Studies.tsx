import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronLeft,
  ChevronRight,
  ScanLine,
} from "lucide-react";
import {
  Badge,
  Empty,
  ExportButton,
  Field,
  Modal,
  PageHeader,
  Panel,
  SearchField,
  time,
} from "../components/ui";
import { usePreferences } from "../services";
import type { AppState, Study } from "../types";
function Viewer({ study }: { study: Study }) {
  const [zoom, setZoom] = useState(1),
    [frame, setFrame] = useState(1),
    [overlay, setOverlay] = useState(true),
    [pan, setPan] = useState({ x: 0, y: 0 });
  return (
    <div className="viewer">
      <div className="viewer-toolbar">
        <span>SYNTHETIC PHANTOM · NOT DIAGNOSTIC</span>
        <div>
          <button
            aria-label="Zoom out"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
          >
            <ZoomOut size={17} />
          </button>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          >
            <ZoomIn size={17} />
          </button>
          <button
            aria-label="Fit image"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Maximize size={17} />
          </button>
          <button onClick={() => setOverlay(!overlay)}>Metadata</button>
        </div>
      </div>
      <div
        className="phantom-view"
        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onPointerMove={(e) => {
          if (e.buttons === 1)
            setPan((p) => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
        }}
      >
        {overlay && (
          <div className="viewer-overlay">
            {study.patient}
            <br />
            {study.modality} · {study.device}
            <br />
            {study.uid}
            <br />
            Frame {frame}/3
          </div>
        )}
        <svg
          viewBox="0 0 300 240"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
          role="img"
          aria-label="Synthetic geometric imaging phantom"
        >
          <defs>
            <radialGradient id="phantom">
              <stop stopColor="#bbc1bd" />
              <stop offset=".75" stopColor="#606762" />
              <stop offset="1" stopColor="#a3aba5" />
            </radialGradient>
            <filter id="noise">
              <feTurbulence baseFrequency=".6" numOctaves="3" seed={frame} />
              <feComposite in="SourceGraphic" operator="in" />
              <feBlend in2="SourceGraphic" mode="soft-light" />
            </filter>
          </defs>
          <ellipse
            cx="150"
            cy="120"
            rx="80"
            ry="103"
            fill="url(#phantom)"
            filter="url(#noise)"
          />
          <ellipse
            cx="150"
            cy="120"
            rx="64"
            ry="86"
            fill="#323a35"
            opacity=".6"
          />
          <ellipse
            cx="125"
            cy="112"
            rx={23 + frame * 2}
            ry="47"
            fill="#929b92"
          />
          <ellipse cx="176" cy="114" rx="24" ry={44 + frame} fill="#858e84" />
          <circle cx="150" cy="169" r="17" fill="#c6cec4" />
          <circle cx="150" cy="169" r="9" fill="#4c554b" />
        </svg>
      </div>
      <div className="viewer-footer">
        <span>Drag to pan · {Math.round(zoom * 100)}%</span>
        <button
          aria-label="Previous image"
          onClick={() => setFrame(Math.max(1, frame - 1))}
        >
          <ChevronLeft size={17} />
        </button>
        {frame} / 3
        <button
          aria-label="Next image"
          onClick={() => setFrame(Math.min(3, frame + 1))}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export default function Studies({ data }: { data: AppState }) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(""),
    [modality, setModality] = useState("all"),
    [system, setSystem] = useState("all"),
    [device, setDevice] = useState("all"),
    [date, setDate] = useState(""),
    [sort, setSort] = useState("latest"),
    [page, setPage] = useState(0);
  const status = params.get("status") ?? "all",
    integrity = params.get("integrity") ?? "all";
  const selected = data.studies.find((s) => s.id === params.get("study"));
  const notify = usePreferences((s) => s.notify);
  const rows = data.studies
    .filter(
      (s) =>
        `${s.id} ${s.uid} ${s.patient} ${s.accession}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (modality === "all" || s.modality === modality) &&
        (system === "all" || s.system === system) &&
        (device === "all" || s.device === device) &&
        (!date || s.time.startsWith(date)) &&
        (status === "all" || s.archive === status) &&
        (integrity === "all" || s.integrity === integrity),
    )
    .sort((a, b) =>
      sort === "latest"
        ? b.time.localeCompare(a.time)
        : a.patient.localeCompare(b.patient),
    );
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / 10) - 1));
  const setFilter = (key: string, value: string) => {
    setParams((p) => {
      p.set(key, value);
      if (key !== "study") p.delete("study");
      return p;
    });
    setPage(0);
  };
  return (
    <>
      <PageHeader
        title="Every study, in view"
        eyebrow="WORKSPACE / IMAGING STUDIES"
        description="Trace an examination from acquisition to verified availability."
        actions={
          <ExportButton
            data={rows.map(({ events, candidates, ...s }) => ({
              ...s,
              eventCount: events.length,
              candidateCount: candidates.length,
            }))}
            name="imaging-studies"
          />
        }
      />
      <Panel>
        <div className="toolbar">
          <SearchField
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(0);
            }}
            placeholder="Search patient, study UID or accession…"
          />
          <select
            aria-label="Modality"
            value={modality}
            onChange={(e) => setModality(e.target.value)}
          >
            <option value="all">All modalities</option>
            {["US", "CT", "MR"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Archive status"
            value={status}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="all">All archive states</option>
            {["Verified", "Unverified", "Missing", "Transfer failed"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
          <select
            aria-label="Sort studies"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="latest">Newest first</option>
            <option value="patient">Patient identifier</option>
          </select>
        </div>
        <div className="secondary-filters">
          <select
            aria-label="Hospital system"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
          >
            <option value="all">All hospital systems</option>
            <option>Main campus</option>
            <option>North wing</option>
          </select>
          <select
            aria-label="Device"
            value={device}
            onChange={(e) => setDevice(e.target.value)}
          >
            <option value="all">All devices</option>
            {["US-01", "CT-02", "MR-01"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Integrity status"
            value={integrity}
            onChange={(e) => setFilter("integrity", e.target.value)}
          >
            <option value="all">All integrity states</option>
            {["Healthy", "Needs review", "Identity conflict", "Recovered"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
          <input
            aria-label="Acquisition date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            className="text-button"
            onClick={() => {
              setQuery("");
              setModality("all");
              setDevice("all");
              setSystem("all");
              setDate("");
              setParams({});
            }}
          >
            Clear filters
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>STUDY / PATIENT</th>
                <th>ACCESSION</th>
                <th>MODALITY</th>
                <th>ACQUISITION</th>
                <th>ARCHIVE</th>
                <th>INTEGRITY</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(safePage * 10, safePage * 10 + 10).map((s) => (
                <tr key={s.id}>
                  <td>
                    <button
                      className="table-link mono"
                      onClick={() => setFilter("study", s.id)}
                    >
                      {s.id}
                    </button>
                    <small>{s.patient}</small>
                  </td>
                  <td className="mono">
                    {s.accession || (
                      <span className="missing">Not recorded</span>
                    )}
                  </td>
                  <td>
                    <span className="modality-chip">{s.modality}</span>
                  </td>
                  <td>
                    {s.device}
                    <small>
                      {time(s.time)} IST · {s.system}
                    </small>
                  </td>
                  <td>
                    <Badge>{s.archive}</Badge>
                  </td>
                  <td>
                    <Badge>{s.integrity}</Badge>
                  </td>
                  <td>
                    <button
                      aria-label={`Inspect ${s.id}`}
                      className="icon-button"
                      onClick={() => setFilter("study", s.id)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="No studies match these filters"
            detail="Try a different patient identifier or clear the filters."
          />
        )}
        <div className="pagination">
          <span>
            {rows.length} examinations · Page {safePage + 1} of{" "}
            {Math.max(1, Math.ceil(rows.length / 10))}
          </span>
          <div>
            <button
              className="button small"
              disabled={!safePage}
              onClick={() => setPage(safePage - 1)}
            >
              Previous
            </button>
            <button
              className="button small"
              disabled={(safePage + 1) * 10 >= rows.length}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </Panel>
      <Modal
        open={!!selected}
        onClose={() =>
          setParams((p) => {
            p.delete("study");
            return p;
          })
        }
        title={
          selected
            ? `${selected.id} · ${selected.description}`
            : "Study details"
        }
      >
        {selected && (
          <>
            <div className="detail-grid">
              <Field label="Study Instance UID">
                <code>{selected.uid}</code>
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selected.uid);
                      notify("Study UID copied.");
                    } catch {
                      notify(
                        "Clipboard unavailable; select the UID to copy manually.",
                      );
                    }
                  }}
                >
                  <Copy size={13} /> Copy identifier
                </button>
              </Field>
              <Field label="Patient association">
                <strong>{selected.patient}</strong>
                <Badge>{selected.integrity}</Badge>
              </Field>
              <Field label="Accession / authority">
                <strong>{selected.accession || "Missing accession"}</strong>
                <small>{selected.issuer}</small>
              </Field>
              <Field label="Archive status">
                <Badge>{selected.archive}</Badge>
              </Field>
            </div>
            <Viewer study={selected} />
            <h3>Source events & provenance</h3>
            <div className="source-events">
              {selected.events.map((e) => (
                <div key={e.id}>
                  <span className="mono">{time(e.time)}</span>
                  <div>
                    <strong>{e.type}</strong>
                    <small>
                      {e.source} · {e.id}
                    </small>
                    <p>{e.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <h3>DICOM metadata inspection</h3>
            <pre>
              {JSON.stringify(
                {
                  PatientID: selected.patient,
                  IssuerOfPatientID: selected.issuer,
                  AccessionNumber: selected.accession,
                  StudyInstanceUID: selected.uid,
                  Modality: selected.modality,
                  StationName: selected.device,
                  StudyDate: selected.time.slice(0, 10).replaceAll("-", ""),
                },
                null,
                2,
              )}
            </pre>
            {data.investigations
              .filter((i) => i.studyId === selected.id)
              .map((i) => (
                <Link
                  className="button primary"
                  to={`/investigations/${i.id}`}
                  key={i.id}
                >
                  <ScanLine size={15} /> Open {i.id}
                </Link>
              ))}
          </>
        )}
      </Modal>
    </>
  );
}
