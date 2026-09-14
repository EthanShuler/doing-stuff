// Generated from the live database with the Supabase MCP server (2026-09-13).
// Do not hand-edit — regenerate after any schema change with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

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
      activities: {
        Row: {
          category_id: string
          created_at: string
          emoji: string
          id: string
          name: string
          space_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          emoji?: string
          id?: string
          name: string
          space_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color_index: number
          created_at: string
          id: string
          name: string
          space_id: string
        }
        Insert: {
          color_index?: number
          created_at?: string
          id?: string
          name: string
          space_id: string
        }
        Update: {
          color_index?: number
          created_at?: string
          id?: string
          name?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          activity_id: string
          address: string
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          hide_from_map: boolean
          id: string
          lat: number | null
          lng: number | null
          rating: number
          space_id: string
          title: string
        }
        Insert: {
          activity_id: string
          address?: string
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date: string
          hide_from_map?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          rating: number
          space_id: string
          title?: string
        }
        Update: {
          activity_id?: string
          address?: string
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          hide_from_map?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          rating?: number
          space_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_repeats: {
        Row: {
          created_at: string
          created_by: string | null
          entry_id: string
          id: string
          repeat_date: string
          space_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_id: string
          id?: string
          repeat_date: string
          space_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_id?: string
          id?: string
          repeat_date?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_repeats_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_repeats_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          created_at: string
          created_by: string | null
          creator: string
          done_on: string | null
          id: string
          image_url: string
          kind: string
          list_id: string | null
          position: number
          space_id: string
          tier_item_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          creator?: string
          done_on?: string | null
          id?: string
          image_url?: string
          kind: string
          list_id?: string | null
          position?: number
          space_id: string
          tier_item_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          creator?: string
          done_on?: string | null
          id?: string
          image_url?: string
          kind?: string
          list_id?: string | null
          position?: number
          space_id?: string
          tier_item_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_tier_item_id_fkey"
            columns: ["tier_item_id"]
            isOneToOne: false
            referencedRelation: "tier_items"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          created_by: string | null
          emoji: string
          id: string
          name: string
          space_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          emoji?: string
          id?: string
          name: string
          space_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          emoji?: string
          id?: string
          name?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      little_guys: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          image_url: string
          name: string
          owner_id: string | null
          personality: string
          source: string
          space_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_url?: string
          name: string
          owner_id?: string | null
          personality?: string
          source?: string
          space_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_url?: string
          name?: string
          owner_id?: string | null
          personality?: string
          source?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "little_guys_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      music_practice_days: {
        Row: {
          created_at: string
          id: string
          position: number
          practice_date: string
          space_id: string
          tempo: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          practice_date: string
          space_id: string
          tempo?: number | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          practice_date?: string
          space_id?: string
          tempo?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_practice_days_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      park_visits: {
        Row: {
          attendee_ids: string[]
          created_at: string
          created_by: string | null
          id: string
          notes: string
          park_code: string
          separate: boolean
          space_id: string
          visited_on: string | null
        }
        Insert: {
          attendee_ids?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          park_code: string
          separate?: boolean
          space_id: string
          visited_on?: string | null
        }
        Update: {
          attendee_ids?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          park_code?: string
          separate?: boolean
          space_id?: string
          visited_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "park_visits_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          ingredients: string
          notes: string
          servings: string
          source: string
          source_url: string
          space_id: string
          steps: string
          tags: string[]
          title: string
          total_time: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          ingredients?: string
          notes?: string
          servings?: string
          source?: string
          source_url?: string
          space_id: string
          steps?: string
          tags?: string[]
          title: string
          total_time?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          ingredients?: string
          notes?: string
          servings?: string
          source?: string
          source_url?: string
          space_id?: string
          steps?: string
          tags?: string[]
          title?: string
          total_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          created_at: string
          space_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          space_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string
          home_address: string | null
          home_lat: number | null
          home_lng: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      spoons: {
        Row: {
          acquired_on: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          lat: number | null
          lng: number | null
          name: string
          notes: string
          place: string
          space_id: string
        }
        Insert: {
          acquired_on?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string
          place?: string
          space_id: string
        }
        Update: {
          acquired_on?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string
          place?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spoons_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_item_completions: {
        Row: {
          created_at: string
          done_on: string
          id: string
          item_id: string
          space_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done_on: string
          id?: string
          item_id: string
          space_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          done_on?: string
          id?: string
          item_id?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_item_reads_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "tier_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier_item_reads_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_items: {
        Row: {
          created_at: string
          created_by: string | null
          creator: string
          done_on: string | null
          id: string
          image_url: string
          kind: string
          list_id: string | null
          space_id: string
          tags: string[]
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          creator?: string
          done_on?: string | null
          id?: string
          image_url?: string
          kind: string
          list_id?: string | null
          space_id: string
          tags?: string[]
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          creator?: string
          done_on?: string | null
          id?: string
          image_url?: string
          kind?: string
          list_id?: string | null
          space_id?: string
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "tier_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier_items_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_lists: {
        Row: {
          created_at: string
          created_by: string | null
          emoji: string
          id: string
          name: string
          noun: string
          shared: boolean
          space_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          emoji?: string
          id?: string
          name: string
          noun: string
          shared?: boolean
          space_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          emoji?: string
          id?: string
          name?: string
          noun?: string
          shared?: boolean
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_lists_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_placements: {
        Row: {
          created_at: string
          id: string
          item_id: string
          position: number
          space_id: string
          tier: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          position: number
          space_id: string
          tier: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          position?: number
          space_id?: string
          tier?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tier_placements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "tier_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tier_placements_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          entry_id: string | null
          id: string
          lat: number | null
          lng: number | null
          space_id: string
          text: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          entry_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          space_id: string
          text?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          entry_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          space_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_shared_board_item: { Args: { target_item: string }; Returns: boolean }
      is_space_member: { Args: { target_space: string }; Returns: boolean }
      keepalive: { Args: never; Returns: string }
      shares_space_with: { Args: { other: string }; Returns: boolean }
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
