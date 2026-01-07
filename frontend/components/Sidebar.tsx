import React, { useState, useEffect, useRef } from 'react';
import { DOMAINS } from '../constants';
import { FilterState, Conversation } from '../types';

interface SidebarProps {
  filter: FilterState;
  onFilterChange: (newFilter: FilterState) => void;
  conversations: Conversation[];
  currentConversationId: string;
  onNewConversation: () => void;
  onSwitchConversation: (conversationId: string) => void;
  onClearConversations: () => void;
  onDeleteConversation: (conversationId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  filter, 
  onFilterChange,
  conversations,
  currentConversationId,
  onNewConversation,
  onSwitchConversation,
  onClearConversations,
  onDeleteConversation
}) => {
  const currentYear = new Date().getFullYear();
  const [yearsOpen, setYearsOpen] = useState(false);
  const yearsRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (yearsRef.current && !yearsRef.current.contains(event.target as Node)) {
        setYearsOpen(false);
      }
    };

    if (yearsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [yearsOpen]);

  const toggleDomain = (domainId: string) => {
    const isSelected = filter.domain.includes(domainId);
    onFilterChange({
      ...filter,
      domain: isSelected 
        ? filter.domain.filter(id => id !== domainId)
        : [...filter.domain, domainId]
    });
  };

  const toggleVenue = (venueName: string) => {
    const isSelected = filter.venues.includes(venueName);
    
    onFilterChange({
      ...filter,
      venues: isSelected
        ? filter.venues.filter(v => v !== venueName)
        : [...filter.venues, venueName]
    });
  };

  const toggleCategory = (venueNames: string[]) => {
    const allSelectedInCat = venueNames.every(name => filter.venues.includes(name));
    
    if (allSelectedInCat) {
      // Deselect all from this category
      const remainingVenues = filter.venues.filter(v => !venueNames.includes(v));
      onFilterChange({
        ...filter,
        venues: remainingVenues
      });
    } else {
      // Add all from this category
      const newVenues = Array.from(new Set([...filter.venues, ...venueNames]));
      onFilterChange({
        ...filter,
        venues: newVenues
      });
    }
  };

  // 切换年份选择
  const toggleYear = (year: number) => {
    const isSelected = filter.years.includes(year);
    if (isSelected) {
      // 如果取消选择，确保至少保留一个年份
      if (filter.years.length > 1) {
        onFilterChange({
          ...filter,
          years: filter.years.filter(y => y !== year)
        });
      }
    } else {
      // 添加年份
      onFilterChange({
        ...filter,
        years: [...filter.years, year].sort((a, b) => b - a) // 降序排列
      });
    }
  };

  // 生成年份列表（从当前年份到2000年，降序）
  const generateYearList = () => {
    const years: number[] = [];
    for (let year = currentYear; year >= 2000; year--) {
      years.push(year);
    }
    return years;
  };

  const yearList = generateYearList();

  const formatVenueName = (fullName: string) => {
    const parts = fullName.split(' (');
    if (parts.length > 1) {
      return (
        <>
          <span className="font-extrabold">{parts[0]}</span>
          <span className="opacity-70 font-normal"> ({parts[1]}</span>
        </>
      );
    }
    return <span className="font-extrabold">{fullName}</span>;
  };

  return (
    <div className="w-72 h-full bg-academic-blue-50 dark:bg-academic-blue-1000 flex flex-col hidden lg:flex transition-colors relative z-40 overflow-hidden border-r border-academic-blue-200 dark:border-zinc-800 shrink-0">
      <div className="p-8 pb-4 shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 bg-academic-blue-800 dark:bg-[#3c4043] rounded-lg flex items-center justify-center text-white dark:text-[#e8eaed] shadow-md">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l11 6l9-4.91V17h2V9L12 3z"/></svg>
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tighter text-academic-blue-800 dark:text-white uppercase">FindPaper</h1>
            <div className="h-[2px] w-full bg-academic-blue-800 dark:bg-[#8ab4f8] mt-0.5 rounded-full" />
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-8 pb-4 space-y-10 no-scrollbar">
        {/* 对话管理区域 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-bold text-black dark:text-[#e8eaed] uppercase tracking-[0.2em]">Conversations</h2>
            <div className="flex items-center gap-1">
              {conversations.length > 1 && (
                <button
                  onClick={onClearConversations}
                  className="p-1.5 rounded-lg hover:bg-academic-blue-100 dark:hover:bg-[#3c4043] transition-colors text-academic-blue-600 dark:text-[#8ab4f8]"
                  title="Clear All Conversations"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            <button
              onClick={onNewConversation}
              className="p-1.5 rounded-lg hover:bg-academic-blue-100 dark:hover:bg-[#3c4043] transition-colors text-academic-blue-600 dark:text-[#8ab4f8]"
              title="New Conversation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            </div>
          </div>
          
          <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`w-full rounded-lg transition-all group ${
                  currentConversationId === conv.id
                    ? 'bg-academic-blue-200 dark:bg-[#3c4043]'
                    : 'hover:bg-academic-blue-100 dark:hover:bg-[#303134]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => onSwitchConversation(conv.id)}
                    className={`flex-1 min-w-0 text-left p-2.5 rounded-lg transition-all ${
                      currentConversationId === conv.id
                        ? 'text-academic-blue-800 dark:text-[#e8eaed]'
                        : 'text-academic-blue-600 dark:text-[#bdc1c6]'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="text-[11px] font-semibold truncate">
                          {conv.title}
                        </div>
                        <div className="text-[9px] text-academic-blue-400 dark:text-[#9aa0a6] mt-0.5 truncate">
                          {new Date(conv.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </button>
                  {conversations.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        onDeleteConversation(conv.id);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                      }}
                      onMouseUp={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="p-1.5 mr-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-academic-blue-200 dark:hover:bg-[#3c4043] transition-all text-academic-blue-500 dark:text-[#9aa0a6] hover:text-red-500 dark:hover:text-red-400 shrink-0 flex-shrink-0"
                      title="删除对话"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-[10px] font-bold text-black dark:text-[#e8eaed] uppercase tracking-[0.2em] mb-4">Search Period</h2>
          <div className="relative" ref={yearsRef}>
            <button 
              onClick={() => setYearsOpen(!yearsOpen)}
              className="w-full bg-academic-blue-100 dark:bg-[#303134] border border-academic-blue-300 dark:border-[#3c4043] rounded-lg px-3 py-2.5 flex items-center justify-between text-[12px] text-academic-blue-600 dark:text-[#bdc1c6] font-semibold hover:bg-academic-blue-200 dark:hover:bg-[#3c4043] transition-all shadow-sm"
            >
              <span className="truncate">
                {filter.years.length === 0 
                  ? 'Select Years' 
                  : filter.years.length === 1
                  ? `${filter.years[0]}`
                  : `${filter.years.length} Years Selected`}
              </span>
              <svg 
                className={`w-3.5 h-3.5 text-academic-blue-500 dark:text-[#9aa0a6] transition-transform ${yearsOpen ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {yearsOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-academic-blue-1000 backdrop-blur-xl border border-academic-blue-200 dark:border-[#3c4043] rounded-lg shadow-2xl z-50 max-h-72 overflow-y-auto no-scrollbar p-1.5 animate-fade-up">
                {yearList.map(year => {
                  const isSelected = filter.years.includes(year);
                  return (
                    <div 
                      key={year}
                      onClick={() => toggleYear(year)}
                      className={`px-3 py-2 text-[12px] flex items-center justify-between cursor-pointer rounded-lg transition-colors mb-0.5 last:mb-0 ${
                        isSelected
                          ? 'bg-academic-blue-800 dark:bg-[#8ab4f8] text-white dark:text-[#202124] font-bold'
                          : 'text-academic-blue-600 dark:text-[#bdc1c6] hover:bg-academic-blue-100 dark:hover:bg-[#303134]'
                      }`}
                    >
                      <span>{year}</span>
                      {isSelected && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[10px] font-bold text-black dark:text-[#e8eaed] uppercase tracking-[0.2em] mb-4">Discovery Domains</h2>
          {DOMAINS.map(domain => (
            <div key={domain.id} className="space-y-1.5">
              <button 
                onClick={() => toggleDomain(domain.id)}
                className={`w-full group flex items-center justify-between p-2.5 rounded-lg transition-all ${
                  filter.domain.includes(domain.id) 
                  ? 'bg-academic-blue-200 dark:bg-[#3c4043] text-academic-blue-700 dark:text-[#e8eaed] font-bold' 
                  : 'text-academic-blue-500 dark:text-[#bdc1c6] hover:bg-academic-blue-100 dark:hover:bg-[#303134]'
                }`}
              >
                <span className="text-[12px] font-bold tracking-tight uppercase">{domain.label}</span>
                <svg className={`w-3 h-3 transition-transform ${filter.domain.includes(domain.id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {filter.domain.includes(domain.id) && (
                <div className="pl-3 py-2 space-y-4 border-l border-academic-blue-300 dark:border-[#3c4043] ml-2 animate-fade-up">
                  {domain.categories.map(category => {
                    const venueNames = category.items.map(i => i.name);
                    const allSelected = venueNames.every(v => filter.venues.includes(v));
                    return (
                      <div key={category.type}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-[9px] font-bold text-academic-blue-500 dark:text-[#9aa0a6] uppercase tracking-widest">{category.type}s</h3>
                          <label className="flex items-center gap-1.5 cursor-pointer group/all">
                            <span className="text-[8px] font-bold text-academic-blue-400 dark:text-[#5f6368] uppercase opacity-0 group-hover/all:opacity-100 transition-opacity">Select All</span>
                            <input 
                              type="checkbox" 
                              checked={allSelected}
                              onChange={() => toggleCategory(venueNames)}
                              className="h-2.5 w-2.5 appearance-none rounded border border-academic-blue-300 dark:border-[#3c4043] checked:bg-academic-blue-500 dark:checked:bg-[#8ab4f8] transition-all cursor-pointer"
                            />
                          </label>
                        </div>
                        <div className="space-y-1">
                          {category.items.map(venue => (
                            <label key={venue.id} className="group flex items-center gap-2.5 cursor-pointer py-1">
                              <div className="relative flex items-center">
                                <input 
                                  type="checkbox"
                                  className="peer h-3.5 w-3.5 appearance-none rounded border border-academic-blue-300 dark:border-[#3c4043] bg-transparent checked:bg-academic-blue-800 dark:checked:bg-[#8ab4f8] checked:border-transparent transition-all"
                                  checked={filter.venues.includes(venue.name)}
                                  onChange={() => toggleVenue(venue.name)}
                                />
                                <svg className="pointer-events-none absolute left-[1px] top-[1px] h-2.5 w-2.5 text-white dark:text-[#202124] opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                  <path d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <span className="text-[11px] text-academic-blue-600 dark:text-[#bdc1c6] group-hover:text-academic-blue-800 dark:group-hover:text-white transition-colors truncate">
                                {formatVenueName(venue.name)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;