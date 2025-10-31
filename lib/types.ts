// Toggl API Types
export interface Workspace {
  id: number;
  name: string;
  profile: number;
  premium: boolean;
  admin: boolean;
  default_hourly_rate: number | null;
  default_currency: string;
  only_admins_may_create_projects: boolean;
  only_admins_see_billable_rates: boolean;
  only_admins_see_team_dashboard: boolean;
  projects_billable_by_default: boolean;
  rounding: number;
  rounding_minutes: number;
  api_token: string;
  at: string;
  logo_url: string;
}

export interface Client {
  id: number;
  name: string;
  wid: number;
  notes?: string;
  at: string;
  archived: boolean;
}

export interface Project {
  id: number;
  name: string;
  wid: number;
  cid: number | null;
  active: boolean;
  is_private: boolean;
  template: boolean;
  template_id: number | null;
  billable: boolean;
  auto_estimates: boolean;
  estimated_hours: number | null;
  at: string;
  color: string;
  rate: number | null;
  created_at: string;
  foreign_id: string | null;
}

export interface Tag {
  id: number;
  name: string;
  wid: number | null;
  at: string;
}

export interface User {
  id: number;
  api_token: string;
  default_wid: number;
  email: string;
  fullname: string;
  jquery_timeofday_format: string;
  jquery_date_format: string;
  timeofday_format: string;
  date_format: string;
  store_start_and_stop_time: boolean;
  beginning_of_week: number;
  language: string;
  image_url: string;
  sidebar_piechart: boolean;
  at: string;
  created_at: string;
  retention: number;
  record_timeline: boolean;
  render_timeline: boolean;
  timeline_enabled: boolean;
  timeline_experiment: boolean;
  manual_mode: boolean;
  new_blog_post: any;
  should_see_beta_modal: boolean;
  invitation: any;
  workspaces: number[];
  duration_format: string;
}

export interface Me {
  id: number;
  api_token: string;
  default_wid: number;
  email: string;
  fullname: string;
  jquery_timeofday_format: string;
  jquery_date_format: string;
  timeofday_format: string;
  date_format: string;
  store_start_and_stop_time: boolean;
  beginning_of_week: number;
  language: string;
  image_url: string;
  sidebar_piechart: boolean;
  at: string;
  created_at: string;
  retention: number;
  record_timeline: boolean;
  render_timeline: boolean;
  timeline_enabled: boolean;
  timeline_experiment: boolean;
  manual_mode: boolean;
  new_blog_post: any;
  should_see_beta_modal: boolean;
  invitation: any;
  workspaces: Workspace[];
  clients: Client[];
  projects: Project[];
  tags: Tag[];
  user: User;
}

export interface TimeEntry {
  id: number;
  guid: string;
  wid: number;
  pid: number | null;
  billable: boolean;
  start: string;
  stop: string | null;
  duration: number;
  description: string;
  duronly: boolean;
  at: string;
  uid: number;
  tags: string[];
  location?: string;
  // Enriched fields
  project_name?: string;
  client_name?: string;
  tag_names?: string[];
  user_name?: string;
}

// Internal App Types
export interface ApiKeyInfo {
  key: string;
  fullname: string;
  email: string;
  workspaces: Workspace[];
  clients: Client[];
  projects: Project[];
  tags: Tag[];
  id: string; // Internal ID for tracking
}

export interface ReportConfig {
  id: string;
  selectedApiKey: string;
  selectedWorkspace?: number; // Workspace ID específico (opcional, por defecto usa el primero)
  selectedClient?: string;
  selectedProject?: string;
  selectedTag?: string;
}

export interface GroupedEntry {
  description: string;
  totalDuration: number;
  count: number;
  projects: Set<string>;
  clients: Set<string>;
  tags: Set<string>;
}


