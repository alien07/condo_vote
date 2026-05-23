export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          profile_id: string
          role: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          profile_id: string
          role: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          profile_id: string
          requested_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          room_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
          requested_status: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
          requested_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      ballot_answers: {
        Row: {
          ballot_id: string
          choice_id: string
          created_at: string
          id: string
          question_id: string
        }
        Insert: {
          ballot_id: string
          choice_id: string
          created_at?: string
          id?: string
          question_id: string
        }
        Update: {
          ballot_id?: string
          choice_id?: string
          created_at?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ballot_answers_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ballot_answers_choice_id_fkey"
            columns: ["choice_id"]
            isOneToOne: false
            referencedRelation: "meeting_choices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ballot_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "meeting_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      ballot_versions: {
        Row: {
          ballot_id: string
          created_at: string
          id: string
          payload_json: Json
          version_number: number
        }
        Insert: {
          ballot_id: string
          created_at?: string
          id?: string
          payload_json: Json
          version_number: number
        }
        Update: {
          ballot_id?: string
          created_at?: string
          id?: string
          payload_json?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ballot_versions_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballots"
            referencedColumns: ["id"]
          },
        ]
      }
      ballots: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          room_id: string
          status: string
          submitted_at: string | null
          updated_at: string
          version_number: number
          voter_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          room_id: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          version_number?: number
          voter_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          room_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          version_number?: number
          voter_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ballots_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ballots_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ballots_voter_profile_id_fkey"
            columns: ["voter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      committee_approvals: {
        Row: {
          approved_at: string
          approved_by: string
          id: string
          meeting_id: string
          notes: string | null
          result_snapshot_id: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          id?: string
          meeting_id: string
          notes?: string | null
          result_snapshot_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          id?: string
          meeting_id?: string
          notes?: string | null
          result_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "committee_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_approvals_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_approvals_result_snapshot_id_fkey"
            columns: ["result_snapshot_id"]
            isOneToOne: false
            referencedRelation: "result_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          document_type: string
          id: string
          owner_id: string
          owner_type: string
          storage_path: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          owner_id: string
          owner_type: string
          storage_path: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          owner_id?: string
          owner_type?: string
          storage_path?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      eligible_voters_snapshot: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          ownership_percent: number
          profile_id: string
          room_id: string
          source: string
          voter_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          ownership_percent: number
          profile_id: string
          room_id: string
          source: string
          voter_type: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          ownership_percent?: number
          profile_id?: string
          room_id?: string
          source?: string
          voter_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligible_voters_snapshot_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligible_voters_snapshot_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligible_voters_snapshot_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          provider_message_id: string | null
          recipient_email: string
          sent_at: string | null
          status: string
          template_key: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          provider_message_id?: string | null
          recipient_email: string
          sent_at?: string | null
          status: string
          template_key: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          provider_message_id?: string | null
          recipient_email?: string
          sent_at?: string | null
          status?: string
          template_key?: string
        }
        Relationships: []
      }
      meeting_choices: {
        Row: {
          choice_text: string
          created_at: string
          display_order: number
          id: string
          question_id: string
        }
        Insert: {
          choice_text: string
          created_at?: string
          display_order?: number
          id?: string
          question_id: string
        }
        Update: {
          choice_text?: string
          created_at?: string
          display_order?: number
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_choices_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "meeting_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_questions: {
        Row: {
          created_at: string
          display_order: number
          id: string
          meeting_id: string
          question_text: string
          question_type: string
          required: boolean
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          meeting_id: string
          question_text: string
          question_type?: string
          required?: boolean
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          meeting_id?: string
          question_text?: string
          question_type?: string
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meeting_questions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string
          id: string
          published_at: string | null
          starts_at: string
          status: string
          title: string
          transcript: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          published_at?: string | null
          starts_at: string
          status?: string
          title: string
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          published_at?: string | null
          starts_at?: string
          status?: string
          title?: string
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      owners: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          line_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          line_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          line_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: string
          auth_user_id: string | null
          created_at: string
          default_status: string
          email: string
          full_name: string
          id: string
          line_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string
          auth_user_id?: string | null
          created_at?: string
          default_status?: string
          email: string
          full_name: string
          id?: string
          line_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          auth_user_id?: string | null
          created_at?: string
          default_status?: string
          email?: string
          full_name?: string
          id?: string
          line_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proxy_authorizations: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          owner_id: string | null
          proxy_profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          room_id: string
          status: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          owner_id?: string | null
          proxy_profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_id: string
          status?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          owner_id?: string | null
          proxy_profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_id?: string
          status?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proxy_authorizations_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_authorizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_authorizations_proxy_profile_id_fkey"
            columns: ["proxy_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_authorizations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proxy_authorizations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      result_snapshots: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          meeting_id: string
          payload_json: Json
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          meeting_id: string
          payload_json: Json
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          meeting_id?: string
          payload_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "result_snapshots_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_snapshots_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      room_owners: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          owner_id: string
          ownership_role: string
          room_id: string
          starts_at: string | null
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          owner_id: string
          ownership_role?: string
          room_id: string
          starts_at?: string | null
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          owner_id?: string
          ownership_role?: string
          room_id?: string
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_owners_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          active: boolean
          area_size: number | null
          building: string | null
          created_at: string
          floor: string | null
          id: string
          ownership_percent: number
          room_number: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          area_size?: number | null
          building?: string | null
          created_at?: string
          floor?: string | null
          id?: string
          ownership_percent: number
          room_number: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          area_size?: number | null
          building?: string | null
          created_at?: string
          floor?: string | null
          id?: string
          ownership_percent?: number
          room_number?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_profile_id: { Args: never; Returns: string }
      has_app_role: { Args: { required_role: string }; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

