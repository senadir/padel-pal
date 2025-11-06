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
    PostgrestVersion: '13.0.5'
  }
  public: {
    Tables: {
      games: {
        Row: {
          created_at: string
          id: number
          level: string | null
          players: Json[] | null
          playtomic_id: string | null
          session_id: number | null
          starting_time: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          level?: string | null
          players?: Json[] | null
          playtomic_id?: string | null
          session_id?: number | null
          starting_time?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          level?: string | null
          players?: Json[] | null
          playtomic_id?: string | null
          session_id?: number | null
          starting_time?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'games_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
        ]
      }
      match_participants: {
        Row: {
          created_at: string
          id: number
          joined_at: string
          match_id: number
          player_id: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: number
          joined_at?: string
          match_id: number
          player_id: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: number
          joined_at?: string
          match_id?: number
          player_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: 'match_participants_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_participants_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          end_time: string
          id: number
          level: string
          max_players: number
          public_id: string
          session_id: number
          start_time: string
          time_slot_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: number
          level: string
          max_players?: number
          public_id: string
          session_id: number
          start_time: string
          time_slot_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: number
          level?: string
          max_players?: number
          public_id?: string
          session_id?: number
          start_time?: string
          time_slot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'matches_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
        ]
      }
      players: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          level: number | null
          name: string | null
          phone: string | null
          playtomic_id: number | null
          status: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id: string
          level?: number | null
          name?: string | null
          phone?: string | null
          playtomic_id?: number | null
          status?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          level?: number | null
          name?: string | null
          phone?: string | null
          playtomic_id?: number | null
          status?: string | null
        }
        Relationships: []
      }
      session_templates: {
        Row: {
          created_at: string
          created_by: string
          id: number
          name: string
          template_data: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: number
          name: string
          template_data: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: number
          name?: string
          template_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      session_votes: {
        Row: {
          created_at: string
          id: number
          option_id: string
          player_id: string
          session_id: number
          voted_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          option_id: string
          player_id: string
          session_id: number
          voted_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          option_id?: string
          player_id?: string
          session_id?: number
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_votes_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_votes_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'sessions'
            referencedColumns: ['id']
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string | null
          date: string | null
          id: number
          levels: string[]
          limit_players: boolean | null
          players_per_slot: number | null
          public_id: string
          status: Database['public']['Enums']['session_status']
          time_blocks: number | null
          time_slots: Json | null
          venue_location: string | null
          venue_name: string | null
          voting_closes_at: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          id?: number
          levels: string[]
          limit_players?: boolean | null
          players_per_slot?: number | null
          public_id: string
          status?: Database['public']['Enums']['session_status']
          time_blocks?: number | null
          time_slots?: Json | null
          venue_location?: string | null
          venue_name?: string | null
          voting_closes_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          id?: number
          levels?: string[]
          limit_players?: boolean | null
          players_per_slot?: number | null
          public_id?: string
          status?: Database['public']['Enums']['session_status']
          time_blocks?: number | null
          time_slots?: Json | null
          venue_location?: string | null
          venue_name?: string | null
          voting_closes_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: number
          role: Database['public']['Enums']['app_role']
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          role: Database['public']['Enums']['app_role']
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          role?: Database['public']['Enums']['app_role']
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          created_at: string | null
          id: number
          label: string | null
          maps_url: string | null
          place_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          label?: string | null
          maps_url?: string | null
          place_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          label?: string | null
          maps_url?: string | null
          place_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      app_role: 'player' | 'organizer'
      Levels: 'beginner' | 'improver' | 'intermediate' | 'advanced'
      session_status: 'draft' | 'voting' | 'open' | 'cancelled' | 'closed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ['player', 'organizer'],
      Levels: ['beginner', 'improver', 'intermediate', 'advanced'],
      session_status: ['draft', 'voting', 'open', 'cancelled', 'closed'],
    },
  },
} as const
