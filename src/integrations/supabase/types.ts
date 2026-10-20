export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      autosim_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          parent_job_id: string | null
          result: Json | null
          scenario: string
          stage_log: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          parent_job_id?: string | null
          result?: Json | null
          scenario: string
          stage_log?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          parent_job_id?: string | null
          result?: Json | null
          scenario?: string
          stage_log?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autosim_jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "autosim_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      kill_switch_alerts: {
        Row: {
          created_at: string
          id: string
          level: string
          payload: Json
          reason: string
          source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          payload?: Json
          reason: string
          source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          payload?: Json
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          canonical_url: string
          fetched_at: string
          id: string
          ingestion_method: string
          language: string | null
          published_at: string | null
          source: string
          source_country: string
          source_id: string
          title: string
        }
        Insert: {
          canonical_url: string
          fetched_at?: string
          id: string
          ingestion_method: string
          language?: string | null
          published_at?: string | null
          source: string
          source_country: string
          source_id: string
          title: string
        }
        Update: {
          canonical_url?: string
          fetched_at?: string
          id?: string
          ingestion_method?: string
          language?: string | null
          published_at?: string | null
          source?: string
          source_country?: string
          source_id?: string
          title?: string
        }
        Relationships: []
      }
      news_context_budget: {
        Row: {
          attempts: number
          window_start: string
        }
        Insert: {
          attempts: number
          window_start: string
        }
        Update: {
          attempts?: number
          window_start?: string
        }
        Relationships: []
      }
      news_context_queue: {
        Row: {
          id: number
          last_attempt: string | null
          last_error: string | null
          lease_token: string | null
          lease_until: string | null
          processed_revision: number
          revision: number
        }
        Insert: {
          id: number
          last_attempt?: string | null
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          processed_revision?: number
          revision?: number
        }
        Update: {
          id?: number
          last_attempt?: string | null
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          processed_revision?: number
          revision?: number
        }
        Relationships: []
      }
      news_prompt_versions: {
        Row: {
          context: Json
          expires_at: string
          generated_at: string
          source_revision: number
          version: number
        }
        Insert: {
          context: Json
          expires_at: string
          generated_at?: string
          source_revision: number
          version?: never
        }
        Update: {
          context?: Json
          expires_at?: string
          generated_at?: string
          source_revision?: number
          version?: never
        }
        Relationships: []
      }
      quantum_billing_config: {
        Row: {
          currency: string
          est_qpu_secs_per_qubit_shot: number
          ibm_configured: boolean
          id: number
          markup_bp: number
          max_qubits: number
          provider_rate_cents_per_qpu_sec: number
          quote_ttl_seconds: number
          stripe_configured: boolean
          updated_at: string
        }
        Insert: {
          currency?: string
          est_qpu_secs_per_qubit_shot?: number
          ibm_configured?: boolean
          id?: number
          markup_bp?: number
          max_qubits?: number
          provider_rate_cents_per_qpu_sec?: number
          quote_ttl_seconds?: number
          stripe_configured?: boolean
          updated_at?: string
        }
        Update: {
          currency?: string
          est_qpu_secs_per_qubit_shot?: number
          ibm_configured?: boolean
          id?: number
          markup_bp?: number
          max_qubits?: number
          provider_rate_cents_per_qpu_sec?: number
          quote_ttl_seconds?: number
          stripe_configured?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      quantum_job_events: {
        Row: {
          created_at: string
          data: Json
          event: string
          id: string
          job_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          event: string
          id?: string
          job_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          event?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quantum_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "quantum_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      quantum_jobs: {
        Row: {
          adjustment_cents: number
          approved_cap_cents: number | null
          authorized_at: string | null
          backend: string | null
          charge_cents: number | null
          created_at: string
          currency: string
          data_hash: string | null
          error: string | null
          est_qpu_secs: number
          id: string
          idempotency_key: string
          markup_cents: number | null
          n_qubits: number
          payment_intent_id: string | null
          payment_provider: string | null
          payment_status: string
          provider_cost_cents: number | null
          provider_job_id: string | null
          provider_reported_qpu_secs: number | null
          quote_cents: number
          quote_expires_at: string | null
          rate_snapshot: Json
          refund_cents: number
          settlement_status: string
          shots: number
          status: string
          strategy_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_cents?: number
          approved_cap_cents?: number | null
          authorized_at?: string | null
          backend?: string | null
          charge_cents?: number | null
          created_at?: string
          currency?: string
          data_hash?: string | null
          error?: string | null
          est_qpu_secs: number
          id?: string
          idempotency_key: string
          markup_cents?: number | null
          n_qubits: number
          payment_intent_id?: string | null
          payment_provider?: string | null
          payment_status?: string
          provider_cost_cents?: number | null
          provider_job_id?: string | null
          provider_reported_qpu_secs?: number | null
          quote_cents: number
          quote_expires_at?: string | null
          rate_snapshot?: Json
          refund_cents?: number
          settlement_status?: string
          shots: number
          status?: string
          strategy_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment_cents?: number
          approved_cap_cents?: number | null
          authorized_at?: string | null
          backend?: string | null
          charge_cents?: number | null
          created_at?: string
          currency?: string
          data_hash?: string | null
          error?: string | null
          est_qpu_secs?: number
          id?: string
          idempotency_key?: string
          markup_cents?: number | null
          n_qubits?: number
          payment_intent_id?: string | null
          payment_provider?: string | null
          payment_status?: string
          provider_cost_cents?: number | null
          provider_job_id?: string | null
          provider_reported_qpu_secs?: number | null
          quote_cents?: number
          quote_expires_at?: string | null
          rate_snapshot?: Json
          refund_cents?: number
          settlement_status?: string
          shots?: number
          status?: string
          strategy_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scenario_synthesis_limits: {
        Row: {
          requests: number
          user_id: string
          window_start: string
        }
        Insert: {
          requests?: number
          user_id: string
          window_start: string
        }
        Update: {
          requests?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
          plan: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      synthesis_history: {
        Row: {
          antithesis: Json | null
          created_at: string
          id: string
          narrative: string | null
          score: number | null
          synthesis: Json | null
          thesis: Json | null
        }
        Insert: {
          antithesis?: Json | null
          created_at?: string
          id?: string
          narrative?: string | null
          score?: number | null
          synthesis?: Json | null
          thesis?: Json | null
        }
        Update: {
          antithesis?: Json | null
          created_at?: string
          id?: string
          narrative?: string | null
          score?: number | null
          synthesis?: Json | null
          thesis?: Json | null
        }
        Relationships: []
      }
      tor_entries: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          ping_ms: number | null
          source: string
          status: string
          tags: string[]
          updated_at: string
          url: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          ping_ms?: number | null
          source?: string
          status?: string
          tags?: string[]
          updated_at?: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          ping_ms?: number | null
          source?: string
          status?: string
          tags?: string[]
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      trade_history: {
        Row: {
          created_at: string
          id: string
          instrument: string
          meta: Json
          mode: string
          pnl: number | null
          price: number
          qty: number
          side: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrument: string
          meta?: Json
          mode?: string
          pnl?: number | null
          price: number
          qty: number
          side: string
        }
        Update: {
          created_at?: string
          id?: string
          instrument?: string
          meta?: Json
          mode?: string
          pnl?: number | null
          price?: number
          qty?: number
          side?: string
        }
        Relationships: []
      }
      warm_state: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_news_context: {
        Args: never
        Returns: {
          source_revision: number
          token: string
        }[]
      }
      claim_scenario_synthesis: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      finish_news_context: {
        Args: {
          p_context: Json
          p_error?: string
          p_revision: number
          p_token: string
        }
        Returns: boolean
      }
      news_context_status: { Args: never; Returns: Json }
      vv_autosim_has_access: { Args: { p_user_id: string }; Returns: boolean }
      vv_claim_autosim: {
        Args: {
          p_job_id: string
          p_limit: number
          p_parent_id: string
          p_scenario: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
