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
      blood_test_results: {
        Row: {
          blood_test_id: number
          category: string | null
          id: number
          marker_name: string
          raw_text: string | null
          reference_range_high: number | null
          reference_range_low: number | null
          status: string | null
          unit: string | null
          value: number | null
        }
        Insert: {
          blood_test_id: number
          category?: string | null
          id?: number
          marker_name: string
          raw_text?: string | null
          reference_range_high?: number | null
          reference_range_low?: number | null
          status?: string | null
          unit?: string | null
          value?: number | null
        }
        Update: {
          blood_test_id?: number
          category?: string | null
          id?: number
          marker_name?: string
          raw_text?: string | null
          reference_range_high?: number | null
          reference_range_low?: number | null
          status?: string | null
          unit?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blood_test_results_blood_test_id_fkey"
            columns: ["blood_test_id"]
            isOneToOne: false
            referencedRelation: "blood_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_tests: {
        Row: {
          content_hash: string | null
          created_at: string
          file_name: string
          id: number
          lab_name: string | null
          notes: string | null
          patient_name: string | null
          test_date: string | null
          user_id: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          file_name: string
          id?: number
          lab_name?: string | null
          notes?: string | null
          patient_name?: string | null
          test_date?: string | null
          user_id?: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          file_name?: string
          id?: number
          lab_name?: string | null
          notes?: string | null
          patient_name?: string | null
          test_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          blood_test_id: number | null
          created_at: string
          id: number
          title: string
          user_id: string
        }
        Insert: {
          blood_test_id?: number | null
          created_at?: string
          id?: number
          title: string
          user_id?: string
        }
        Update: {
          blood_test_id?: number | null
          created_at?: string
          id?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_blood_test_id_fkey"
            columns: ["blood_test_id"]
            isOneToOne: false
            referencedRelation: "blood_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: number
          created_at: string
          id: number
          role: string
        }
        Insert: {
          content: string
          conversation_id: number
          created_at?: string
          id?: number
          role: string
        }
        Update: {
          content?: string
          conversation_id?: number
          created_at?: string
          id?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      markers: {
        Row: {
          aliases: string[]
          canonical_name: string
          category: string
          created_at: string
          id: number
          ref_high: number | null
          ref_low: number | null
          ref_note: string | null
          ref_unit: string | null
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          canonical_name: string
          category: string
          created_at?: string
          id?: number
          ref_high?: number | null
          ref_low?: number | null
          ref_note?: string | null
          ref_unit?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          canonical_name?: string
          category?: string
          created_at?: string
          id?: number
          ref_high?: number | null
          ref_low?: number | null
          ref_note?: string | null
          ref_unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarded: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          onboarded?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      blood_test_summary: {
        Args: never
        Returns: {
          abnormal_count: number
          latest_test_date: string
          total_markers: number
          total_tests: number
        }[]
      }
      categorize_markers: {
        Args: { names: string[] }
        Returns: {
          canonical_name: string
          category: string
          input_name: string
          ref_high: number
          ref_low: number
          ref_unit: string
        }[]
      }
      marker_list: {
        Args: never
        Returns: {
          marker_name: string
          usage_count: number
        }[]
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

