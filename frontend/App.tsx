import { useState, useRef, useEffect, useCallback } from 'react';
import React from 'react';
import Sidebar from './components/Sidebar';
import RegistrationModal from './components/RegistrationModal';
import { FilterState, Message } from './types';
import { MAX_FREE_TRIALS } from './constants';

interface Paper {
  title: string;
  url: string;
  venue_code: string;
  venue_type: string;
  year: number | null;
  abstract: string | null;
  authors: string[];
  doi: string | null;
}

const App: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [filter, setFilter] = useState<FilterState>({
    domain: [],
    venues: ['NeurIPS (Neural Information Processing Systems)'],
    startYear: 2025,
    endYear: 2025
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Welcome to ScholarPulse Archive. I provide precise retrieval of high-impact research from elite academic venues. Specify your research parameters to begin.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [progress, setProgress] = useState<{
    step: string;
    status: 'idle' | 'running' | 'completed' | 'error';
    message?: string;
  }>({ step: '', status: 'idle' });
  const [trialsUsed, setTrialsUsed] = useState(() => {
    const saved = localStorage.getItem('trials_used');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isRegistered, setIsRegistered] = useState(() => {
    return localStorage.getItem('is_registered') === 'true';
  });
  const [showRegModal, setShowRegModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('trials_used', trialsUsed.toString());
  }, [trialsUsed]);

  useEffect(() => {
    localStorage.setItem('is_registered', isRegistered.toString());
  }, [isRegistered]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleRegister = () => {
    setIsRegistered(true);
    setShowRegModal(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || filter.venues.length === 0) return;

    if (!isRegistered && trialsUsed >= MAX_FREE_TRIALS) {
      setShowRegModal(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // 模拟进度更新（由于API是同步的，我们模拟进度）
    const progressSteps = [
      { step: 'query_rewrite', message: '提取关键词...' },
      { step: 'search', message: '检索论文...' },
      { step: 'abstract', message: '补充摘要...' },
      { step: 'filter', message: '过滤论文...' }
    ];
    
    let stepIndex = 0;
    progressIntervalRef.current = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        setProgress({ 
          step: progressSteps[stepIndex].step, 
          status: 'running', 
          message: progressSteps[stepIndex].message 
        });
        stepIndex++;
      }
    }, 800);

    try {
      // API地址：开发环境使用localhost，生产环境使用nginx代理
      const getApiUrl = () => {
        if (import.meta.env.VITE_API_URL) {
          return import.meta.env.VITE_API_URL;
        }
        // 开发环境（localhost）
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          return 'http://localhost:8000';
        }
        // 生产环境使用nginx代理
        return '/api';
      };
      const response = await fetch(`${getApiUrl()}/v1/paper_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
          venues: filter.venues.map(v => v.split(' (')[0]), // 提取venue代码
          start_year: filter.startYear,
          end_year: filter.endYear,
          rows_each: 3,
          search_journal: true,
          search_conference: true
        })
      });

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data = await response.json();
      
      // 清除进度更新定时器
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // 更新进度为完成
      setProgress({ step: 'completed', status: 'completed', message: '搜索完成' });
      
      // 使用过滤后的论文
      setPapers(data.papers || []);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `找到 ${data.total_papers_before_filter || 0} 篇论文，过滤后剩余 ${data.papers?.length || 0} 篇相关论文。`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (!isRegistered) {
        setTrialsUsed(prev => prev + 1);
      }
    } catch (error) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setProgress({ step: 'error', status: 'error', message: '搜索失败' });
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Error: Retrieval grid unresponsive. Please verify your connection to the academic network.",
        timestamp: new Date()
      }]);
      setPapers([]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setProgress({ step: '', status: 'idle' });
      }, 2000);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-academic-blue-1000 text-academic-blue-700 dark:text-[#e8eaed] overflow-hidden transition-colors duration-300">
      <Sidebar filter={filter} onFilterChange={setFilter} />
      
      <main className="flex-1 flex flex-col h-full relative overflow-hidden border-l border-academic-blue-200 dark:border-[#3c4043]">
        {/* Academic Header - Balanced Height */}
        <header className="h-24 border-b border-academic-blue-200 dark:border-[#3c4043] bg-white/80 dark:bg-academic-blue-1000/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4 flex-1 overflow-hidden mr-4 h-full">
            <h1 className="text-sm font-bold tracking-tight text-academic-blue-800 dark:text-white lg:hidden">ScholarPulse</h1>
            <div className="hidden lg:flex items-center gap-4 flex-1 overflow-hidden h-full pt-3 pb-1">
              <div className="flex flex-col flex-1 overflow-hidden h-full justify-end">
                <span className="text-[9px] font-bold text-academic-blue-500 dark:text-[#9aa0a6] uppercase tracking-[0.2em] mb-1.5 shrink-0">Archive Filter</span>
                
                <div className="flex flex-col gap-1.5 overflow-hidden flex-1">
                  {/* Row 1: Time range box - Fixed position */}
                  <div className="flex shrink-0">
                    <span className="px-2 py-0.5 rounded bg-academic-blue-100 dark:bg-academic-blue-900/40 text-academic-blue-800 dark:text-[#8ab4f8] text-[9px] font-extrabold border border-academic-blue-300 dark:border-[#3c4043] uppercase whitespace-nowrap">
                      {filter.startYear} - {filter.endYear}
                    </span>
                  </div>
                  
                  {/* Row 2+: Selected venues - Scrollable if overflow */}
                  <div className="flex flex-wrap gap-1 items-start overflow-y-auto no-scrollbar pb-0 content-start">
                    {filter.venues.length > 0 ? (
                      filter.venues.map(v => (
                        <span key={v} className="px-1.5 py-0.5 rounded bg-academic-blue-50 dark:bg-academic-blue-950/60 text-academic-blue-600 dark:text-[#bdc1c6] text-[9px] font-extrabold border border-academic-blue-200 dark:border-[#3c4043] uppercase whitespace-nowrap">
                          {v.split(' (')[0]}
                        </span>
                      ))
                    ) : (
                      <span className="flex items-center gap-1.5 text-[9px] font-bold text-red-500 dark:text-red-400 animate-pulse py-0.5">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Select at least one conference or journal to begin retrieval
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 shrink-0 h-full">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-academic-blue-50 dark:hover:bg-[#3c4043] transition-colors text-academic-blue-500 dark:text-[#9aa0a6]"
              title="Toggle Appearance"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>

            {!isRegistered && (
              <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-academic-blue-300 dark:border-[#3c4043]">
                <span className="text-[9px] font-bold text-academic-blue-400 dark:text-[#9aa0a6] uppercase tracking-tighter">Quota</span>
                <div className="flex gap-1">
                  {[...Array(MAX_FREE_TRIALS)].map((_, i) => (
                    <div key={i} className={`h-1.5 w-4 rounded-full transition-all ${i < trialsUsed ? 'bg-academic-blue-200 dark:bg-[#3c4043]' : 'bg-academic-blue-800 dark:bg-[#8ab4f8] shadow-sm'}`} />
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={isRegistered ? undefined : () => setShowRegModal(true)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm ${
                isRegistered 
                ? 'bg-academic-blue-50 dark:bg-[#3c4043] text-academic-blue-700 dark:text-[#e8eaed]'
                : 'bg-academic-blue-800 text-white dark:bg-[#8ab4f8] dark:text-academic-blue-1000 hover:brightness-110 active:scale-95'
              }`}
            >
              {isRegistered ? 'Verified Profile' : 'Authenticate'}
            </button>
          </div>
        </header>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto px-6 md:px-12 py-10 space-y-10">
          <div className="max-w-4xl mx-auto space-y-10">
            {messages.map((msg) => (
              <div key={msg.id} className="flex justify-start animate-fade-up">
                <div className="w-full flex gap-5">
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${msg.role === 'user' ? 'bg-academic-blue-100 dark:bg-[#3c4043] text-academic-blue-600 dark:text-[#bdc1c6]' : 'bg-academic-blue-800 dark:bg-[#8ab4f8] text-white dark:text-[#202124]'}`}>
                    {msg.role === 'user' ? 'ME' : 'SP'}
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-[15px] leading-relaxed font-sans text-academic-blue-700 dark:text-[#e8eaed]">
                      {msg.content}
                    </div>
                    <div className="text-[9px] font-bold text-academic-blue-400 dark:text-[#9aa0a6] uppercase tracking-tighter opacity-60">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {papers.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-academic-blue-800 dark:text-white uppercase tracking-wider">Search Results ({papers.length} papers)</h3>
                <div className="space-y-4">
                  {papers.map((paper, index) => (
                    <div key={index} className="p-5 bg-academic-blue-50 dark:bg-academic-blue-950 border border-academic-blue-200 dark:border-[#3c4043] rounded-xl hover:border-academic-blue-800 dark:hover:border-[#8ab4f8] transition-all">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <a 
                            href={paper.url || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-base font-semibold text-academic-blue-800 dark:text-[#8ab4f8] hover:text-academic-blue-900 dark:hover:text-[#aecbfa] flex-1 leading-snug"
                          >
                            {paper.title}
                          </a>
                        </div>
                        {paper.abstract && (
                          <div className="text-sm text-academic-blue-600 dark:text-[#bdc1c6] leading-relaxed line-clamp-4">
                            {paper.abstract}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-academic-blue-500 dark:text-[#9aa0a6]">
                          <span className="font-medium">{paper.venue_code}</span>
                          {paper.year && <span>{paper.year}</span>}
                          {paper.venue_type && (
                            <span className="px-2 py-0.5 rounded bg-academic-blue-100 dark:bg-academic-blue-900/40 border border-academic-blue-200 dark:border-[#3c4043]">
                              {paper.venue_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="space-y-4">
                <div className="flex justify-start gap-5">
                  <div className="w-8 h-8 rounded-lg bg-academic-blue-50 dark:bg-academic-blue-950 animate-pulse border border-academic-blue-200 dark:border-[#3c4043]" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8] rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                        <div className="w-1.5 h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8] rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                      </div>
                      <span className="text-[11px] font-bold text-academic-blue-400 dark:text-[#9aa0a6] uppercase tracking-widest">
                        {progress.message || 'Querying Elite Archive...'}
                      </span>
                    </div>
                    
                    {/* 进度条 */}
                    <div className="space-y-2 max-w-md">
                      <div className={`flex items-center gap-2 text-xs ${progress.step === 'query_rewrite' ? 'text-academic-blue-800 dark:text-[#8ab4f8]' : 'text-academic-blue-400 dark:text-[#9aa0a6]'}`}>
                        <div className={`w-2 h-2 rounded-full ${progress.step === 'query_rewrite' ? 'bg-academic-blue-800 dark:bg-[#8ab4f8] animate-pulse' : progress.step === 'completed' ? 'bg-green-500' : 'bg-academic-blue-300 dark:bg-[#3c4043]'}`} />
                        <span className="font-medium">1. 查询改写</span>
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${progress.step === 'search' ? 'text-academic-blue-800 dark:text-[#8ab4f8]' : 'text-academic-blue-400 dark:text-[#9aa0a6]'}`}>
                        <div className={`w-2 h-2 rounded-full ${progress.step === 'search' ? 'bg-academic-blue-800 dark:bg-[#8ab4f8] animate-pulse' : progress.step === 'completed' ? 'bg-green-500' : 'bg-academic-blue-300 dark:bg-[#3c4043]'}`} />
                        <span className="font-medium">2. 论文检索</span>
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${progress.step === 'abstract' ? 'text-academic-blue-800 dark:text-[#8ab4f8]' : 'text-academic-blue-400 dark:text-[#9aa0a6]'}`}>
                        <div className={`w-2 h-2 rounded-full ${progress.step === 'abstract' ? 'bg-academic-blue-800 dark:bg-[#8ab4f8] animate-pulse' : progress.step === 'completed' ? 'bg-green-500' : 'bg-academic-blue-300 dark:bg-[#3c4043]'}`} />
                        <span className="font-medium">3. 补充摘要</span>
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${progress.step === 'filter' ? 'text-academic-blue-800 dark:text-[#8ab4f8]' : 'text-academic-blue-400 dark:text-[#9aa0a6]'}`}>
                        <div className={`w-2 h-2 rounded-full ${progress.step === 'filter' ? 'bg-academic-blue-800 dark:bg-[#8ab4f8] animate-pulse' : progress.step === 'completed' ? 'bg-green-500' : 'bg-academic-blue-300 dark:bg-[#3c4043]'}`} />
                        <span className="font-medium">4. 论文过滤</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-24" />
          </div>
        </div>

        {/* Input System */}
        <div className="px-6 md:px-12 pb-8 pt-2 bg-gradient-to-t from-white dark:from-academic-blue-1000 via-white dark:via-academic-blue-1000 to-transparent sticky bottom-0 z-20 shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="relative group rounded-2xl border border-academic-blue-300 dark:border-[#3c4043] focus-within:border-academic-blue-800 dark:focus-within:border-[#8ab4f8] transition-colors bg-white dark:bg-academic-blue-950 shadow-lg">
              <div className="relative flex items-center p-1.5">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Query archival research topic..."
                  className="flex-1 bg-transparent border-none py-3.5 px-5 text-academic-blue-700 dark:text-[#e8eaed] focus:ring-0 outline-none transition-all resize-none min-h-[48px] max-h-[160px] text-[15px] placeholder:text-academic-blue-400 dark:placeholder:text-[#9aa0a6] font-sans font-medium"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || filter.venues.length === 0}
                  className={`p-3.5 rounded-xl transition-all self-center shrink-0 ${
                    input.trim() && !isLoading && filter.venues.length > 0
                      ? 'text-academic-blue-800 dark:text-[#8ab4f8] hover:bg-academic-blue-50 dark:hover:bg-[#303134] active:scale-95' 
                      : 'text-academic-blue-200 dark:text-[#3c4043] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center px-2 mt-3">
              <p className="text-[9px] text-academic-blue-400 dark:text-[#9aa0a6] font-bold uppercase tracking-widest">ScholarPulse Grid Engine • Deep Discovery Mode</p>
              <span className="text-[9px] text-academic-blue-800 dark:text-[#8ab4f8] font-bold uppercase tracking-tighter">Institutional Integrity Verified</span>
            </div>
          </div>
        </div>

        {showRegModal && <RegistrationModal onRegister={handleRegister} />}
      </main>
    </div>
  );
};

export default App;