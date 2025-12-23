export interface Paper {
  title: string;
  authors: string[];
  year: string;
  venue: string;
  abstract: string;
  url: string;
}

export interface Venue {
  id: string;
  name: string;
}

export interface VenueCategory {
  type: 'Conference' | 'Journal';
  items: Venue[];
}

export interface DomainFilter {
  id: 'cs' | 'business';
  label: string;
  categories: VenueCategory[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  papers?: Paper[];
  sources?: Array<{ title: string; uri: string }>;
  timestamp: Date;
}

export interface FilterState {
  domain: string[];
  venues: string[];
  startYear: number;
  endYear: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}