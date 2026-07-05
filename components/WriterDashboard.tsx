import React, { useState, useEffect } from "react";
import {
  Search, Plus, Sparkles, ChevronRight, AlertCircle,
  CheckCircle2, ArrowRight, Mail, ChevronDown, User,
  FileText, BrainCircuit, Loader2, Circle, CheckCircle,
  Copy, ClipboardCheck,
} from "lucide-react";
import { OnboardingGuide } from "./OnboardingGuide";
import { streamCaseAnalysis, generateEmpathyContext } from "../services/aiService";
import { runCausalityEngine, isCausalityEngineAvailable, CausalityEngineProgress } from "../services/causalityEngine";
import { generateAllLetters, extractContextMaterial, GeneratedLetter } from "../services/letterGenerator";
import CaseDetail from "./CaseDetail";
import { Case, CaseStatus, Urgency, CausalGraph, WriterProfile } from "../types";

interface WriterDashboardProps {
  onLogout: () => void;
  userName: string;
  writerProfile: WriterProfile;
}

const URGENCY_STYLE: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border-red-200",
  High:     "bg-orange-100 text-orange-800 border-orange-200",
  Medium:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  Low:      "bg-green-100 text-green-800 border-green-200",
};

const PRIORITY_STYLE: Record<string, string> = {
  primary:   "bg-red-50 border-red-200 text-red-700",
  secondary: "bg-blue-50 border-blue-200 text-blue-700",
  long_term: "bg-gray-50 border-gray-200 text-gray-600",
};

