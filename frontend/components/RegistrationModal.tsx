import React from 'react';

interface RegistrationModalProps {
  onRegister: () => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ onRegister }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-academic-blue-950/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-academic-blue-950 border border-academic-blue-300 dark:border-[#3c4043] rounded-[1.5rem] academic-shadow max-w-md w-full p-10 animate-in zoom-in-95 duration-400 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8]" />
        
        <div className="w-16 h-16 bg-academic-blue-100 dark:bg-[#3c4043] text-academic-blue-800 dark:text-[#8ab4f8] rounded-2xl flex items-center justify-center mx-auto mb-8 academic-shadow">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 11V7a4 4 0 00-8 0v4h8z M12 11v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6h8z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-extrabold text-academic-blue-900 dark:text-[#e8eaed] mb-4 tracking-tight">Institutional Session Required</h2>
        <p className="text-academic-blue-500 dark:text-[#bdc1c6] mb-10 leading-relaxed text-sm font-medium">
          The public archival access quota has been reached. Please authenticate via your institutional credentials to continue researching within the elite grid.
        </p>
        
        <div className="space-y-3">
          <button 
            onClick={onRegister}
            className="w-full bg-academic-blue-800 dark:bg-[#8ab4f8] dark:text-[#202124] hover:bg-academic-blue-900 text-white font-bold py-3.5 px-8 rounded-xl transition-all academic-shadow active:scale-[0.98]"
          >
            Authenticate Profile
          </button>
          <button className="w-full text-academic-blue-800 dark:text-[#8ab4f8] text-[10px] font-bold uppercase tracking-widest hover:text-academic-blue-900 dark:hover:text-[#aecbfa] py-2 transition-colors">
            SSO / Shibboleth Sign-In
          </button>
        </div>
        
        <div className="mt-10 pt-6 border-t border-academic-blue-100 dark:border-[#3c4043]">
          <p className="text-[9px] text-academic-blue-400 dark:text-[#9aa0a6] uppercase tracking-[0.4em] font-extrabold">
            ScholarPulse Security Protocol • v2.6.2
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegistrationModal;