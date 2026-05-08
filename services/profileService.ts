/**
 * Writer Profile Service — localStorage-based identity management.
 *
 * Design decisions:
 * - localStorage only: profiles never leave the device. No server, no tracking.
 * - Multiple profiles: supports shared devices (e.g., constituency office PCs)
 * - Optional PIN: SHA-256 via Web Crypto API. Not Argon2 — this isn't server
 *   auth protecting secrets. It's a convenience gate so Writer A can't
 *   accidentally use Writer B's profile on a shared PC.
 * - No session tokens, no JWTs, no cookies. Just "who are you?"
 */

import { WriterProfile } from '../types';

const STORAGE_KEY = 'cwi_writer_profiles';
const ACTIVE_KEY = 'cwi_active_profile_id';

// ─── Crypto ──────────────────────────────────────────────────────────────────

/**
 * Hash a PIN using Web Crypto SHA-256.
 * Returns hex string. Not for server auth — just shared-device protection.
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a PIN against a stored hash.
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const pinHash = await hashPin(pin);
  return pinHash === hash;
}

// ─── Profile CRUD ────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get all writer profiles from localStorage.
 */
export function getAllProfiles(): WriterProfile[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WriterProfile[];
  } catch {
    return [];
  }
}

/**
 * Save a new writer profile. Returns the created profile.
 */
export function createProfile(
  writerName: string,
  constituency: string,
  mpName: string,
  division?: string,
  pinHash?: string
): WriterProfile {
  const profile: WriterProfile = {
    id: generateId(),
    writerName,
    constituency,
    division,
    mpName,
    pinHash,
    createdAt: new Date().toISOString(),
  };

  const profiles = getAllProfiles();
  profiles.push(profile);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));

  return profile;
}

/**
 * Get a specific profile by ID.
 */
export function getProfile(id: string): WriterProfile | null {
  return getAllProfiles().find(p => p.id === id) || null;
}

/**
 * Delete a profile by ID.
 */
export function deleteProfile(id: string): void {
  const profiles = getAllProfiles().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));

  // Clear active if it was the deleted one
  if (getActiveProfileId() === id) {
    clearActiveProfile();
  }
}

// ─── Active Profile (Session) ────────────────────────────────────────────────

/**
 * Set the active writer profile for this session.
 */
export function setActiveProfile(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

/**
 * Get the active profile ID, if one is set.
 */
export function getActiveProfileId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

/**
 * Get the full active profile object.
 */
export function getActiveProfile(): WriterProfile | null {
  const id = getActiveProfileId();
  if (!id) return null;
  return getProfile(id);
}

/**
 * Clear the active profile (used for "Switch Writer").
 */
export function clearActiveProfile(): void {
  localStorage.removeItem(ACTIVE_KEY);
}
