import React from "react";
import { Case, UserRole } from "../types";
import { ArrowLeft, User, Calendar, AlertCircle } from "lucide-react";

interface CaseDetailProps {
  caseData: Case;
  userRole: UserRole;
  onBack: () => void;
  onUpdate: (updatedCase: Case) => void;
}

const CaseDetail: React.FC<CaseDetailProps> = ({ caseData, onBack }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50 rounded-t-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Case #{caseData.id.slice(-4)}
              <span className="text-sm font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                {caseData.status}
              </span>
            </h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <User size={14} /> {caseData.residentName} (
                {caseData.nricMasked})
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={14} />{" "}
                {new Date(caseData.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1
              ${
                caseData.urgency === "Critical"
                  ? "bg-red-100 text-red-800"
                  : caseData.urgency === "High"
                  ? "bg-orange-100 text-orange-800"
                  : "bg-blue-100 text-blue-800"
              }`}
          >
            <AlertCircle size={14} />
            {caseData.urgency} Urgency
          </div>
        </div>
      </div>

      {/* Content - Simplified for Writer Focus */}
      <div className="p-8 flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Core Issue Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
              Issue Summary
            </h3>
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 text-gray-700 leading-relaxed">
              {caseData.summary || "No description provided."}
            </div>
          </div>

          {/* AI Analysis Snapshot (Placeholder for future expansion) */}
          {caseData.category && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Category
                </h4>
                <div className="font-medium text-gray-900 bg-white border border-gray-200 p-3 rounded-lg">
                  {caseData.category} <span className="text-gray-400">/</span>{" "}
                  {caseData.subCategory}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Key Factors
                </h4>
                <div className="font-medium text-gray-900 bg-white border border-gray-200 p-3 rounded-lg">
                  {caseData.keyFacts?.join(", ") || "None identified"}
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
            <strong>Writer Mode:</strong> Use the Dashboard to perform deep
            analysis and generate letters. This view provides a quick reference
            to the case basics.
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseDetail;
