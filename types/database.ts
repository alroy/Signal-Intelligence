export interface PmProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Objective {
  id: string;
  pm_id: string;
  title: string;
  status: "active" | "paused" | "resolved";
  decomposition: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  objective_id: string;
  pm_id: string;
  source: string;
  source_timestamp: string | null;
  account: string | null;
  content_summary: string;
  original_content: string | null;
  source_language: string;
  speaker_role: string | null;
  source_reference: Record<string, unknown> | null;
  relevance_score: number;
  explanation: string;
  category: "opportunity" | "risk" | "info";
  urgency: "act_now" | "this_week" | "background";
  cluster_id: string | null;
  monday_item_id: string | null;
  feedback: "pending" | "confirmed" | "dismissed";
  feedback_at: string | null;
  created_at: string;
}

export interface Cluster {
  id: string;
  pm_id: string;
  account: string | null;
  situation_summary: string;
  combined_urgency: string;
  created_at: string;
}

export interface MatchWithCluster extends Match {
  cluster: Pick<Cluster, "id" | "situation_summary" | "combined_urgency"> | null;
}

export interface PmFeedback {
  id: string;
  pm_id: string;
  match_id: string;
  objective_id: string;
  signal_content_summary: string | null;
  match_explanation: string | null;
  feedback_type: string;
  created_at: string;
}

export interface SharedPattern {
  id: string;
  pattern_description: string;
  source_type: string;
  source_subtype: string | null;
  category: string | null;
  confirmations: number;
  dismissals: number;
  readonly confidence: number;
  contributing_pm_ids: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
