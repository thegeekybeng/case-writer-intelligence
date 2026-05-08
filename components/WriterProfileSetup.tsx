/**
 * Writer Profile Setup & Selection Screen.
 *
 * UX framing: "Set up your workspace" — not "login."
 * - First visit: create a profile with name, constituency, MP name
 * - Return visit: select existing profile or create new
 * - Optional PIN: for shared-device scenarios
 * - No tracking language anywhere in the UI
 */

import React, { useState, useEffect } from 'react';
import { User, Plus, ArrowRight, Shield, Trash2 } from 'lucide-react';
import { WriterProfile } from '../types';
import {
  getAllProfiles,
  createProfile,
  deleteProfile,
  setActiveProfile,
  getActiveProfile,
  clearActiveProfile,
  hashPin,
  verifyPin,
} from '../services/profileService';

interface WriterProfileSetupProps {
  onProfileReady: (profile: WriterProfile) => void;
}

export const WriterProfileSetup: React.FC<WriterProfileSetupProps> = ({ onProfileReady }) => {
  const [profiles, setProfiles] = useState<WriterProfile[]>([]);
  const [mode, setMode] = useState<'loading' | 'select' | 'create' | 'pin'>('loading');

  // Create form state
  const [writerName, setWriterName] = useState('');
  const [constituency, setConstituency] = useState('');
  const [division, setDivision] = useState('');
  const [mpName, setMpName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [usePin, setUsePin] = useState(false);

  // PIN entry state (for returning with PIN)
  const [pinEntry, setPinEntry] = useState('');
  const [pinTarget, setPinTarget] = useState<WriterProfile | null>(null);
  const [pinError, setPinError] = useState(false);

  // ── Initialization ──
  useEffect(() => {
    const existing = getAllProfiles();
    setProfiles(existing);

    // Auto-resume active profile
    const active = getActiveProfile();
    if (active) {
      onProfileReady(active);
      return;
    }

    // First time: go to create. Otherwise: show selection.
    setMode(existing.length === 0 ? 'create' : 'select');
  }, [onProfileReady]);

  // ── Create Profile ──
  const handleCreate = async () => {
    if (!writerName.trim() || !constituency.trim() || !mpName.trim()) return;

    let pinHash: string | undefined;
    if (usePin && pin.length === 4 && pin === confirmPin) {
      pinHash = await hashPin(pin);
    }

    const profile = createProfile(
      writerName.trim(),
      constituency.trim(),
      mpName.trim(),
      division.trim() || undefined,
      pinHash
    );

    setActiveProfile(profile.id);
    onProfileReady(profile);
  };

  // ── Select Profile ──
  const handleSelect = (profile: WriterProfile) => {
    if (profile.pinHash) {
      setPinTarget(profile);
      setPinEntry('');
      setPinError(false);
      setMode('pin');
    } else {
      setActiveProfile(profile.id);
      onProfileReady(profile);
    }
  };

  // ── PIN Verification ──
  const handlePinSubmit = async () => {
    if (!pinTarget) return;
    const isValid = await verifyPin(pinEntry, pinTarget.pinHash!);
    if (isValid) {
      setActiveProfile(pinTarget.id);
      onProfileReady(pinTarget);
    } else {
      setPinError(true);
      setPinEntry('');
    }
  };

  // ── Delete Profile ──
  const handleDelete = (id: string) => {
    deleteProfile(id);
    const updated = getAllProfiles();
    setProfiles(updated);
    if (updated.length === 0) setMode('create');
  };

  if (mode === 'loading') return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <User className="text-indigo-600" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Case Writer Intelligence</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'create'
              ? 'Set up your writer profile so letters come pre-filled.'
              : mode === 'pin'
              ? `Welcome back, ${pinTarget?.writerName}`
              : 'Continue as…'
            }
          </p>
        </div>

        {/* ── Profile Selection ── */}
        {mode === 'select' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {profiles.map(profile => (
                <div key={profile.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
                  <button onClick={() => handleSelect(profile)}
                    className="flex items-center gap-3 flex-1 text-left">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 font-bold text-sm">
                        {profile.writerName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{profile.writerName}</p>
                      <p className="text-xs text-gray-400">{profile.constituency}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    {profile.pinHash && (
                      <Shield size={14} className="text-gray-300" />
                    )}
                    <button onClick={() => handleDelete(profile.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-1">
                      <Trash2 size={14} />
                    </button>
                    <ArrowRight size={16} className="text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setMode('create')}
                className="w-full flex items-center justify-center gap-2 text-xs text-indigo-600 font-medium py-2 hover:bg-indigo-50 rounded-lg transition-colors">
                <Plus size={14} /> New writer profile
              </button>
            </div>
          </div>
        )}

        {/* ── PIN Entry ── */}
        {mode === 'pin' && pinTarget && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Shield className="text-indigo-600" size={20} />
              </div>
              <p className="text-sm text-gray-600">Enter your 4-digit PIN to continue</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinEntry}
              onChange={e => {setPinEntry(e.target.value.replace(/\D/g, '')); setPinError(false);}}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
              className={`w-full text-center text-2xl tracking-[1em] font-bold py-3 border-2 rounded-xl outline-none transition-colors ${
                pinError
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 focus:border-indigo-300'
              }`}
              placeholder="····"
              autoFocus
            />
            {pinError && (
              <p className="text-xs text-red-500 text-center mt-2">Incorrect PIN. Try again.</p>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setMode('select'); setPinTarget(null); }}
                className="flex-1 py-2.5 text-sm text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium">
                Back
              </button>
              <button onClick={handlePinSubmit}
                disabled={pinEntry.length !== 4}
                className="flex-1 py-2.5 text-sm text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Create Profile ── */}
        {mode === 'create' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Your Name</label>
              <input type="text" value={writerName} onChange={e => setWriterName(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-indigo-300 focus:outline-none transition-colors"
                placeholder="e.g., Shawn Lim" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Constituency</label>
                <input type="text" value={constituency} onChange={e => setConstituency(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-indigo-300 focus:outline-none transition-colors"
                  placeholder="e.g., Ang Mo Kio GRC" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Division <span className="text-gray-300 normal-case">(optional)</span></label>
                <input type="text" value={division} onChange={e => setDivision(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-indigo-300 focus:outline-none transition-colors"
                  placeholder="e.g., Teck Ghee" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">MP Name</label>
              <input type="text" value={mpName} onChange={e => setMpName(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:border-indigo-300 focus:outline-none transition-colors"
                placeholder="e.g., Mr. Lee Hsien Loong" />
            </div>

            {/* Optional PIN */}
            <div className="pt-2 border-t border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={usePin} onChange={e => setUsePin(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-xs text-gray-500">
                  Set a 4-digit PIN <span className="text-gray-400">(for shared devices)</span>
                </span>
              </label>

              {usePin && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4}
                    value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    className="p-3 border border-gray-200 rounded-xl text-sm text-center tracking-widest focus:border-indigo-300 focus:outline-none"
                    placeholder="PIN" />
                  <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4}
                    value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className={`p-3 border rounded-xl text-sm text-center tracking-widest focus:outline-none ${
                      confirmPin.length === 4 && pin !== confirmPin
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 focus:border-indigo-300'
                    }`}
                    placeholder="Confirm" />
                </div>
              )}
            </div>

            <button onClick={handleCreate}
              disabled={!writerName.trim() || !constituency.trim() || !mpName.trim() || (usePin && (pin.length !== 4 || pin !== confirmPin))}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <ArrowRight size={16} /> Start Writing
            </button>

            {profiles.length > 0 && (
              <button onClick={() => setMode('select')}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
                ← Back to profile selection
              </button>
            )}

            <p className="text-[10px] text-gray-300 text-center leading-relaxed">
              Your profile is stored on this device only.
              It pre-fills your name, MP, and constituency into generated letters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
