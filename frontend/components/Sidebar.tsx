import React from 'react';
import { DOMAINS } from '../constants';
import { FilterState } from '../types';

interface SidebarProps {
  filter: FilterState;
  onFilterChange: (newFilter: FilterState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ filter, onFilterChange }) => {
  const currentYear = new Date().getFullYear();

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

  const handleYearChange = (key: 'startYear' | 'endYear', value: number) => {
    const newFilter = { ...filter, [key]: value };
    if (key === 'startYear' && value > filter.endYear) newFilter.endYear = value;
    if (key === 'endYear' && value < filter.startYear) newFilter.startYear = value;
    onFilterChange(newFilter);
  };

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
            <h1 className="text-sm font-extrabold tracking-tighter text-academic-blue-800 dark:text-white uppercase">ScholarPulse</h1>
            <div className="h-[2px] w-full bg-academic-blue-800 dark:bg-[#8ab4f8] mt-0.5 rounded-full" />
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-8 pb-4 space-y-10 no-scrollbar">
        <div className="space-y-6">
          <h2 className="text-[10px] font-bold text-black dark:text-[#e8eaed] uppercase tracking-[0.2em] mb-4">Search Period</h2>
          <div className="space-y-6 px-1">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase text-academic-blue-400">
                <span>Start Year</span>
                <span className="text-academic-blue-800 dark:text-[#8ab4f8]">{filter.startYear}</span>
              </div>
              <input type="range" min="2000" max={currentYear} step="1" value={filter.startYear} onChange={(e) => handleYearChange('startYear', parseInt(e.target.value))} className="cursor-pointer" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase text-academic-blue-400">
                <span>End Year</span>
                <span className="text-academic-blue-800 dark:text-[#8ab4f8]">{filter.endYear}</span>
              </div>
              <input type="range" min="2000" max={currentYear} step="1" value={filter.endYear} onChange={(e) => handleYearChange('endYear', parseInt(e.target.value))} className="cursor-pointer" />
            </div>
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

      <div className="p-8 border-t border-academic-blue-300 dark:border-[#3c4043] shrink-0">
        <div className="p-4 bg-white dark:bg-academic-blue-950 rounded-xl border border-academic-blue-200 dark:border-[#3c4043] shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 bg-academic-blue-800 dark:bg-[#8ab4f8] rounded-full animate-pulse shadow-sm shadow-academic-blue-800/50" />
            <span className="text-[9px] font-extrabold text-academic-blue-500 dark:text-[#9aa0a6] uppercase tracking-widest">Archival Connection</span>
          </div>
          <p className="text-[10px] text-academic-blue-600 dark:text-[#bdc1c6] leading-relaxed font-medium italic">
            Retrieving high-impact metadata from verified institutional archives only.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;