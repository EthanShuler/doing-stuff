// Hand-authored to match supabase/schema.sql. Once the Supabase CLI is set up
// you can regenerate this with:
//   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts

export interface Database {
  public: {
    Tables: {
      spaces: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
      }
      space_members: {
        Row: { space_id: string; user_id: string; created_at: string }
        Insert: { space_id: string; user_id: string; created_at?: string }
        Update: { space_id?: string; user_id?: string; created_at?: string }
      }
      categories: {
        Row: { id: string; space_id: string; name: string; color_index: number; created_at: string }
        Insert: { id?: string; space_id: string; name: string; color_index?: number; created_at?: string }
        Update: { id?: string; space_id?: string; name?: string; color_index?: number; created_at?: string }
      }
      activities: {
        Row: { id: string; space_id: string; category_id: string; name: string; created_at: string }
        Insert: { id?: string; space_id: string; category_id: string; name: string; created_at?: string }
        Update: { id?: string; space_id?: string; category_id?: string; name?: string; created_at?: string }
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
          created_at: string
        }
        Insert: {
          id?: string
          space_id: string
          activity_id: string
          title?: string
          entry_date: string
          description?: string
          rating: number
          created_at?: string
        }
        Update: {
          id?: string
          space_id?: string
          activity_id?: string
          title?: string
          entry_date?: string
          description?: string
          rating?: number
          created_at?: string
        }
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
