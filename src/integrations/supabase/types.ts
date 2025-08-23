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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          active: boolean
          condition: Database["public"]["Enums"]["alert_condition"]
          created_at: string
          id: string
          last_triggered_at: string | null
          org_id: string
          threshold_toman: number
          user_id: string
          variant_id: string
        }
        Insert: {
          active?: boolean
          condition: Database["public"]["Enums"]["alert_condition"]
          created_at?: string
          id?: string
          last_triggered_at?: string | null
          org_id: string
          threshold_toman: number
          user_id: string
          variant_id: string
        }
        Update: {
          active?: boolean
          condition?: Database["public"]["Enums"]["alert_condition"]
          created_at?: string
          id?: string
          last_triggered_at?: string | null
          org_id?: string
          threshold_toman?: number
          user_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          data: Json | null
          entity: string
          entity_id: string | null
          id: string
          org_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          brand: string
          created_at: string
          id: string
          model: string
          normalized_name: string
          org_id: string
        }
        Insert: {
          brand: string
          created_at?: string
          id?: string
          model: string
          normalized_name: string
          org_id: string
        }
        Update: {
          brand?: string
          created_at?: string
          id?: string
          model?: string
          normalized_name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          id: string
          org_id: string
          type: Database["public"]["Enums"]["integration_type"]
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          org_id: string
          type: Database["public"]["Enums"]["integration_type"]
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          org_id?: string
          type?: Database["public"]["Enums"]["integration_type"]
        }
        Relationships: [
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_files: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          mime_type: string
          ocr_status: Database["public"]["Enums"]["ocr_status"]
          org_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          mime_type: string
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
          org_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          mime_type?: string
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
          org_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          created_at: string
          has_media: boolean
          id: string
          org_id: string
          sender: string
          text: string | null
          timestamp: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          has_media?: boolean
          id?: string
          org_id: string
          sender: string
          text?: string | null
          timestamp: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          has_media?: boolean
          id?: string
          org_id?: string
          sender?: string
          text?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          alert_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          org_id: string
          payload: Json
          status: Database["public"]["Enums"]["notification_status"]
        }
        Insert: {
          alert_id: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          org_id: string
          payload: Json
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Update: {
          alert_id?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          org_id?: string
          payload?: Json
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_rows_staging: {
        Row: {
          created_at: string
          id: string
          mapped: boolean
          media_file_id: string | null
          normalized: Json | null
          raw_json: Json
          reviewer_id: string | null
          upload_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mapped?: boolean
          media_file_id?: string | null
          normalized?: Json | null
          raw_json: Json
          reviewer_id?: string | null
          upload_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mapped?: boolean
          media_file_id?: string | null
          normalized?: Json | null
          raw_json?: Json
          reviewer_id?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_rows_staging_media_file_id_fkey"
            columns: ["media_file_id"]
            isOneToOne: false
            referencedRelation: "media_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_rows_staging_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_rows_staging_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      price_history_daily: {
        Row: {
          avg_price: number
          created_at: string
          day: string
          id: string
          max_price: number
          min_price: number
          sample_count: number
          variant_id: string
        }
        Insert: {
          avg_price: number
          created_at?: string
          day: string
          id?: string
          max_price: number
          min_price: number
          sample_count: number
          variant_id: string
        }
        Update: {
          avg_price?: number
          created_at?: string
          day?: string
          id?: string
          max_price?: number
          min_price?: number
          sample_count?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_daily_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_outlier: boolean
          message_id: string | null
          observed_at: string
          org_id: string
          price_toman: number
          source: Database["public"]["Enums"]["source_type"]
          source_file_id: string | null
          variant_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_outlier?: boolean
          message_id?: string | null
          observed_at?: string
          org_id: string
          price_toman: number
          source: Database["public"]["Enums"]["source_type"]
          source_file_id?: string | null
          variant_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_outlier?: boolean
          message_id?: string | null
          observed_at?: string
          org_id?: string
          price_toman?: number
          source?: Database["public"]["Enums"]["source_type"]
          source_file_id?: string | null
          variant_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prices_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          org_id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string
          ocr_status: Database["public"]["Enums"]["ocr_status"]
          org_id: string
          row_count: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type: string
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
          org_id: string
          row_count?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string
          ocr_status?: Database["public"]["Enums"]["ocr_status"]
          org_id?: string
          row_count?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      variants: {
        Row: {
          active_state: Database["public"]["Enums"]["device_state"]
          color: string
          created_at: string
          device_id: string
          id: string
          ram_gb: number
          storage_gb: number
        }
        Insert: {
          active_state?: Database["public"]["Enums"]["device_state"]
          color: string
          created_at?: string
          device_id: string
          id?: string
          ram_gb: number
          storage_gb: number
        }
        Update: {
          active_state?: Database["public"]["Enums"]["device_state"]
          color?: string
          created_at?: string
          device_id?: string
          id?: string
          ram_gb?: number
          storage_gb?: number
        }
        Relationships: [
          {
            foreignKeyName: "variants_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          contact_info: Json | null
          created_at: string
          id: string
          is_official: boolean
          name: string
          org_id: string
          trust_score: number | null
        }
        Insert: {
          contact_info?: Json | null
          created_at?: string
          id?: string
          is_official?: boolean
          name: string
          org_id: string
          trust_score?: number | null
        }
        Update: {
          contact_info?: Json | null
          created_at?: string
          id?: string
          is_official?: boolean
          name?: string
          org_id?: string
          trust_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alert_condition: "lt" | "lte" | "eq"
      device_state: "active" | "not_active"
      integration_type: "openai" | "whatsapp" | "telegram" | "email"
      notification_channel: "email" | "whatsapp" | "telegram"
      notification_status: "pending" | "sent" | "failed"
      ocr_status: "queued" | "processing" | "done" | "failed"
      source_type: "upload" | "whatsapp"
      user_role: "owner" | "admin" | "analyst" | "viewer"
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
  public: {
    Enums: {
      alert_condition: ["lt", "lte", "eq"],
      device_state: ["active", "not_active"],
      integration_type: ["openai", "whatsapp", "telegram", "email"],
      notification_channel: ["email", "whatsapp", "telegram"],
      notification_status: ["pending", "sent", "failed"],
      ocr_status: ["queued", "processing", "done", "failed"],
      source_type: ["upload", "whatsapp"],
      user_role: ["owner", "admin", "analyst", "viewer"],
    },
  },
} as const
