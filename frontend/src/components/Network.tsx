import { useState } from "react";
import {
  Building2,
  CalendarClock,
  ScanLine,
  Cable,
  Database,
  Fingerprint,
  MonitorCheck,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Modal, Badge, time } from "./ui";
import type { AppState, Study } from "../types";
const nodes = [
  { name: "Patient records", short: "HIS", icon: Building2, x: 16, y: 27 },
  {
    name: "Imaging orders",
    short: "RIS",
    icon: CalendarClock,
    x: 16,
    y: 72,
  },
  { name: "Scanner", short: "MODALITY", icon: ScanLine, x: 40, y: 49 },
  { name: "Image transfer", short: "DICOM", icon: Cable, x: 62, y: 28 },
  { name: "Image archive", short: "PACS", icon: Database, x: 85, y: 49 },
  {
    name: "SonoRescue",
    short: "TEG-UR",
    icon: Fingerprint,
    x: 62,
    y: 75,
  },
  {
    name: "Human reviewer",
    short: "REVIEW",
    icon: MonitorCheck,
    x: 85,
    y: 85,
  },
];
const sourceGuide = [
  {
    question: "Who is the registered patient?",
    explanation:
      "The hospital information system (HIS) supplies the patient identifier and its issuing hospital.",
    types: ["Patient registered"],
  },
  {
    question: "Which examination was ordered?",
    explanation:
      "The radiology scheduling system (RIS) supplies the order, appointment, and accession number that should connect to the scan.",
    types: ["Order created", "Worklist selected"],
  },
  {
    question: "Did the scanner perform the examination?",
    explanation:
      "The scanner’s acquisition log records the scan time and device. DICOM metadata records the identifiers saved inside the image file.",
    types: ["Scan acquired"],
  },
  {
    question: "Was the image sent successfully?",
    explanation:
      "Transfer logs record delivery attempts and failures. A sent message does not prove that the image can be retrieved.",
    types: ["Transfer attempted", "Transfer failed"],
  },
  {
    question: "Is the image stored and retrievable?",
    explanation:
      "The picture archiving and communication system (PACS) supplies storage receipts and query/retrieval results.",
    types: [
      "Storage accepted",
      "Archive retrieved",
      "Simulated archive retrieval",
    ],
  },
  {
    question: "Where do the records disagree?",
    explanation:
      "SonoRescue compares the source records, highlights missing links, and proposes explanations. Its findings are not new evidence of patient identity.",
    types: [],
  },
  {
    question: "Has someone verified the proposed action?",
    explanation:
      "An authorized reviewer checks independent evidence. Approval, execution, and successful retrieval are recorded as separate steps.",
    types: [],
  },
];
export default function Network({
  data,
  study,
}: {
  data: AppState;
  study?: Study;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const example = study ?? data.studies[0];
  const guide = sourceGuide[selected ?? 0];
  const records =
    example?.events.filter((e) => guide.types.includes(e.type)) ?? [];
  const investigation = data.investigations.find(
    (i) => i.studyId === example?.id,
  );
  const recovery = data.recovery.find((r) => r.studyId === example?.id);
  const failedTransfer = example?.archive === "Transfer failed";
  const missingWorklist =
    example?.events.some((e) => e.type === "Scan acquired") &&
    !example.events.some((e) => e.type === "Worklist selected");
  return (
    <>
      <div className="network">
        <div className="network-grid" />
        <svg
          viewBox="0 0 1000 360"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="wire">
              <stop stopColor="#96c6bc" />
              <stop offset="1" stopColor="#167d78" />
            </linearGradient>
          </defs>
          {[
            [0, 2],
            [1, 2],
            [2, 3],
            [3, 4],
            [2, 5],
            [5, 4],
            [5, 6],
          ].map(([a, b], i) => (
            <path
              key={i}
              d={`M ${nodes[a].x * 10} ${nodes[a].y * 3.6} C ${(nodes[a].x + nodes[b].x) * 5} ${nodes[a].y * 3.6}, ${(nodes[a].x + nodes[b].x) * 5} ${nodes[b].y * 3.6}, ${nodes[b].x * 10} ${nodes[b].y * 3.6}`}
              className={
                (i === 3 && failedTransfer) || (i === 1 && missingWorklist)
                  ? "wire warning"
                  : "wire"
              }
            />
          ))}
        </svg>
        {nodes.map((n, i) => (
          <button
            key={n.short}
            className={`network-node n${i} ${i === 5 ? "engine" : ""}`}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
            onClick={() => setSelected(i)}
          >
            <span className="node-platform">
              <n.icon size={i === 5 ? 30 : 25} />
              <span
                className={`node-light ${(i === 3 && failedTransfer) || (i === 1 && missingWorklist) ? "warn" : ""}`}
              />
            </span>
            <span className="node-label">{n.name}</span>
            <small>{n.short}</small>
          </button>
        ))}
        <div className="network-caption">
          <span className="live-dot" /> {example?.id} · Select a system to see
          its evidence
        </div>
      </div>
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={nodes[selected ?? 0].name}
        description={guide.question}
      >
        <p className="network-source-intro">{guide.explanation}</p>
        <div className="detail-grid">
          <div>
            <small>Evidence for this example</small>
            <Badge>
              {selected === 5
                ? investigation
                  ? "Investigation available"
                  : "No incident detected"
                : selected === 6
                  ? (recovery?.status ?? "No action required")
                  : records.length
                    ? "Records available"
                    : "Evidence missing"}
            </Badge>
          </div>
          <div>
            <small>Scan being investigated</small>
            <strong>
              {example?.id} · {example?.device}
            </strong>
          </div>
        </div>
        {records.length > 0 && (
          <div className="source-guide">
            {records.map((record) => (
              <section key={record.id}>
                <h3>{record.type}</h3>
                <p>{record.detail}</p>
                <small>
                  {record.source} · {record.id} · {time(record.time)} IST
                </small>
              </section>
            ))}
          </div>
        )}
        {selected !== null && selected < 5 && !records.length && (
          <p className="callout">
            No matching source record is available in this case. Request this
            system’s original log before drawing a conclusion.
          </p>
        )}
        {selected === 1 && missingWorklist && (
          <p className="callout">
            The order exists, but the scanner’s worklist selection record is
            missing. That gap is why this connection needs attention.
          </p>
        )}
        <p className="callout">
          These records are synthetic. In a hospital, they would come from the
          connected systems’ logs and metadata. A missing record does not prove
          that an image was lost.
        </p>
        <Link
          className="button primary"
          to={
            selected === 6
              ? `/recovery?study=${example?.id}`
              : selected === 5 && investigation
                ? `/investigations/${investigation.id}`
                : `/studies?study=${example?.id}`
          }
          onClick={() => setSelected(null)}
        >
          {selected === 6
            ? "Open the review record"
            : selected === 5 && investigation
              ? "Open the investigation"
              : "Open the scan and its records"}{" "}
          <ArrowUpRight size={15} />
        </Link>
      </Modal>
    </>
  );
}
