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
    PostgrestVersion: "14.17"
  }
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
      access_commands: {
        Row: {
          attempts: number
          command: string
          created_at: string
          finished_at: string | null
          id: string
          last_error: string | null
          member_id: string
          payload: Json
          requested_by: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          command?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          member_id: string
          payload?: Json
          requested_by?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          command?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          member_id?: string
          payload?: Json
          requested_by?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_commands_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "debtor_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "access_commands_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_commands_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "membership_status"
            referencedColumns: ["member_id"]
          },
        ]
      }
      access_events: {
        Row: {
          door_name: string | null
          hik_event_id: string | null
          id: number
          member_id: string | null
          occurred_at: string
          result: string | null
          verify_mode: string | null
        }
        Insert: {
          door_name?: string | null
          hik_event_id?: string | null
          id?: never
          member_id?: string | null
          occurred_at: string
          result?: string | null
          verify_mode?: string | null
        }
        Update: {
          door_name?: string | null
          hik_event_id?: string | null
          id?: never
          member_id?: string | null
          occurred_at?: string
          result?: string | null
          verify_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "debtor_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "access_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "membership_status"
            referencedColumns: ["member_id"]
          },
        ]
      }
      achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          changed_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          changed_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          changed_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      benchmarks: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          performed_at: string
          result_unit: string
          result_value: number
          scaling: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          performed_at?: string
          result_unit: string
          result_value: number
          scaling?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          performed_at?: string
          result_unit?: string
          result_value?: number
          scaling?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      bridge_status: {
        Row: {
          agent_version: string | null
          hik_version: string | null
          id: string
          last_error: string | null
          last_pull_at: string | null
          last_seen_at: string | null
          persons_count: number | null
        }
        Insert: {
          agent_version?: string | null
          hik_version?: string | null
          id?: string
          last_error?: string | null
          last_pull_at?: string | null
          last_seen_at?: string | null
          persons_count?: number | null
        }
        Update: {
          agent_version?: string | null
          hik_version?: string | null
          id?: string
          last_error?: string | null
          last_pull_at?: string | null
          last_seen_at?: string | null
          persons_count?: number | null
        }
        Relationships: []
      }
      class_usages: {
        Row: {
          id: string
          member_id: string
          recorded_by: string | null
          undone_at: string | null
          undone_by: string | null
          used_at: string
        }
        Insert: {
          id?: string
          member_id: string
          recorded_by?: string | null
          undone_at?: string | null
          undone_by?: string | null
          used_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          recorded_by?: string | null
          undone_at?: string | null
          undone_by?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_usages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "debtor_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "class_usages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_usages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "membership_status"
            referencedColumns: ["member_id"]
          },
        ]
      }
      debt_items: {
        Row: {
          created_at: string
          debt_id: string
          deleted_at: string | null
          delivery_status: string
          id: string
          name: string
          note: string | null
          product_id: string | null
          quantity: number
          subtotal: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          debt_id: string
          deleted_at?: string | null
          delivery_status?: string
          id?: string
          name: string
          note?: string | null
          product_id?: string | null
          quantity?: number
          subtotal?: number | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          debt_id?: string
          deleted_at?: string | null
          delivery_status?: string
          id?: string
          name?: string
          note?: string | null
          product_id?: string | null
          quantity?: number
          subtotal?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_items_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debt_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_items_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          amount: number
          collected_by: string | null
          created_at: string
          debt_id: string
          deleted_at: string | null
          id: string
          note: string | null
          paid_at: string
          payment_method: string
          received_by_partner: string
          updated_at: string
        }
        Insert: {
          amount: number
          collected_by?: string | null
          created_at?: string
          debt_id: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          paid_at?: string
          payment_method: string
          received_by_partner: string
          updated_at?: string
        }
        Update: {
          amount?: number
          collected_by?: string | null
          created_at?: string
          debt_id?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          paid_at?: string
          payment_method?: string
          received_by_partner?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debt_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_received_by_partner_fkey"
            columns: ["received_by_partner"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_reminders: {
        Row: {
          balance: number
          channel: string
          id: string
          member_id: string
          sent_at: string
          sent_by: string | null
        }
        Insert: {
          balance: number
          channel?: string
          id?: string
          member_id: string
          sent_at?: string
          sent_by?: string | null
        }
        Update: {
          balance?: number
          channel?: string
          id?: string
          member_id?: string
          sent_at?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_reminders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "debtor_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "debt_reminders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_reminders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "membership_status"
            referencedColumns: ["member_id"]
          },
        ]
      }
      debts: {
        Row: {
          balance: number | null
          concept: string
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          paid_amount: number
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          balance?: number | null
          concept: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id: string
          paid_amount?: number
          total_amount?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          balance?: number | null
          concept?: string
          created_at?: string
          created_by?: string | null
          id?: string
          member_id?: string
          paid_amount?: number
          total_amount?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "debtor_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "debts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "membership_status"
            referencedColumns: ["member_id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          archived_at: string | null
          color_hex: string
          created_at: string
          icon_emoji: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color_hex?: string
          created_at?: string
          icon_emoji?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color_hex?: string
          created_at?: string
          icon_emoji?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          note: string | null
          partner_id: string
          payment_method: string
          scope: string
          spent_at: string
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          note?: string | null
          partner_id: string
          payment_method?: string
          scope: string
          spent_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          note?: string | null
          partner_id?: string
          payment_method?: string
          scope?: string
          spent_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "feed_events"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feed_likes: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "feed_events"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followed_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          amount: number
          concept: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          note: string | null
          partner_id: string
          payment_method: string
          product_id: string | null
          quantity: number | null
          received_at: string
          source: string
          source_ref: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          concept: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          note?: string | null
          partner_id: string
          payment_method?: string
          product_id?: string | null
          quantity?: number | null
          received_at?: string
          source?: string
          source_ref?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          concept?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          note?: string | null
          partner_id?: string
          payment_method?: string
          product_id?: string | null
          quantity?: number | null
          received_at?: string
          source?: string
          source_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      member_link_requests: {
        Row: {
          created_at: string
          document_id: string
          id: string
          member_id: string | null
          profile_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          member_id?: string | null
          profile_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          member_id?: string | null
          profile_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_link_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "debtor_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_link_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_link_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "membership_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_link_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "athlete_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_link_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string | null
          email: string | null
          full_name: string
          hik_person_id: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          profile_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          email?: string | null
          full_name: string
          hik_person_id?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          email?: string | null
          full_name?: string
          hik_person_id?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "athlete_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          class_count: number | null
          created_at: string
          duration_days: number
          duration_months: number
          id: string
          is_active: boolean
          kind: string
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          class_count?: number | null
          created_at?: string
          duration_days?: number
          duration_months?: number
          id?: string
          is_active?: boolean
          kind: string
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          class_count?: number | null
          created_at?: string
          duration_days?: number
          duration_months?: number
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      membership_renewals: {
        Row: {
          amount: number | null
          classes: number | null
          collected_by: string | null
          created_at: string
          created_by: string | null
          discount: number
          discount_reason: string | null
          id: string
          list_price: number | null
          member_id: string
          note: string | null
          origin: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          period_end: string
          period_start: string
          plan_id: string | null
          plan_name: string
          prev_membership: Json | null
          received_by_partner: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount?: number | null
          classes?: number | null
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          discount_reason?: string | null
          id?: string
          list_price?: number | null
          member_id: string
          note?: string | null
          origin?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          period_end: string
          period_start: string
          plan_id?: string | null
          plan_name: string
          prev_membership?: Json | null
          received_by_partner?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number | null
          classes?: number | null
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          discount_reason?: string | null
          id?: string
          list_price?: number | null
          member_id?: string
          note?: string | null
          origin?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          period_end?: string
          period_start?: string
          plan_id?: string | null
          plan_name?: string
          prev_membership?: Json | null
          received_by_partner?: string | null
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_renewals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "debtor_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "membership_renewals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_renewals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "membership_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "membership_renewals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_renewals_received_by_partner_fkey"
            columns: ["received_by_partner"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          access_enabled: boolean
          classes_total: number | null
          classes_used: number
          hik_synced_at: string | null
          hik_target_until: string | null
          hik_valid_from: string | null
          hik_valid_until: string | null
          last_change_origin: string
          member_id: string
          plan_id: string | null
          plan_kind: string | null
          plan_name: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          access_enabled?: boolean
          classes_total?: number | null
          classes_used?: number
          hik_synced_at?: string | null
          hik_target_until?: string | null
          hik_valid_from?: string | null
          hik_valid_until?: string | null
          last_change_origin?: string
          member_id: string
          plan_id?: string | null
          plan_kind?: string | null
          plan_name?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          access_enabled?: boolean
          classes_total?: number | null
          classes_used?: number
          hik_synced_at?: string | null
          hik_target_until?: string | null
          hik_valid_from?: string | null
          hik_valid_until?: string | null
          last_change_origin?: string
          member_id?: string
          plan_id?: string | null
          plan_kind?: string | null
          plan_name?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "debtor_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "membership_status"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          disabled_types: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          disabled_types?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          disabled_types?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          comment_body: string | null
          comment_id: string | null
          created_at: string
          data: Json | null
          event_id: string | null
          event_payload: Json | null
          event_type: string | null
          id: string
          link: string | null
          pushed_at: string | null
          read_at: string | null
          recipient_id: string
          title: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          comment_body?: string | null
          comment_id?: string | null
          created_at?: string
          data?: Json | null
          event_id?: string | null
          event_payload?: Json | null
          event_type?: string | null
          id?: string
          link?: string | null
          pushed_at?: string | null
          read_at?: string | null
          recipient_id: string
          title?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          comment_body?: string | null
          comment_id?: string | null
          created_at?: string
          data?: Json | null
          event_id?: string | null
          event_payload?: Json | null
          event_type?: string | null
          id?: string
          link?: string | null
          pushed_at?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "feed_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "feed_events"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          from_partner: string
          id: string
          note: string | null
          settlement_id: string | null
          settlement_index: number | null
          to_partner: string
          transferred_at: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_partner: string
          id?: string
          note?: string | null
          settlement_id?: string | null
          settlement_index?: number | null
          to_partner: string
          transferred_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_partner?: string
          id?: string
          note?: string | null
          settlement_id?: string | null
          settlement_index?: number | null
          to_partner?: string
          transferred_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_transfers_from_partner_fkey"
            columns: ["from_partner"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_transfers_settlement_fk"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlement_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_transfers_settlement_fk"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_transfers_to_partner_fkey"
            columns: ["to_partner"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          color_hex: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          share_percentage: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color_hex?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          share_percentage: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color_hex?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          share_percentage?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          box_name: string | null
          created_at: string
          discipline: string | null
          display_name: string
          experience_years: number | null
          first_name: string
          gender: string | null
          goal: string | null
          height_cm: number | null
          id: string
          last_name: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          box_name?: string | null
          created_at?: string
          discipline?: string | null
          display_name: string
          experience_years?: number | null
          first_name: string
          gender?: string | null
          goal?: string | null
          height_cm?: number | null
          id: string
          last_name: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          box_name?: string | null
          created_at?: string
          discipline?: string | null
          display_name?: string
          experience_years?: number | null
          first_name?: string
          gender?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          last_name?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      prs: {
        Row: {
          achieved_at: string
          created_at: string
          id: string
          movement: string
          notes: string | null
          type: string
          user_id: string
          value_numeric: number
        }
        Insert: {
          achieved_at?: string
          created_at?: string
          id?: string
          movement: string
          notes?: string | null
          type: string
          user_id: string
          value_numeric: number
        }
        Update: {
          achieved_at?: string
          created_at?: string
          id?: string
          movement?: string
          notes?: string | null
          type?: string
          user_id?: string
          value_numeric?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      role_invites: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          email: string
          invited_by: string | null
          partner_id: string | null
          roles: string[]
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          email: string
          invited_by?: string | null
          partner_id?: string | null
          roles: string[]
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          email?: string
          invited_by?: string | null
          partner_id?: string | null
          roles?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "role_invites_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          box_expenses: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_manual: boolean
          net_profit: number
          notes: string | null
          partners_snapshot: Json
          period_end: string
          period_start: string
          reserve_fund: number
          title: string
          total_income: number
          transfers: Json
          updated_at: string
        }
        Insert: {
          box_expenses: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_manual?: boolean
          net_profit: number
          notes?: string | null
          partners_snapshot: Json
          period_end: string
          period_start: string
          reserve_fund?: number
          title: string
          total_income: number
          transfers: Json
          updated_at?: string
        }
        Update: {
          box_expenses?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_manual?: boolean
          net_profit?: number
          notes?: string | null
          partners_snapshot?: Json
          period_end?: string
          period_start?: string
          reserve_fund?: number
          title?: string
          total_income?: number
          transfers?: Json
          updated_at?: string
        }
        Relationships: []
      }
      unlocked_movements: {
        Row: {
          category: string
          id: string
          movement: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          category: string
          id?: string
          movement: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          category?: string
          id?: string
          movement?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      athlete_directory: {
        Row: {
          avatar_url: string | null
          box_name: string | null
          created_at: string | null
          discipline: string | null
          display_name: string | null
          first_name: string | null
          full_name: string | null
          id: string | null
          last_name: string | null
        }
        Insert: {
          avatar_url?: string | null
          box_name?: string | null
          created_at?: string | null
          discipline?: string | null
          display_name?: string | null
          first_name?: string | null
          full_name?: never
          id?: string | null
          last_name?: string | null
        }
        Update: {
          avatar_url?: string | null
          box_name?: string | null
          created_at?: string | null
          discipline?: string | null
          display_name?: string | null
          first_name?: string | null
          full_name?: never
          id?: string | null
          last_name?: string | null
        }
        Relationships: []
      }
      debt_summary: {
        Row: {
          balance: number | null
          concept: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          member_id: string | null
          member_name: string | null
          paid_amount: number | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "debtor_summary"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "debts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "membership_status"
            referencedColumns: ["member_id"]
          },
        ]
      }
      debtor_summary: {
        Row: {
          balance: number | null
          full_name: string | null
          is_active: boolean | null
          last_reminder_at: string | null
          last_reminder_by: string | null
          member_id: string | null
          oldest_debt_at: string | null
          open_debts: number | null
          phone: string | null
          profile_id: string | null
          reminders_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "athlete_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_status: {
        Row: {
          access_enabled: boolean | null
          classes_left: number | null
          classes_total: number | null
          classes_used: number | null
          days_left: number | null
          debt_balance: number | null
          document_id: string | null
          email: string | null
          full_name: string | null
          has_pending_payment: boolean | null
          hik_person_id: string | null
          hik_sync_pending: boolean | null
          hik_synced_at: string | null
          is_active: boolean | null
          last_change_origin: string | null
          member_id: string | null
          phone: string | null
          plan_id: string | null
          plan_kind: string | null
          plan_name: string | null
          profile_id: string | null
          source: string | null
          status: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "athlete_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_list: {
        Row: {
          box_expenses: number | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          id: string | null
          is_manual: boolean | null
          modified_after: boolean | null
          net_profit: number | null
          notes: string | null
          partners_snapshot: Json | null
          period_end: string | null
          period_start: string | null
          reserve_fund: number | null
          title: string | null
          total_income: number | null
          transfers: Json | null
          updated_at: string | null
        }
        Insert: {
          box_expenses?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string | null
          is_manual?: boolean | null
          modified_after?: never
          net_profit?: number | null
          notes?: string | null
          partners_snapshot?: Json | null
          period_end?: string | null
          period_start?: string | null
          reserve_fund?: number | null
          title?: string | null
          total_income?: number | null
          transfers?: Json | null
          updated_at?: string | null
        }
        Update: {
          box_expenses?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string | null
          is_manual?: boolean | null
          modified_after?: never
          net_profit?: number | null
          notes?: string | null
          partners_snapshot?: Json | null
          period_end?: string | null
          period_start?: string | null
          reserve_fund?: number | null
          title?: string | null
          total_income?: number | null
          transfers?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_partner_account: {
        Args: { p_partner_id: string; p_user_id: string }
        Returns: undefined
      }
      bridge_heartbeat: {
        Args: {
          p_agent_version?: string
          p_error?: string
          p_hik_version?: string
          p_persons_count?: number
        }
        Returns: undefined
      }
      bridge_sync_persons: {
        Args: { p_full_snapshot?: boolean; p_persons: Json }
        Returns: Json
      }
      calculate_manual_settlement: {
        Args: {
          p_end: string
          p_partners?: Json
          p_reserve_fund?: number
          p_start: string
        }
        Returns: Json
      }
      calculate_settlement: {
        Args: {
          p_declared_cash?: Json
          p_end: string
          p_reserve_fund?: number
          p_start: string
        }
        Returns: Json
      }
      claim_next_access_command: {
        Args: never
        Returns: {
          attempts: number
          command: string
          created_at: string
          finished_at: string | null
          id: string
          last_error: string | null
          member_id: string
          payload: Json
          requested_by: string | null
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "access_commands"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_push_batch: {
        Args: { p_limit?: number }
        Returns: {
          actor_handle: string
          actor_id: string
          body: string
          comment_body: string
          event_payload: Json
          event_type: string
          id: string
          link: string
          recipient_id: string
          title: string
          type: string
        }[]
      }
      claim_role_invites: { Args: never; Returns: number }
      complete_access_command: {
        Args: { p_command_id: string; p_error?: string; p_ok: boolean }
        Returns: {
          attempts: number
          command: string
          created_at: string
          finished_at: string | null
          id: string
          last_error: string | null
          member_id: string
          payload: Json
          requested_by: string | null
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "access_commands"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_pending_renewal: {
        Args: {
          p_amount: number
          p_note?: string
          p_payment_method: unknown
          p_plan_id?: string
          p_received_by_partner: string
          p_renewal_id: string
        }
        Returns: {
          amount: number | null
          classes: number | null
          collected_by: string | null
          created_at: string
          created_by: string | null
          discount: number
          discount_reason: string | null
          id: string
          list_price: number | null
          member_id: string
          note: string | null
          origin: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          period_end: string
          period_start: string
          plan_id: string | null
          plan_name: string
          prev_membership: Json | null
          received_by_partner: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "membership_renewals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_debt: {
        Args: { p_concept: string; p_items: Json; p_member_id: string }
        Returns: {
          balance: number | null
          concept: string
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          paid_amount: number
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "debts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_settlement: {
        Args: { p_settlement_id: string }
        Returns: undefined
      }
      get_benchmark_leaderboard: {
        Args: {
          p_limit?: number
          p_name?: string
          p_result_unit?: string
          p_scaling?: string
          p_scope?: string
          p_type?: string
        }
        Returns: {
          athlete_id: string
          avatar_url: string
          display_name: string
          full_name: string
          name: string
          rank: number
          result_unit: string
          result_value: number
          scaling: string
          total_count: number
          type: string
        }[]
      }
      get_pr_leaderboard: {
        Args: {
          p_limit?: number
          p_movement?: string
          p_scope?: string
          p_type?: string
        }
        Returns: {
          athlete_id: string
          avatar_url: string
          display_name: string
          full_name: string
          movement: string
          rank: number
          total_count: number
          type: string
          value_numeric: number
        }[]
      }
      log_debt_reminder: {
        Args: { p_member_id: string }
        Returns: {
          balance: number
          channel: string
          id: string
          member_id: string
          sent_at: string
          sent_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "debt_reminders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_user_agent?: string
        }
        Returns: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "push_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_sale: {
        Args: {
          p_note?: string
          p_payment_method: unknown
          p_product_id: string
          p_quantity: number
          p_received_by_partner: string
          p_unit_price?: number
        }
        Returns: {
          amount: number
          concept: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          note: string | null
          partner_id: string
          payment_method: string
          product_id: string | null
          quantity: number | null
          received_at: string
          source: string
          source_ref: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "incomes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      renew_membership: {
        Args: {
          p_discount?: number
          p_discount_reason?: string
          p_member_id: string
          p_note?: string
          p_payment_method: unknown
          p_plan_id: string
          p_received_by_partner: string
        }
        Returns: {
          amount: number | null
          classes: number | null
          collected_by: string | null
          created_at: string
          created_by: string | null
          discount: number
          discount_reason: string | null
          id: string
          list_price: number | null
          member_id: string
          note: string | null
          origin: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          period_end: string
          period_start: string
          plan_id: string | null
          plan_name: string
          prev_membership: Json | null
          received_by_partner: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "membership_renewals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_member_link: {
        Args: { p_document: string }
        Returns: {
          created_at: string
          document_id: string
          id: string
          member_id: string | null
          profile_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "member_link_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_member_link: {
        Args: { p_approve: boolean; p_note?: string; p_request_id: string }
        Returns: {
          created_at: string
          document_id: string
          id: string
          member_id: string | null
          profile_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "member_link_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_manual_settlement: {
        Args: {
          p_end: string
          p_notes?: string
          p_partners?: Json
          p_reserve_fund?: number
          p_start: string
          p_title: string
        }
        Returns: {
          box_expenses: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_manual: boolean
          net_profit: number
          notes: string | null
          partners_snapshot: Json
          period_end: string
          period_start: string
          reserve_fund: number
          title: string
          total_income: number
          transfers: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "settlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_settlement: {
        Args: {
          p_declared_cash?: Json
          p_end: string
          p_notes?: string
          p_reserve_fund?: number
          p_start: string
          p_title: string
        }
        Returns: {
          box_expenses: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_manual: boolean
          net_profit: number
          notes: string | null
          partners_snapshot: Json
          period_end: string
          period_start: string
          reserve_fund: number
          title: string
          total_income: number
          transfers: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "settlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_member_access: {
        Args: { p_enabled: boolean; p_member_id: string }
        Returns: {
          access_enabled: boolean
          classes_total: number | null
          classes_used: number
          hik_synced_at: string | null
          hik_target_until: string | null
          hik_valid_from: string | null
          hik_valid_until: string | null
          last_change_origin: string
          member_id: string
          plan_id: string | null
          plan_kind: string | null
          plan_name: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_membership_validity: {
        Args: {
          p_member_id: string
          p_valid_from: string
          p_valid_until: string
        }
        Returns: {
          access_enabled: boolean
          classes_total: number | null
          classes_used: number
          hik_synced_at: string | null
          hik_target_until: string | null
          hik_valid_from: string | null
          hik_valid_until: string | null
          last_change_origin: string
          member_id: string
          plan_id: string | null
          plan_kind: string | null
          plan_name: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_settlement_transfer_paid: {
        Args: { p_index: number; p_paid: boolean; p_settlement_id: string }
        Returns: {
          box_expenses: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_manual: boolean
          net_profit: number
          notes: string | null
          partners_snapshot: Json
          period_end: string
          period_start: string
          reserve_fund: number
          title: string
          total_income: number
          transfers: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "settlements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_user_role: {
        Args: { p_grant: boolean; p_role: string; p_user_id: string }
        Returns: undefined
      }
      undo_class_usage: {
        Args: { p_usage_id: string }
        Returns: {
          id: string
          member_id: string
          recorded_by: string | null
          undone_at: string | null
          undone_by: string | null
          used_at: string
        }
        SetofOptions: {
          from: "*"
          to: "class_usages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_member: {
        Args: {
          p_document_id?: string
          p_email?: string
          p_full_name?: string
          p_id?: string
          p_notes?: string
          p_phone?: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          document_id: string | null
          email: string | null
          full_name: string
          hik_person_id: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          profile_id: string | null
          source: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      use_class: {
        Args: { p_member_id: string }
        Returns: {
          id: string
          member_id: string
          recorded_by: string | null
          undone_at: string | null
          undone_by: string | null
          used_at: string
        }
        SetofOptions: {
          from: "*"
          to: "class_usages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_debt: {
        Args: { p_debt_id: string; p_reason: string }
        Returns: {
          balance: number | null
          concept: string
          created_at: string
          created_by: string | null
          id: string
          member_id: string
          paid_amount: number
          total_amount: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "debts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_renewal: {
        Args: { p_reason: string; p_renewal_id: string }
        Returns: {
          amount: number | null
          classes: number | null
          collected_by: string | null
          created_at: string
          created_by: string | null
          discount: number
          discount_reason: string | null
          id: string
          list_price: number | null
          member_id: string
          note: string | null
          origin: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          period_end: string
          period_start: string
          plan_id: string | null
          plan_name: string
          prev_membership: Json | null
          received_by_partner: string | null
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "membership_renewals"
          isOneToOne: true
          isSetofReturn: false
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
