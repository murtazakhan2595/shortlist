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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          blocked_reason: string | null
          body: string | null
          capture_id: string | null
          created_at: string
          cv_file_id: string | null
          email_pattern_id: string | null
          fingerprint: string
          form_image_paths: string[]
          gmail_draft_id: string | null
          id: string
          listing_id: string | null
          presented_title: string | null
          recipient_email: string | null
          route: string
          sent_at: string | null
          status: string
          subject: string | null
          writer_lease_until: string | null
        }
        Insert: {
          blocked_reason?: string | null
          body?: string | null
          capture_id?: string | null
          created_at?: string
          cv_file_id?: string | null
          email_pattern_id?: string | null
          fingerprint: string
          form_image_paths?: string[]
          gmail_draft_id?: string | null
          id?: string
          listing_id?: string | null
          presented_title?: string | null
          recipient_email?: string | null
          route: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          writer_lease_until?: string | null
        }
        Update: {
          blocked_reason?: string | null
          body?: string | null
          capture_id?: string | null
          created_at?: string
          cv_file_id?: string | null
          email_pattern_id?: string | null
          fingerprint?: string
          form_image_paths?: string[]
          gmail_draft_id?: string | null
          id?: string
          listing_id?: string | null
          presented_title?: string | null
          recipient_email?: string | null
          route?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          writer_lease_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_capture_id_fkey"
            columns: ["capture_id"]
            isOneToOne: false
            referencedRelation: "captures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_cv_file_id_fkey"
            columns: ["cv_file_id"]
            isOneToOne: false
            referencedRelation: "cv_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_email_pattern_id_fkey"
            columns: ["email_pattern_id"]
            isOneToOne: false
            referencedRelation: "current_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_email_pattern_id_fkey"
            columns: ["email_pattern_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      captures: {
        Row: {
          company: string | null
          contact_email: string | null
          created_at: string
          email_confirmed: boolean
          fingerprint: string | null
          form_url: string | null
          id: string
          image_paths: string[]
          input_type: string
          post_url: string | null
          poster_name: string | null
          raw_text: string | null
          role: string | null
          run_id: string | null
          status: string
        }
        Insert: {
          company?: string | null
          contact_email?: string | null
          created_at?: string
          email_confirmed?: boolean
          fingerprint?: string | null
          form_url?: string | null
          id?: string
          image_paths?: string[]
          input_type: string
          post_url?: string | null
          poster_name?: string | null
          raw_text?: string | null
          role?: string | null
          run_id?: string | null
          status?: string
        }
        Update: {
          company?: string | null
          contact_email?: string | null
          created_at?: string
          email_confirmed?: boolean
          fingerprint?: string | null
          form_url?: string | null
          id?: string
          image_paths?: string[]
          input_type?: string
          post_url?: string | null
          poster_name?: string | null
          raw_text?: string | null
          role?: string | null
          run_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "captures_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          is_current: boolean
          storage_path: string
          variant: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          is_current?: boolean
          storage_path: string
          variant: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          is_current?: boolean
          storage_path?: string
          variant?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          name: string
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind: string
          name: string
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          version?: number
        }
        Relationships: []
      }
      failed_steps: {
        Row: {
          attempts: number
          error: string
          failed_at: string
          id: string
          message_id: number
          payload: Json
          queue: string
          step: string
        }
        Insert: {
          attempts: number
          error: string
          failed_at?: string
          id?: string
          message_id: number
          payload: Json
          queue: string
          step: string
        }
        Update: {
          attempts?: number
          error?: string
          failed_at?: string
          id?: string
          message_id?: number
          payload?: Json
          queue?: string
          step?: string
        }
        Relationships: []
      }
      form_answers: {
        Row: {
          answer: string | null
          application_id: string
          created_at: string
          id: string
          position: number
          question: string
          status: string
        }
        Insert: {
          answer?: string | null
          application_id: string
          created_at?: string
          id?: string
          position: number
          question: string
          status: string
        }
        Update: {
          answer?: string | null
          application_id?: string
          created_at?: string
          id?: string
          position?: number
          question?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          company: string
          countries: string[]
          created_at: string
          eligibility: string
          eligibility_reason: string | null
          fingerprint: string
          id: string
          label: string | null
          labelled_at: string | null
          location: string | null
          posted_at: string | null
          raw_path: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_period: string | null
          seniority: string | null
          source: string
          source_id: string
          tags: string[]
          title: string
          url: string
        }
        Insert: {
          company: string
          countries?: string[]
          created_at?: string
          eligibility: string
          eligibility_reason?: string | null
          fingerprint: string
          id?: string
          label?: string | null
          labelled_at?: string | null
          location?: string | null
          posted_at?: string | null
          raw_path?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          seniority?: string | null
          source: string
          source_id: string
          tags?: string[]
          title: string
          url: string
        }
        Update: {
          company?: string
          countries?: string[]
          created_at?: string
          eligibility?: string
          eligibility_reason?: string | null
          fingerprint?: string
          id?: string
          label?: string | null
          labelled_at?: string | null
          location?: string | null
          posted_at?: string | null
          raw_path?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          seniority?: string | null
          source?: string
          source_id?: string
          tags?: string[]
          title?: string
          url?: string
        }
        Relationships: []
      }
      model_calls: {
        Row: {
          application_id: string | null
          cached_input_tokens: number
          cost_usd: number
          created_at: string
          duration_ms: number | null
          effort: string | null
          error: string | null
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          provider: string
          run_id: string | null
          step: string
        }
        Insert: {
          application_id?: string | null
          cached_input_tokens?: number
          cost_usd?: number
          created_at?: string
          duration_ms?: number | null
          effort?: string | null
          error?: string | null
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          provider: string
          run_id?: string | null
          step: string
        }
        Update: {
          application_id?: string | null
          cached_input_tokens?: number
          cost_usd?: number
          created_at?: string
          duration_ms?: number | null
          effort?: string | null
          error?: string | null
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          provider?: string
          run_id?: string | null
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_calls_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_calls_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          applications_prepared: number
          finished_at: string | null
          id: string
          kind: string
          listings_fetched: number
          listings_kept: number
          listings_scored: number
          started_at: string
          status: string
        }
        Insert: {
          applications_prepared?: number
          finished_at?: string | null
          id?: string
          kind: string
          listings_fetched?: number
          listings_kept?: number
          listings_scored?: number
          started_at?: string
          status?: string
        }
        Update: {
          applications_prepared?: number
          finished_at?: string | null
          id?: string
          kind?: string
          listings_fetched?: number
          listings_kept?: number
          listings_scored?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          model_call_id: string | null
          reasons: string
          score: number
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          model_call_id?: string | null
          reasons: string
          score: number
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          model_call_id?: string | null
          reasons?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "scores_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_model_call_id_fkey"
            columns: ["model_call_id"]
            isOneToOne: false
            referencedRelation: "model_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          daily_target: number
          excluded_countries: string[]
          id: boolean
          monthly_cap_usd: number
          owner_user_id: string | null
          pay_floor_usd_month: number
        }
        Insert: {
          daily_target?: number
          excluded_countries?: string[]
          id?: boolean
          monthly_cap_usd?: number
          owner_user_id?: string | null
          pay_floor_usd_month?: number
        }
        Update: {
          daily_target?: number
          excluded_countries?: string[]
          id?: boolean
          monthly_cap_usd?: number
          owner_user_id?: string | null
          pay_floor_usd_month?: number
        }
        Relationships: []
      }
      step_models: {
        Row: {
          effort: string
          model: string
          provider: string
          step: string
        }
        Insert: {
          effort: string
          model: string
          provider: string
          step: string
        }
        Update: {
          effort?: string
          model?: string
          provider?: string
          step?: string
        }
        Relationships: []
      }
    }
    Views: {
      current_documents: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          kind: string | null
          name: string | null
          version: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      complete_step: {
        Args: { message_id: number; queue_name: string }
        Returns: undefined
      }
      enqueue_step: {
        Args: {
          payload: Json
          queue_name: string
          step: string
          wake?: boolean
        }
        Returns: number
      }
      fail_step: {
        Args: {
          attempts: number
          error: string
          message_id: number
          payload: Json
          queue_name: string
          step: string
        }
        Returns: undefined
      }
      queue_length: { Args: { queue_name: string }; Returns: number }
      read_next_step: {
        Args: { queue_name: string; visibility_seconds: number }
        Returns: {
          attempts: number
          message_id: number
          payload: Json
          step: string
        }[]
      }
      retry_step_later: {
        Args: { delay_seconds: number; message_id: number; queue_name: string }
        Returns: undefined
      }
      set_current_cv: {
        Args: {
          cv_file_name: string
          cv_storage_path: string
          cv_variant: string
        }
        Returns: string
      }
      wake_worker: { Args: never; Returns: undefined }
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
