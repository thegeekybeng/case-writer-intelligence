/**
 * Agency-specific template definitions for CWI Letter Generation.
 *
 * Each agency has:
 * - domains: which CausalNode domains are relevant (priority-ordered for fact selection)
 * - placeholders: PDPA-compliant PII markers the writer must fill in at Gather.gov.sg
 * - label: human-readable agency name for letter headers
 *
 * Why this file exists:
 * Separated from letterGenerator.ts so agency definitions can be maintained
 * independently. Adding a new agency is a config change, not a logic change.
 */

export interface AgencyTemplate {
  agency: string;
  label: string;
  domains: string[];            // Priority-ordered domains for fact selection
  placeholders: string[];       // Agency-specific PII placeholders
}

// ─── PII Placeholder Markers ─────────────────────────────────────────────────
// Block characters (██) are visually unmissable when pasting into Gather.
// Writers cannot accidentally send a letter with these still present.
//
// Split into two categories:
// - WRITER: auto-filled from WriterProfile (name, constituency, MP)
// - RESIDENT: always ██ markers (PDPA — never stored in CWI)

import { WriterProfile } from '../types';

export const RESIDENT_PLACEHOLDERS = {
  residentName: '██ RESIDENT NAME ██',
  nric:         '██ NRIC ██',
} as const;

export const WRITER_PLACEHOLDER_DEFAULTS = {
  mpName:       '██ MP NAME ██',
  constituency: '██ CONSTITUENCY ██',
  writerName:   '██ WRITER NAME ██',
} as const;

/**
 * Resolve writer placeholders from profile, falling back to ██ markers.
 * Resident placeholders always remain as ██ — that's the PDPA boundary.
 */
export function resolveWriterPlaceholders(profile?: WriterProfile | null) {
  return {
    mpName: profile?.mpName || WRITER_PLACEHOLDER_DEFAULTS.mpName,
    constituency: profile?.constituency || WRITER_PLACEHOLDER_DEFAULTS.constituency,
    writerName: profile?.writerName || WRITER_PLACEHOLDER_DEFAULTS.writerName,
  };
}

/**
 * Combined placeholders for backward compatibility.
 * Use resolveWriterPlaceholders() + RESIDENT_PLACEHOLDERS instead when profile is available.
 */
export const COMMON_PLACEHOLDERS = {
  ...RESIDENT_PLACEHOLDERS,
  ...WRITER_PLACEHOLDER_DEFAULTS,
} as const;

// ─── Agency Template Registry ────────────────────────────────────────────────

export const AGENCY_TEMPLATES: Record<string, AgencyTemplate> = {
  HDB: {
    agency: 'HDB',
    label: 'Housing & Development Board',
    domains: ['housing', 'financial'],
    placeholders: ['██ BLOCK/STREET ██', '██ FLAT TYPE ██', '██ LEASE COMMENCEMENT ██'],
  },
  'Town Council': {
    agency: 'Town Council',
    label: 'Town Council',
    domains: ['financial', 'housing'],
    placeholders: ['██ TOWN COUNCIL ACCOUNT NO ██'],
  },
  CPF: {
    agency: 'CPF',
    label: 'Central Provident Fund Board',
    domains: ['financial', 'employment'],
    placeholders: ['██ CPF MEMBER ACCT ██'],
  },
  MSF: {
    agency: 'MSF',
    label: 'Ministry of Social and Family Development',
    domains: ['family', 'financial', 'social'],
    placeholders: ['██ HOUSEHOLD SIZE ██', '██ HOUSEHOLD INCOME ██'],
  },
  ComCare: {
    agency: 'ComCare',
    label: 'ComCare',
    domains: ['financial', 'family', 'social'],
    placeholders: ['██ HOUSEHOLD SIZE ██', '██ HOUSEHOLD INCOME ██'],
  },
  FSC: {
    agency: 'FSC',
    label: 'Family Service Centre',
    domains: ['family', 'social', 'health'],
    placeholders: ['██ HOUSEHOLD SIZE ██'],
  },
  MOM: {
    agency: 'MOM',
    label: 'Ministry of Manpower',
    domains: ['employment', 'financial', 'legal'],
    placeholders: ['██ EMPLOYER ██', '██ PASS TYPE ██'],
  },
  MOH: {
    agency: 'MOH',
    label: 'Ministry of Health',
    domains: ['health', 'financial'],
    placeholders: ['██ MEDICAL CONDITION ██', '██ SUBSIDY TIER ██'],
  },
  CHAS: {
    agency: 'CHAS',
    label: 'Community Health Assist Scheme',
    domains: ['health', 'financial'],
    placeholders: ['██ MEDICAL CONDITION ██', '██ SUBSIDY TIER ██'],
  },
  MOE: {
    agency: 'MOE',
    label: 'Ministry of Education',
    domains: ['family', 'social', 'financial'],
    placeholders: ['██ SCHOOL NAME ██', '██ CHILD NAME(S) ██'],
  },
  ICA: {
    agency: 'ICA',
    label: 'Immigration & Checkpoints Authority',
    domains: ['legal', 'family'],
    placeholders: ['██ PASSPORT/PERMIT NO ██'],
  },
  SSO: {
    agency: 'SSO',
    label: 'Social Service Office',
    domains: ['financial', 'social', 'family'],
    placeholders: ['██ HOUSEHOLD SIZE ██', '██ HOUSEHOLD INCOME ██'],
  },
  CDC: {
    agency: 'CDC',
    label: 'Community Development Council',
    domains: ['social', 'financial', 'family'],
    placeholders: [],
  },
  LAB: {
    agency: 'LAB',
    label: 'Legal Aid Bureau',
    domains: ['legal', 'financial'],
    placeholders: [],
  },
  'Yellow Ribbon': {
    agency: 'Yellow Ribbon',
    label: 'Yellow Ribbon Project',
    domains: ['social', 'employment'],
    placeholders: [],
  },
  'SG Enable': {
    agency: 'SG Enable',
    label: 'SG Enable',
    domains: ['health', 'social', 'employment'],
    placeholders: [],
  },
  IMH: {
    agency: 'IMH',
    label: 'Institute of Mental Health',
    domains: ['health', 'family'],
    placeholders: ['██ MEDICAL CONDITION ██'],
  },
  'NTUC/e2i': {
    agency: 'NTUC/e2i',
    label: 'NTUC Employment and Employability Institute',
    domains: ['employment', 'financial'],
    placeholders: [],
  },
  SPF: {
    agency: 'SPF',
    label: 'Singapore Police Force',
    domains: ['legal', 'family', 'social'],
    placeholders: ['██ REPORT NO ██'],
  },
};

/**
 * Returns the template for a given agency, falling back to a generic template.
 *
 * Why fallback exists: The Causality Engine may route to an agency not yet
 * in the registry. The fallback ensures letter generation never fails —
 * it just won't have agency-specific placeholders or domain weighting.
 */
export function getAgencyTemplate(agency: string): AgencyTemplate {
  return AGENCY_TEMPLATES[agency] || {
    agency,
    label: agency,
    domains: [],
    placeholders: [],
  };
}
