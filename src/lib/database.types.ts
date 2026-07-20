// Hand-authored to match supabase/schema.sql. Once the Supabase CLI is set up
// you can regenerate this with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export interface Database {
  public: {
    Tables: {
      spaces: {
        Row: {
          id: string
          name: string
          created_at: string
          home_address: string | null
          home_lat: number | null
          home_lng: number | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          home_address?: string | null
          home_lat?: number | null
          home_lng?: number | null
        }
        Relationships: []
      }
      space_members: {
        Row: { space_id: string; user_id: string; created_at: string }
        Insert: { space_id: string; user_id: string; created_at?: string }
        Update: { space_id?: string; user_id?: string; created_at?: string }
        Relationships: []
      }
      categories: {
        Row: { id: string; space_id: string; name: string; color_index: number; created_at: string }
        Insert: { id?: string; space_id: string; name: string; color_index?: number; created_at?: string }
        Update: { id?: string; space_id?: string; name?: string; color_index?: number; created_at?: string }
        Relationships: []
      }
      activities: {
        Row: { id: string; space_id: string; category_id: string; name: string; emoji: string; created_at: string }
        Insert: { id?: string; space_id: string; category_id: string; name: string; emoji?: string; created_at?: string }
        Update: { id?: string; space_id?: string; category_id?: string; name?: string; emoji?: string; created_at?: string }
        Relationships: []
      }
      entries: {
        Row: {
          id: string
          space_id: string
          activity_id: string
          title: string
          entry_date: string
          description: string
          rating: number
          created_by: string | null
          created_at: string
          address: string
          lat: number | null
          lng: number | null
          hide_from_map: boolean
        }
        Insert: {
          id?: string
          space_id: string
          activity_id: string
          title?: string
          entry_date: string
          description?: string
          rating: number
          created_by?: string | null
          created_at?: string
          address?: string
          lat?: number | null
          lng?: number | null
          hide_from_map?: boolean
        }
        Update: {
          id?: string
          space_id?: string
          activity_id?: string
          title?: string
          entry_date?: string
          description?: string
          rating?: number
          created_by?: string | null
          created_at?: string
          address?: string
          lat?: number | null
          lng?: number | null
          hide_from_map?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: { id: string; email: string | null; display_name: string | null; created_at: string }
        Insert: { id: string; email?: string | null; display_name?: string | null; created_at?: string }
        Update: { id?: string; email?: string | null; display_name?: string | null; created_at?: string }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          id: string
          space_id: string
          text: string
          entry_id: string | null
          created_by: string | null
          created_at: string
          address: string | null
          lat: number | null
          lng: number | null
        }
        Insert: {
          id?: string
          space_id: string
          text?: string
          entry_id?: string | null
          created_by?: string | null
          created_at?: string
          address?: string | null
          lat?: number | null
          lng?: number | null
        }
        Update: {
          id?: string
          space_id?: string
          text?: string
          entry_id?: string | null
          created_by?: string | null
          created_at?: string
          address?: string | null
          lat?: number | null
          lng?: number | null
        }
        Relationships: []
      }
      tier_items: {
        Row: {
          id: string
          space_id: string
          kind: string
          title: string
          image_url: string
          watched_on: string | null
          tags: string[]
          creator: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          kind: string
          title: string
          image_url?: string
          watched_on?: string | null
          tags?: string[]
          creator?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          kind?: string
          title?: string
          image_url?: string
          watched_on?: string | null
          tags?: string[]
          creator?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      tier_placements: {
        Row: {
          id: string
          space_id: string
          item_id: string
          user_id: string
          tier: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          item_id: string
          user_id?: string
          tier: string
          position: number
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          item_id?: string
          user_id?: string
          tier?: string
          position?: number
          created_at?: string
        }
        Relationships: []
      }
      tier_item_reads: {
        Row: {
          id: string
          space_id: string
          item_id: string
          user_id: string
          read_on: string
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          item_id: string
          user_id?: string
          read_on: string
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          item_id?: string
          user_id?: string
          read_on?: string
          created_at?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          id: string
          space_id: string
          kind: string
          title: string
          image_url: string
          creator: string
          position: number
          tier_item_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          kind: string
          title: string
          image_url?: string
          creator?: string
          position?: number
          tier_item_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          kind?: string
          title?: string
          image_url?: string
          creator?: string
          position?: number
          tier_item_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      spoons: {
        Row: {
          id: string
          space_id: string
          name: string
          image_url: string
          place: string
          lat: number | null
          lng: number | null
          acquired_on: string | null
          notes: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          name: string
          image_url?: string
          place?: string
          lat?: number | null
          lng?: number | null
          acquired_on?: string | null
          notes?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          name?: string
          image_url?: string
          place?: string
          lat?: number | null
          lng?: number | null
          acquired_on?: string | null
          notes?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      park_visits: {
        Row: {
          id: string
          space_id: string
          park_code: string
          visited_on: string | null
          notes: string
          attendee_ids: string[]
          separate: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          park_code: string
          visited_on?: string | null
          notes?: string
          attendee_ids?: string[]
          separate?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          park_code?: string
          visited_on?: string | null
          notes?: string
          attendee_ids?: string[]
          separate?: boolean
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          id: string
          space_id: string
          title: string
          image_url: string
          ingredients: string
          steps: string
          source: string
          source_url: string
          tags: string[]
          servings: string
          total_time: string
          notes: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          title: string
          image_url?: string
          ingredients?: string
          steps?: string
          source?: string
          source_url?: string
          tags?: string[]
          servings?: string
          total_time?: string
          notes?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          title?: string
          image_url?: string
          ingredients?: string
          steps?: string
          source?: string
          source_url?: string
          tags?: string[]
          servings?: string
          total_time?: string
          notes?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      music_practice_days: {
        Row: {
          id: string
          space_id: string
          user_id: string
          practice_date: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          user_id?: string
          practice_date: string
          position: number
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          user_id?: string
          practice_date?: string
          position?: number
          created_at?: string
        }
        Relationships: []
      }
      entry_repeats: {
        Row: {
          id: string
          space_id: string
          entry_id: string
          repeat_date: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          entry_id: string
          repeat_date: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          entry_id?: string
          repeat_date?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_space_member: {
        Args: { target_space: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
  }
}
