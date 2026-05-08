import React from 'react';
import { X, ChevronRight, AlertCircle, ArrowRight } from 'lucide-react';

interface OnboardingGuideProps {
  onClose: () => void;
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ onClose }) => {
  const [step, setStep] = React.useState(1);

  const steps = [
    {
      title: "1. Input Case Notes",
      description: "Start by typing the resident's story into the 'Live Interview Notes' section. The AI observes your typing in real-time.",
      image: "/step1.png"
    },
    {
      title: "2. Run Deep Analysis",
      description: "Click 'Run Analysis' to trigger the AI. It will classify the case, determine urgency, and find hidden implications.",
      image: "/step2.png"
    },
    {
      title: "3. Smart Classification & Tags",
      description: "Review the 'Deep Classification' card. Tags like 'High Priority' or 'Critical' indicate urgent needs.",
      alert: "High/Critical Priority tags will automatically enable the 'Meet-the-People' session auto-scheduler helper.",
      image: "/step3.png"
    },
    {
      title: "4. Generate Action",
      description: "Select an agency and click 'Generate Letter' to instantly draft a formal appeal specifically tailored to the case facts.",
      image: "/step4.png"
    }
  ];

  const currentStep = steps[step - 1];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">How to use Case-Writer Copilot</h2>
            <p className="text-sm text-gray-500">Step {step} of {steps.length}: {currentStep.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex flex-col items-center text-center">
            
            <div className="w-full h-64 bg-slate-50 rounded-xl mb-6 flex items-center justify-center border border-slate-100 overflow-hidden relative">
                <img 
                    src={currentStep.image} 
                    alt={currentStep.title} 
                    className="w-full h-full object-contain"
                />
            </div>

            <p className="text-lg text-gray-700 mb-4 max-w-lg">{currentStep.description}</p>

            {currentStep.alert && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-3 text-left max-w-lg">
                    <AlertCircle className="text-orange-600 shrink-0" size={24} />
                    <p className="text-sm text-orange-800 font-medium">
                        {currentStep.alert}
                    </p>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="flex gap-2">
                {steps.map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-2 h-2 rounded-full transition-colors ${i + 1 === step ? 'bg-blue-600' : 'bg-gray-300'}`}
                    />
                ))}
            </div>
            
            <button 
                onClick={() => {
                    if (step < steps.length) {
                        setStep(s => s + 1);
                    } else {
                        onClose();
                    }
                }}
                className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
                {step < steps.length ? (
                    <>Next Step <ChevronRight size={18} /></>
                ) : (
                    <>Get Started <ArrowRight size={18} /></>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};
