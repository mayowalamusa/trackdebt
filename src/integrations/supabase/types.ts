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
      announcements: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          link: string | null
          message: string
          priority: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link?: string | null
          message: string
          priority?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link?: string | null
          message?: string
          priority?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          app_name: string
          created_at: string
          description: string | null
          developer: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          support_email: string | null
          theme_color: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          app_name?: string
          created_at?: string
          description?: string | null
          developer?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          support_email?: string | null
          theme_color?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          app_name?: string
          created_at?: string
          description?: string | null
          developer?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          support_email?: string | null
          theme_color?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          id: string
          legacy_id: string | null
          name: string
          notes: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          legacy_id?: string | null
          name: string
          notes?: string
          phone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          legacy_id?: string | null
          name?: string
          notes?: string
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          imported_customers: number
          imported_reminders: number
          imported_transactions: number
          source: string
          source_version: number
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          imported_customers?: number
          imported_reminders?: number
          imported_transactions?: number
          source?: string
          source_version?: number
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          imported_customers?: number
          imported_reminders?: number
          imported_transactions?: number
          source?: string
          source_version?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          daily_reminder_enabled: boolean
          daily_reminder_time: string
          enabled: boolean
          overdue_interval_days: number
          remind_1_day_before: boolean
          remind_3_days_before: boolean
          remind_7_days_before: boolean
          remind_on_due_date: boolean
          remind_overdue: boolean
          reminder_time: string
          updated_at: string
          user_id: string
          weekly_summary_enabled: boolean
        }
        Insert: {
          daily_reminder_enabled?: boolean
          daily_reminder_time?: string
          enabled?: boolean
          overdue_interval_days?: number
          remind_1_day_before?: boolean
          remind_3_days_before?: boolean
          remind_7_days_before?: boolean
          remind_on_due_date?: boolean
          remind_overdue?: boolean
          reminder_time?: string
          updated_at?: string
          user_id: string
          weekly_summary_enabled?: boolean
        }
        Update: {
          daily_reminder_enabled?: boolean
          daily_reminder_time?: string
          enabled?: boolean
          overdue_interval_days?: number
          remind_1_day_before?: boolean
          remind_3_days_before?: boolean
          remind_7_days_before?: boolean
          remind_on_due_date?: boolean
          remind_overdue?: boolean
          reminder_time?: string
          updated_at?: string
          user_id?: string
          weekly_summary_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          customer_id: string | null
          id: string
          legacy_id: string | null
          read: boolean
          scheduled_for: string
          status: string
          title: string
          transaction_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          legacy_id?: string | null
          read?: boolean
          scheduled_for?: string
          status?: string
          title?: string
          transaction_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          legacy_id?: string | null
          read?: boolean
          scheduled_for?: string
          status?: string
          title?: string
          transaction_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_name: string
          account_number: string
          account_status: string
          bank_name: string
          business_address: string
          business_category: string
          business_email: string
          business_logo_path: string | null
          business_name: string
          business_phone: string
          created_at: string
          deletion_requested_at: string | null
          display_name: string | null
          id: string
          onboarding_completed: boolean
          onboarding_tips: Json
          restorable_until: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string
          account_number?: string
          account_status?: string
          bank_name?: string
          business_address?: string
          business_category?: string
          business_email?: string
          business_logo_path?: string | null
          business_name?: string
          business_phone?: string
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string | null
          id: string
          onboarding_completed?: boolean
          onboarding_tips?: Json
          restorable_until?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          account_status?: string
          bank_name?: string
          business_address?: string
          business_category?: string
          business_email?: string
          business_logo_path?: string | null
          business_name?: string
          business_phone?: string
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string | null
          id?: string
          onboarding_completed?: boolean
          onboarding_tips?: Json
          restorable_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          days: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          plan: string
          updated_at: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          days: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          plan: string
          updated_at?: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          days?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          plan?: string
          updated_at?: string
          uses_count?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          expires_at: string | null
          id: string
          metadata: Json | null
          promo_code_id: string | null
          redeemed_at: string
          token_ref: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          promo_code_id?: string | null
          redeemed_at?: string
          token_ref: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          promo_code_id?: string | null
          redeemed_at?: string
          token_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_sequences: {
        Row: {
          next_number: number
          user_id: string
          year: number
        }
        Insert: {
          next_number?: number
          user_id: string
          year: number
        }
        Update: {
          next_number?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_sequences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          legacy_id: string | null
          message: string
          sent_at: string | null
          status: string
          template_id: string
          tone: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          legacy_id?: string | null
          message?: string
          sent_at?: string | null
          status?: string
          template_id?: string
          tone?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          legacy_id?: string | null
          message?: string
          sent_at?: string | null
          status?: string
          template_id?: string
          tone?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          created_at: string
          event_id: string
          event_name: string
          reference: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_name: string
          reference?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_name?: string
          reference?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          cancellation_at: string | null
          created_at: string
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          last_successful_payment_at: string | null
          last_transaction_reference: string | null
          next_expected_payment_at: string | null
          paystack_authorization: Json | null
          paystack_customer_code: string | null
          paystack_email_token: string | null
          paystack_subscription_code: string | null
          plan: string
          status: string
          subscription_start_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          cancellation_at?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          last_successful_payment_at?: string | null
          last_transaction_reference?: string | null
          next_expected_payment_at?: string | null
          paystack_authorization?: Json | null
          paystack_customer_code?: string | null
          paystack_email_token?: string | null
          paystack_subscription_code?: string | null
          plan?: string
          status?: string
          subscription_start_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          cancellation_at?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          last_successful_payment_at?: string | null
          last_transaction_reference?: string | null
          next_expected_payment_at?: string | null
          paystack_authorization?: Json | null
          paystack_customer_code?: string | null
          paystack_email_token?: string | null
          paystack_subscription_code?: string | null
          plan?: string
          status?: string
          subscription_start_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          due_date: string | null
          id: string
          kind: string | null
          legacy_id: string | null
          note: string
          reference: string | null
          term_key: string | null
          term_set_at: string | null
          transaction_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          due_date?: string | null
          id?: string
          kind?: string | null
          legacy_id?: string | null
          note?: string
          reference?: string | null
          term_key?: string | null
          term_set_at?: string | null
          transaction_date: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          kind?: string | null
          legacy_id?: string | null
          note?: string
          reference?: string | null
          term_key?: string | null
          term_set_at?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin"
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
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
