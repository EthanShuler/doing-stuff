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
        Row: { id: string; space_id: string; category_id: string; name: string; emoji: string | null; created_at: string }
        Insert: { id?: string; space_id: string; category_id: string; name: string; emoji?: string | null; created_at?: string }
        Update: { id?: string; space_id?: string; category_id?: string; name?: string; emoji?: string | null; created_at?: string }
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
          address: string | null
          lat: number | null
          lng: number | null
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
          address?: string | null
          lat?: number | null
          lng?: number | null
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
          address?: string | null
          lat?: number | null
          lng?: number | null
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
        }
        Insert: {
          id?: string
          space_id: string
          text?: string
          entry_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          text?: string
          entry_id?: string | null
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
