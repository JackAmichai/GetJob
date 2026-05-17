export interface Job {
  id: number;
  company: string;
  title: string;
  location: string;
  url: string;
  scraped_at: string;
  posted_at: string | null;
  relevance_score: number | null;
  tech_score: number | null;
  experience_score: number | null;
  geography_score: number | null;
  brief: string | null;
  analyzed_at: string | null;
  notified: boolean;
  dismissed: boolean;
  starred: boolean;
}

export interface Portal {
  id: number;
  name: string;
  ats_type: 'workday' | 'greenhouse' | 'lever' | 'generic';
  board_url: string;
  company: string;
  is_active: boolean;
  last_scanned_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface AppSettings {
  default_location: string;
  default_email: string;
  relevance_threshold: number;
  scan_cron: string;
  llm_provider: string;
}

export interface Stats {
  total_jobs: number;
  scored_jobs: number;
  high_match_jobs: number;
  portals_active: number;
  last_scan_at: string | null;
}

export interface TriggerResult {
  status: string;
  portals_scraped: number;
  scrape_errors: number;
  jobs_scored: number;
  digest_jobs_included: number;
}
