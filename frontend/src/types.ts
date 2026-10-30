export type Role =
  | "Administrator"
  | "Imaging technician"
  | "Radiology reviewer"
  | "Clinical safety reviewer"
  | "Read-only observer";
export type Scenario =
  | "healthy"
  | "worklist"
  | "accession"
  | "identity"
  | "transfer"
  | "acknowledgement"
  | "duplicate"
  | "compound";
export interface WorkflowEvent {
  id: string;
  type: string;
  source: string;
  time: string;
  detail: string;
  observed: boolean;
}
export interface Candidate {
  id: string;
  patient: string;
  issuer: string;
  accession: string;
  modality: string;
  delta: number;
  score: number;
  conflict: boolean;
  evidence: string[];
}
export interface Study {
  id: string;
  uid: string;
  patient: string;
  issuer: string;
  accession: string;
  modality: string;
  description: string;
  device: string;
  system: string;
  time: string;
  archive: "Verified" | "Unverified" | "Missing" | "Transfer failed";
  integrity: "Healthy" | "Needs review" | "Identity conflict" | "Recovered";
  scenario: Scenario;
  events: WorkflowEvent[];
  candidates: Candidate[];
}
export interface Investigation {
  id: string;
  studyId: string;
  category: string;
  severity: "High" | "Medium" | "Critical";
  status: string;
  reviewer: string;
  detected: string;
  completeness: number;
}
export interface Recovery {
  id: string;
  investigationId: string;
  studyId: string;
  action: string;
  status: "Pending review" | "Approved" | "Executed" | "Verified" | "Rejected";
  reason: string;
  evidence: string;
  reviewer: string;
}
export interface Audit {
  id: string;
  actor: string;
  role: Role;
  action: string;
  target: string;
  time: string;
  before: string;
  after: string;
  reason: string;
  evidence: string;
  correlation: string;
}
export interface ExperimentConfig {
  seed: number;
  count: number;
  missing: number;
  noise: number;
  corruption: number;
  faults: number;
  threshold: number;
  abstention: number;
}
export interface Metric {
  method: string;
  precision: number;
  recall: number;
  accuracy: number;
  unsafe: number;
  abstention: number;
  falsePositive: number;
  review: number;
  latency: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}
export interface Experiment {
  id: string;
  config: ExperimentConfig;
  results: Metric[];
  created: string;
  scope: string;
}
export interface AppState {
  studies: Study[];
  investigations: Investigation[];
  recovery: Recovery[];
  audit: Audit[];
  experiments: Experiment[];
}
export interface Command {
  type:
    | "simulate"
    | "approve"
    | "reject"
    | "execute"
    | "verify"
    | "assign"
    | "analyze"
    | "reset"
    | "experiment";
  id?: string;
  scenario?: Scenario;
  reason?: string;
  evidence?: string;
  config?: ExperimentConfig;
}
export interface Service {
  snapshot(): Promise<AppState>;
  command(command: Command, role: Role): Promise<AppState>;
}
