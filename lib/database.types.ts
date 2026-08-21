export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Row<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      attendance_days: Row<{
        attendance_date: string;
        id: string;
        reserve_period_id: string;
        status: string;
        submitted_at: string | null;
        submitted_by: string | null;
        team_id: string;
      }>;
      attendance_entries: Row<{
        attendance_day_id: string;
        id: string;
        is_present: boolean;
        person_id: string;
        source: string;
        team_id: string;
      }>;
      leave_requests: Row<{
        approved_ends_on: string | null;
        approved_starts_on: string | null;
        ends_on: string;
        id: string;
        person_id: string;
        reason: string | null;
        reserve_period_id: string;
        starts_on: string;
        status: string;
        team_id: string;
      }>;
      pakal_types: Row<{
        created_at: string;
        code: string | null;
        description: string | null;
        id: string;
        is_active: boolean;
        name: string;
        team_id: string;
      }>;
      people: Row<{
        auth_user_id: string | null;
        created_at: string;
        date_of_birth: string | null;
        display_order: number;
        email: string | null;
        full_name: string;
        id: string;
        is_active: boolean;
        notes: string | null;
        phone: string | null;
        photo_url: string | null;
        team_id: string;
        updated_at: string;
      }>;
      person_private_details: Row<{
        created_at: string;
        national_id: string | null;
        person_id: string;
        personal_number: string | null;
        private_notes: string | null;
        team_id: string;
        updated_at: string;
      }>;
      reserve_periods: Row<{
        created_at: string;
        created_by: string | null;
        ends_on: string;
        id: string;
        location: string | null;
        name: string;
        starts_on: string;
        status: string;
        team_id: string;
        updated_at: string;
      }>;
      rotation_blocks: Row<{
        ends_on: string;
        id: string;
        reserve_period_id: string;
        rotation_group_id: string;
        starts_on: string;
        state: string;
        team_id: string;
      }>;
      rotation_groups: Row<{
        color_token: string | null;
        id: string;
        name: string;
        reserve_period_id: string;
        sort_order: number;
        team_id: string;
      }>;
      rotation_members: Row<{
        ends_on: string | null;
        id: string;
        person_id: string;
        rotation_group_id: string;
        starts_on: string | null;
        team_id: string;
      }>;
      schedule_events: Row<{
        ends_at: string | null;
        event_type: string;
        id: string;
        is_all_day: boolean;
        location: string | null;
        reserve_period_id: string;
        starts_at: string;
        team_id: string;
        title: string;
      }>;
      team_memberships: Row<{
        id: string;
        is_active: boolean;
        role: "admin" | "manager" | "viewer";
        team_id: string;
        user_id: string;
      }>;
      team_pakal_requirements: Row<{
        created_at: string;
        id: string;
        pakal_type_id: string;
        required_count: number;
        team_id: string;
      }>;
      teams: Row<{
        id: string;
        is_active: boolean;
        name: string;
        slug: string;
        timezone: string;
      }>;
      person_pakals: Row<{
        created_at: string;
        id: string;
        is_active: boolean;
        notes: string | null;
        pakal_type_id: string;
        person_id: string;
        team_id: string;
      }>;
      equipment_types: Row<{
        created_at: string;
        id: string;
        is_active: boolean;
        name: string;
        serial_required: boolean;
        team_id: string;
      }>;
      person_equipment: Row<{
        assigned_at: string | null;
        created_at: string;
        equipment_type_id: string;
        id: string;
        model: string | null;
        notes: string | null;
        person_id: string;
        returned_at: string | null;
        serial_number: string | null;
        status: "assigned" | "returned" | "lost" | "damaged";
        team_id: string;
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