const WriterDashboard: React.FC<WriterDashboardProps> = ({ onLogout, userName, writerProfile }) => {
  const [view, setView] = useState<"search" | "interview" | "review">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [liveNotes, setLiveNotes] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("hasSeenWriterOnboarding"));

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("hasSeenWriterOnboarding", "true");
  };

  // Co-pilot quick scan state
  const [extractedInfo, setExtractedInfo] = useState({ name: "", nric: "", issue: "", agencies: [] as string[] });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Causality Engine state
  const [causalGraph, setCausalGraph] = useState<CausalGraph | null>(null);
  const [isEngineRunning, setIsEngineRunning] = useState(false);
  const [engineStage, setEngineStage] = useState<string>("");
  const [engineStagesDone, setEngineStagesDone] = useState<string[]>([]);

  // Letter Generation state (v2 — template-based assembly)
  const [generatedLetters, setGeneratedLetters] = useState<GeneratedLetter[]>([]);
  const [isGeneratingLetters, setIsGeneratingLetters] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<string>("");
  const [includeContext, setIncludeContext] = useState(true);
  const [copiedAgency, setCopiedAgency] = useState<string>("");

  // Admin state
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [pendingAction, setPendingAction] = useState<((token: string) => void) | null>(null);
  const [isAutoScanEnabled, setIsAutoScanEnabled] = useState(false);

  // Restore session token from localStorage on mount.
  // The token is valid for 8h server-side; if it's expired the first AI call
  // will return a 401, which clears the stored token and re-prompts login.
  useEffect(() => {
    const stored = localStorage.getItem("cwi_admin_token");
    if (!stored) return;
    setAdminToken(stored);
    setIsAdminUnlocked(true);
  }, []);

  const verifyAdmin = async () => {
    if (!adminUser || !adminPass) {
      alert('Please enter Admin Credentials.');
      return;
    }
    try {
      const res = await fetch('/api/ai/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUser, password: adminPass })
      });
      if (res.ok) {
        const data = await res.json();
        setAdminToken(data.token);
        setIsAdminUnlocked(true);
        setShowAdminLogin(false);
        setAdminUser('');
        setAdminPass('');
        // Persist token so session survives page refresh (expires server-side in 8h)
        localStorage.setItem("cwi_admin_token", data.token);
        if (pendingAction) { pendingAction(data.token); setPendingAction(null); }
      } else {
        alert('Invalid Admin Credentials');
      }
    } catch (err) {
      console.error(err);
      alert('Login failed. Please check your connection to the proxy.');
    }
  };

  // Passing the fresh token as a parameter instead of closing over adminToken state
  // prevents the stale-closure bug where pendingAction captures an empty token.
  const guardAction = (action: (token: string) => void) => {
    if (isAdminUnlocked) { action(adminToken); }
    else { setPendingAction(() => action); setShowAdminLogin(true); }
  };

  const analyzeNotes = async (notes: string) => {
    guardAction(async (token: string) => {
      setIsAnalyzing(true);
      try {
        const result = await streamCaseAnalysis(notes, token);
        setExtractedInfo({
          name: result.extractedFields?.name || "",
          nric: result.extractedFields?.nric || "",
          issue: result.extractedFields?.issue || "",
          agencies: result.extractedFields?.agencies || [],
        });
        setSuggestions([
          ...(result.missingInfo || []),
          ...(result.suggestedAgencies || []).map((a: string) => `Consider referring to ${a}`),
        ]);
      } catch (error) {
        console.error("Scan failed", error);
      } finally {
        setIsAnalyzing(false);
      }
    });
  };

  useEffect(() => {
    if (!isAutoScanEnabled || !isAdminUnlocked) return;
    const timer = setTimeout(() => { if (liveNotes.length > 20) analyzeNotes(liveNotes); }, 5000);
    return () => clearTimeout(timer);
  }, [liveNotes, isAutoScanEnabled, isAdminUnlocked]);

  const handleStartNewCase = () => {
    setLiveNotes("");
    setExtractedInfo({ name: "", nric: "", issue: "", agencies: [] });
    setSuggestions([]);
    setCausalGraph(null);
    setEngineStage("");
    setEngineStagesDone([]);
    setGeneratedLetters([]);
    setSelectedAgency("");
    setView("interview");
  };

  const handleRunEngine = async () => {
    if (!liveNotes.trim()) return;
    guardAction(async (token: string) => {
      setIsEngineRunning(true);
      setCausalGraph(null);
      setEngineStage("");
      setEngineStagesDone([]);
      setGeneratedLetters([]);
      setSelectedAgency("");

      try {
        await runCausalityEngine(liveNotes, (update: CausalityEngineProgress) => {
          if (update.stage === "complete") {
            setCausalGraph(update.graph);
            const primary = update.graph.agencyRoutes.find(r => r.priority === "primary");
            if (primary) setSelectedAgency(primary.agency);
          } else {
            setEngineStagesDone(prev => [...prev, update.stage]);
            setEngineStage(update.message);
          }
        }, undefined, token);
      } catch (err: any) {
        console.error("Engine failed", err);
        if (err.message?.includes('401') || err.message?.includes('expired') || err.message?.includes('token')) {
          setIsAdminUnlocked(false);
          setAdminToken("");
          localStorage.removeItem("cwi_admin_token");
        }
        alert(`Engine error: ${err.message}`);
      } finally {
        setIsEngineRunning(false);
        setEngineStage("");
      }
    });
  };

  const handleGenerateAllLetters = async () => {
    if (!causalGraph) return;
    guardAction(async (token: string) => {
      setIsGeneratingLetters(true);
      try {
        let contextMap: Record<string, string> | undefined;
        if (includeContext) {
          const riskLabels = extractContextMaterial(causalGraph);
          if (riskLabels.length > 0) {
            contextMap = {};
            for (const route of causalGraph.agencyRoutes) {
              const ctx = await generateEmpathyContext(riskLabels, route.agency);
              if (ctx) contextMap[route.agency] = ctx;
            }
          }
        }
        const result = generateAllLetters(causalGraph, contextMap, writerProfile);
        setGeneratedLetters(result.letters);
        if (result.letters.length > 0) setSelectedAgency(result.letters[0].agency);
      } catch (error) {
        console.error("Letter generation failed", error);
      } finally {
        setIsGeneratingLetters(false);
      }
    });
  };

  const handleCopyToGather = (agency: string) => {
    const letter = generatedLetters.find(l => l.agency === agency);
    if (!letter) return;
    navigator.clipboard.writeText(letter.content);
    setCopiedAgency(agency);
    setTimeout(() => setCopiedAgency(""), 2000);
  };

  const getCaseFromGraph = (): Case | null => {
    if (!causalGraph) return null;
    const rootCauses = causalGraph.nodes.filter(n => n.type === "root_cause").map(n => n.label);
    const agencies = causalGraph.agencyRoutes.map(r => r.agency);
    return {
      id: "DRAFT-001",
      residentName: extractedInfo.name || "Resident",
      nricMasked: extractedInfo.nric || "S****XXX",
      constituency: "Unknown",
      mpName: "Your MP",
      category: causalGraph.nodes[0]?.domain || "General",
      subCategory: causalGraph.nodes[0]?.label || "",
      urgency: causalGraph.urgency.overall,
      status: CaseStatus.DRAFTING,
      summary: causalGraph.urgency.rationale,
      keyFacts: rootCauses,
      coreRequest: causalGraph.agencyRoutes[0]?.specificAsk || "",
      suggestedAgencies: agencies,
      history: [], internalNotes: [], messages: [], documents: [],
      generatedLetters: [], createdAt: new Date(), approvals: [],
    };
  };

  const engineAvailable = isCausalityEngineAvailable();

  // Stage progress display
  const STAGES = ["foundation", "reasoning", "action"];
  const STAGE_LABELS: Record<string, string> = {
    foundation: "Entities & Timeline",
    reasoning:  "Causal Graph & Gaps",
    action:     "Urgency & Routing",
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans relative">

      {/* Admin Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-96 border border-gray-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" /> Admin Authentication
            </h3>
            <p className="text-sm text-gray-500 mb-4">Admin login required to enable Auto-Scan.</p>
            <div className="space-y-3">
              <input type="text" placeholder="Admin ID" value={adminUser}
                onChange={e => setAdminUser(e.target.value)}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-red-500 outline-none" />
              <input type="password" placeholder="Password" value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-red-500 outline-none" />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setShowAdminLogin(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
                <button onClick={verifyAdmin}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Unlock</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {view !== "search" && (
            <button onClick={() => setView("search")} className="mr-2 text-gray-400 hover:text-gray-600">
              <ChevronRight className="rotate-180" size={24} />
            </button>
          )}
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent">
              Case Writer Intelligence
            </h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Digital MPS Singapore</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isAdminUnlocked && (
            <div className="flex items-center gap-2">
              <button onClick={() => setIsAutoScanEnabled(!isAutoScanEnabled)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
                  isAutoScanEnabled
                    ? "bg-purple-100 text-purple-700 border-purple-200 shadow-inner"
                    : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                }`}>
                {isAutoScanEnabled ? "⚡ Auto-Scan ON" : "Auto-Scan OFF"}
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-full border border-red-200 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3" /> Admin Unlocked
              </div>
            </div>
          )}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Wait Time: &lt; 5 mins
          </div>
          <button onClick={() => setShowOnboarding(true)}
            className="p-2 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors flex items-center gap-2 group">
            <AlertCircle size={20} className="group-hover:text-indigo-600 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 group-hover:text-indigo-600">Guide</span>
          </button>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <User className="w-4 h-4" /><span>{userName} • {writerProfile.constituency}</span>
          </div>
          <button onClick={onLogout} className="text-sm text-gray-400 hover:text-gray-600 font-medium px-2">Switch Writer</button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {view === "search" ? (
          <div className="max-w-2xl mx-auto mt-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome, {userName}</h2>
              <p className="text-gray-500">Search for an existing resident or start a new walk-in case.</p>
            </div>
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 mb-8">
              <Search className="text-gray-400 ml-4" size={20} />
              <input type="text" placeholder="Search by Name or NRIC..."
                className="flex-1 p-3 outline-none text-gray-700" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} />
              <button className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors">Search</button>
            </div>
            <div className="flex justify-center">
              <button onClick={handleStartNewCase}
                className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 transform hover:-translate-y-1">
                <Plus size={24} /> Start New Walk-in Case
              </button>
            </div>
          </div>

        ) : view === "review" && causalGraph ? (
          <div className="h-[calc(100vh-140px)]">
            <CaseDetail caseData={getCaseFromGraph()!} userRole="writer"
              onBack={() => setView("interview")} onUpdate={() => {}} />
          </div>

        ) : (
          <div className="h-[calc(100vh-140px)] flex gap-6">

            {/* LEFT: Notes OR Letter Viewer */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">

              {/* Left panel header — adapts to state */}
              {generatedLetters.length > 0 ? (
                /* ── Letter Viewer Mode ── */
                <>
                  {/* Collapsible notes */}
                  <details className="border-b border-gray-100">
                    <summary className="p-3 bg-gray-50 text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors flex items-center gap-2">
                      <FileText size={12} /> Case Notes ({liveNotes.length} chars)
                    </summary>
                    <div className="p-3 bg-gray-50/50 max-h-32 overflow-y-auto">
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{liveNotes}</p>
                    </div>
                  </details>

                  {/* Letter header with agency tabs */}
                  <div className="p-4 border-b border-gray-100 bg-blue-50/30">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <Mail className="text-blue-600" size={18} />
                        <h3 className="font-bold text-gray-900 text-sm">
                          {generatedLetters.length} Letter{generatedLetters.length > 1 ? 's' : ''} Ready
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isGeneratingLetters && (
                          <button onClick={handleGenerateAllLetters}
                            className="text-[10px] text-gray-400 underline hover:text-gray-600">Regenerate</button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {generatedLetters.map(letter => (
                        <button key={letter.agency} onClick={() => setSelectedAgency(letter.agency)}
                          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                            selectedAgency === letter.agency
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50"
                          }`}>
                          {letter.agency}
                          <span className="ml-1 text-[9px] opacity-70 capitalize">
                            {letter.priority.replace('_', ' ')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Letter content — full height */}
                  {(() => {
                    const activeLetter = generatedLetters.find(l => l.agency === selectedAgency);
                    if (!activeLetter) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select an agency tab above</div>;
                    return (
                      <>
                        <textarea
                          className="flex-1 p-5 resize-none focus:outline-none text-sm text-gray-800 font-mono leading-relaxed"
                          value={activeLetter.content}
                          onChange={e => {
                            setGeneratedLetters(prev =>
                              prev.map(l => l.agency === selectedAgency
                                ? { ...l, content: e.target.value }
                                : l
                              )
                            );
                          }}
                        />
                        <div className="p-3 border-t border-gray-100 flex flex-col gap-2 bg-gray-50">
                          {/* AI disclosure — required before copy/export */}
                          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                            <BrainCircuit size={13} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-800 leading-relaxed">
                              <strong>AI-Generated Content.</strong> This letter was assembled with AI assistance (local model). Review and approve before submitting to any agency or MP.
                            </p>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] text-gray-400">
                              {activeLetter.agencyLabel} • {activeLetter.content.length} chars
                              {activeLetter.hasContext && " • with context"}
                            </p>
                            <button onClick={() => handleCopyToGather(selectedAgency)}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                copiedAgency === selectedAgency
                                  ? "bg-green-100 text-green-700 border border-green-200"
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
                              }`}>
                              {copiedAgency === selectedAgency
                                ? <><ClipboardCheck size={12} /> Copied — fill ██ fields!</>
                                : <><Copy size={12} /> Copy to Gather</>
                              }
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>

              ) : causalGraph && !isGeneratingLetters ? (
                /* ── Ready to generate — notes with generate prompt ── */
                <>
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <button onClick={() => analyzeNotes(liveNotes)}
                      disabled={isAnalyzing || liveNotes.length < 10}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Sparkles className="w-3 h-3" />
                      {isAnalyzing ? "Scanning..." : "Scan Notes"}
                    </button>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIncludeContext(!includeContext)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                          includeContext
                            ? "bg-blue-50 text-blue-600 border-blue-200"
                            : "bg-gray-50 text-gray-400 border-gray-200"
                        }`}>
                        {includeContext ? "✓ Context" : "No Context"}
                      </button>
                      <button onClick={handleGenerateAllLetters}
                        className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full font-bold hover:bg-blue-700 transition-colors flex items-center gap-1">
                        <Mail size={12} /> Generate Letters
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="flex-1 p-6 resize-none focus:outline-none text-lg leading-relaxed text-gray-800"
                    placeholder="Type case notes here…"
                    value={liveNotes}
                    onChange={e => setLiveNotes(e.target.value)}
                  />
                  <div className="p-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                    <span>{liveNotes.length} chars</span>
                    <span>Ready — case reasoning complete</span>
                  </div>
                </>

              ) : isGeneratingLetters ? (
                /* ── Generating state ── */
                <>
                  <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <span className="text-xs font-bold text-gray-500">Case Notes</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-3">
                      <Loader2 size={20} className="text-blue-500 animate-spin" />
                      <span className="text-sm text-gray-500">
                        {includeContext ? "Generating letters with context..." : "Assembling letters..."}
                      </span>
                    </div>
                  </div>
                </>

              ) : (
                /* ── Default notes mode ── */
                <>
                  <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
                    <button onClick={() => analyzeNotes(liveNotes)}
                      disabled={isAnalyzing || liveNotes.length < 10}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Sparkles className="w-3 h-3" />
                      {isAnalyzing ? "Scanning..." : "Scan Notes"}
                    </button>
                  </div>
                  <textarea
                    className="flex-1 p-6 resize-none focus:outline-none text-lg leading-relaxed text-gray-800"
                    placeholder="Type case notes here… (e.g. 'Resident is asking for financial help because he lost his job last month...')"
                    value={liveNotes}
                    onChange={e => setLiveNotes(e.target.value)}
                  />
                  <div className="p-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                    <span>{liveNotes.length} chars</span>
                    <span>{isAnalyzing ? "AI Scanning..." : "Ready"}</span>
                  </div>
                </>
              )}
            </div>

            {/* RIGHT: Co-pilot panels */}
            <div className="w-[460px] flex flex-col gap-4 overflow-y-auto pb-4">

              {/* 1. Quick Scan */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="text-indigo-500" size={20} />
                  <h3 className="font-bold text-gray-900">Co-pilot Insights</h3>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Name</label>
                      <input type="text" className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-medium"
                        value={extractedInfo.name} readOnly placeholder="..." />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">NRIC</label>
                      <input type="text" className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-medium"
                        value={extractedInfo.nric} readOnly placeholder="..." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Live Issue Detection</label>
                    <div className="p-2 bg-indigo-50 border border-indigo-100 rounded text-sm text-indigo-900 min-h-[40px]">
                      {extractedInfo.issue || <span className="text-gray-400 italic">Listening...</span>}
                    </div>
                  </div>
                </div>
                {suggestions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Suggested Questions</h4>
                    <ul className="space-y-2">
                      {suggestions.slice(0, 3).map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-700 bg-amber-50 p-2 rounded border border-amber-100">
                          <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 2. Causality Engine */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="text-purple-600" size={20} />
                    <h3 className="font-bold text-gray-900">Case Reasoning</h3>
                    {!engineAvailable && (
                      <span className="text-[10px] text-red-500 font-medium">(API key missing)</span>
                    )}
                  </div>
                  {!causalGraph && !isEngineRunning && (
                    <button onClick={handleRunEngine}
                      disabled={!engineAvailable || liveNotes.length < 10}
                      className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-full font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors">
                      Run Reasoning
                    </button>
                  )}
                  {causalGraph && !isEngineRunning && (
                    <button onClick={handleRunEngine}
                      className="text-xs text-gray-400 underline hover:text-gray-600">Re-run</button>
                  )}
                </div>

                {/* Engine running — stage progress */}
                {isEngineRunning && (
                  <div className="space-y-3">
                    {STAGES.map(stage => {
                      const done = engineStagesDone.includes(stage);
                      const active = !done && engineStage.length > 0 && !engineStagesDone.includes(stage) &&
                        STAGES.indexOf(stage) === engineStagesDone.length;
                      return (
                        <div key={stage} className={`flex items-center gap-3 p-2 rounded-lg ${active ? "bg-purple-50" : ""}`}>
                          {done
                            ? <CheckCircle size={16} className="text-green-500 shrink-0" />
                            : active
                              ? <Loader2 size={16} className="text-purple-500 animate-spin shrink-0" />
                              : <Circle size={16} className="text-gray-300 shrink-0" />
                          }
                          <div>
                            <p className={`text-xs font-semibold ${done ? "text-green-700" : active ? "text-purple-700" : "text-gray-400"}`}>
                              {STAGE_LABELS[stage]}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-gray-400 italic mt-1">{engineStage}</p>
                  </div>
                )}

                {/* Engine results */}
                {causalGraph && !isEngineRunning && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* Urgency */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded border ${URGENCY_STYLE[causalGraph.urgency.overall] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                        {causalGraph.urgency.overall} Priority
                      </span>
                      <span className="text-xs text-gray-500 leading-tight">{causalGraph.urgency.rationale}</span>
                    </div>

                    {/* Root causes */}
                    {causalGraph.nodes.filter(n => n.type === "root_cause").length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Root Causes</label>
                        <ul className="space-y-1">
                          {causalGraph.nodes.filter(n => n.type === "root_cause").map(n => (
                            <li key={n.id} className="flex items-start gap-2 text-xs text-gray-800 bg-red-50 p-2 rounded border border-red-100">
                              <span className="text-red-400 shrink-0">▶</span>{n.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Hidden risks */}
                    {causalGraph.nodes.filter(n => n.type === "hidden_risk").length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hidden Risks</label>
                        <ul className="space-y-1">
                          {causalGraph.nodes.filter(n => n.type === "hidden_risk").map(n => (
                            <li key={n.id} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                              <span className="text-slate-400 shrink-0">⚠</span>{n.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Gaps — questions to ask */}
                    {causalGraph.gaps.filter(g => g.severity === "blocking").length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Ask Resident</label>
                        <ul className="space-y-1">
                          {causalGraph.gaps.filter(g => g.severity === "blocking").map((g, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-100">
                              <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />{g.questionToAsk}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Agency routes */}
                    {causalGraph.agencyRoutes.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Agency Routing</label>
                        <div className="space-y-1">
                          {causalGraph.agencyRoutes.map(r => (
                            <div key={r.agency}
                              className={`flex items-center justify-between p-2 rounded border text-xs ${PRIORITY_STYLE[r.priority]}`}>
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{r.agency}</span>
                                <span className="opacity-60 capitalize">{r.priority.replace("_", " ")}</span>
                              </div>
                              <span className="opacity-60">{r.estimatedProcessingDays}d</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button onClick={() => setView("review")}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-2 py-1.5 rounded font-bold transition-colors">
                        View Case Summary
                      </button>
                    </div>
                  </div>
                )}

                {!causalGraph && !isEngineRunning && (
                  <p className="text-xs text-gray-400 italic text-center py-4">
                    Run Case Reasoning to build the causal graph and identify agencies.
                  </p>
                )}
              </div>

            </div>
          </div>
        )}
      </main>

      {showOnboarding && <OnboardingGuide onClose={handleCloseOnboarding} />}
    </div>
  );
};

export default WriterDashboard;
