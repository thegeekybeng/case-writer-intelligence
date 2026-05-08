import React, { useState } from 'react';
import WriterDashboard from './components/WriterDashboard';
import { WriterProfileSetup } from './components/WriterProfileSetup';
import { WriterProfile } from './types';
import { clearActiveProfile } from './services/profileService';

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
    return <WriterProfileSetup onProfileReady={handleProfileReady} />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-100 font-sans text-gray-900">
      <WriterDashboard
        userName={profile.writerName}
        writerProfile={profile}
        onLogout={handleSwitchWriter}
      />
    </div>
  );
}