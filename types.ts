
export enum CaseStatus {
  NEW = 'New',
  DRAFTING = 'Drafting',
  PENDING_APPROVAL = 'Pending Approval',
  APPROVED = 'Approved',
  SENT = 'Sent'
}

export enum Urgency {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export type UserRole = 'resident' | 'writer' | 'admin' | 'mp';

/**
 * Writer profile for letter pre-population and workspace personalization.
 * Stored in localStorage only — never sent to any server.
 * PIN is optional, for shared-device scenarios.
 */
export interface WriterProfile {
  id: string;                // UUID, generated on creation
  writerName: string;        // e.g., "Shawn Lim"
  constituency: string;      // e.g., "Ang Mo Kio GRC"
  division?: string;         // e.g., "Teck Ghee" (optional subdivision)
  mpName: string;            // e.g., "Mr. Lee Hsien Loong"
  pinHash?: string;          // SHA-256 of 4-digit PIN (optional)
  createdAt: string;         // ISO date
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  attachments?: string[]; // Base64 strings
}

export interface CaseDocument {
  id: string;
  name: string;
  type: string;
  content: string; // Base64
  summary?: string;
}

export interface CaseHistoryEvent {
  timestamp: Date;
  action: string;
  user: string; // e.g., "System", "WriterA", "MP", "AI Agent"
}

export interface CaseNote {
  id: string;
  content: string;
  author: string;
  timestamp: Date;
}

export interface LetterDraft {
  id: string;
  agency: string;
  content: string;
  status: 'Draft' | 'Approved';
}

export interface Case {
  id: string;
  residentName: string;
  nricMasked: string; // e.g., S****123A
  constituency: string; // e.g., "Ang Mo Kio GRC"
  division?: string; // e.g., "Teck Ghee"
  mpName: string; // e.g., "Mr. Lee Hsien Loong"

  // Assigned based on postal code
  assignedConstituency?: string;
  assignedDivision?: string;
  assignedMPName?: string;

  category: string;
  subCategory: string;
  summary: string;
  keyFacts?: string[]; // Extracted facts
  coreRequest?: string; // Specific ask
  urgency: Urgency;
  status: CaseStatus;
  messages: Message[];
  documents: CaseDocument[];

  // Advanced Letter Generation
  generatedLetters: LetterDraft[];

  // AI Deep Reasoning
  implications?: string[]; // Hidden layers of concern (Cause -> Effect)
  proactiveSolutions?: string[]; // Middle-term solutioning

  suggestedAgencies?: string[];
  createdAt: Date;
  assignedTo?: string;
  approvals: string[]; // List of admin IDs who approved
  history: CaseHistoryEvent[];
  internalNotes: CaseNote[];
}

export interface CategorizationResult {
  category: string;
  subCategory: string;
  urgency: Urgency;
  summary: string;
  keyFacts: string[];
  coreRequest: string;
  suggestedAgencies: string[];
  implications: string[];
  proactiveSolutions: string[];
}

// ─── Causality Engine Types ────────────────────────────────────────────────

export interface CausalEntity {
  type: 'person' | 'condition' | 'event' | 'agency' | 'resource' | 'obligation';
  name: string;
  details: string;
  firstMentioned: string; // descriptive date or "unknown"
}

export interface TimelineEvent {
  date: string; // ISO or descriptive e.g. "~3 months ago"
  event: string;
  entityRefs: string[]; // entity names involved
  isRootCause: boolean;
  currentStatus: 'past' | 'ongoing' | 'imminent';
}

export interface CausalNode {
  id: string;
  label: string;
  type: 'root_cause' | 'intermediate' | 'presenting_problem' | 'hidden_risk' | 'consequence';
  causes: string[]; // ids of upstream nodes
  effects: string[]; // ids of downstream nodes
  confidence: number; // 0.0 – 1.0
  domain: 'housing' | 'financial' | 'health' | 'legal' | 'family' | 'employment' | 'social';
}

export interface CausalGap {
  description: string;
  affectedNodeIds: string[];
  severity: 'blocking' | 'important' | 'nice_to_have';
  questionToAsk: string;
}

export interface UrgencyAssessment {
  overall: Urgency;
  rationale: string;
  timeSensitiveFactors: string[];
  criticalPathNodeIds: string[]; // nodes on the most urgent chain
}

export interface AgencyRoute {
  agency: string;
  priority: 'primary' | 'secondary' | 'long_term';
  addressesNodeIds: string[]; // which causal nodes this agency resolves
  specificAsk: string;
  estimatedProcessingDays: number;
  prerequisiteAgencies: string[]; // must engage these first
}

export interface DocumentQueueItem {
  order: number;
  type: 'letter' | 'referral' | 'internal_note' | 'follow_up';
  agency: string;
  subject: string;
  urgency: Urgency;
  dependsOn: string[]; // agency names that must go first
}

export interface CausalGraph {
  entities: CausalEntity[];
  timeline: TimelineEvent[];
  nodes: CausalNode[];
  gaps: CausalGap[];
  urgency: UrgencyAssessment;
  agencyRoutes: AgencyRoute[];
  documentQueue: DocumentQueueItem[];
  engineVersion: string;
  processedAt: string; // ISO date string
}
