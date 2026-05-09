import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import WriterDashboard from './components/WriterDashboard';
import { WriterProfileSetup } from './components/WriterProfileSetup';
import { WriterProfile } from './types';
import { clearActiveProfile } from './services/profileService';

const DemoBanner = () => (
  <div className="w-full bg-amber-400 text-amber-900 text-xs font-bold text-center py-2 px-4 flex items-center justify-center gap-2 shrink-0">
    <AlertTriangle size={13} />
    DEMO ONLY — Not an official Singapore Government service. Do not submit real case data.
  </div>
);

export default function App() {
  const [profile, setProfile] = useState<WriterProfile | null>(null);

  const handleProfileReady = (p: WriterProfile) => {
    setProfile(p);
  };

  const handleSwitchWriter = () => {
    clearActiveProfile();
    setProfile(null);
  };

  // Gate: no profile → setup screen
  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <DemoBanner />
        <WriterProfileSetup onProfileReady={handleProfileReady} />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100 font-sans text-gray-900 flex flex-col">
      <DemoBanner />
      <div className="flex-1 overflow-hidden">
        <WriterDashboard
          userName={profile.writerName}
          writerProfile={profile}
          onLogout={handleSwitchWriter}
        />
      </div>
    </div>
  );
}