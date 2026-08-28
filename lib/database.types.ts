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
        created_at: string;
        id: string;
        reserve_period_id: string;
        status: string;
        submitted_at: string | null;
        submitted_by: string | null;
        team_id: string;
        updated_at: string;
      }>;
      attendance_entries: Row<{
        attendance_day_id: string;
        id: string;
        is_present: boolean;
        notes: string | null;
        person_id: string;
        source: string;
        team_id: string;
        updated_at: string;
        updated_by: string | null;
      }>;
      leave_requests: Row<{
        approved_ends_on: string | null;
        approved_starts_on: string | null;
        created_at: string;
        created_by: string | null;
        decided_at: string | null;
        decided_by: string | null;
        ends_on: string;
        id: string;
        manager_notes: string | null;
        person_id: string;
        reason: string | null;
        reserve_period_id: string;
        starts_on: string;
        status: string;
        team_id: string;
        updated_at: string;
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
      period_phases: Row<{
        created_at: string;
        ends_on: string;
        id: string;
        name: string;
        notes: string | null;
        phase_type: string;
        reserve_period_id: string;
        sort_order: number;
        starts_on: string;
        team_id: string;
      }>;
      rotation_blocks: Row<{
        created_at: string;
        ends_on: string;
        id: string;
        reserve_period_id: string;
        rotation_group_id: string;
        sequence_no: number | null;
        series_key: string | null;
        source: string;
        starts_on: string;
        state: string;
        team_id: string;
        updated_at: string;
      }>;
      rotation_generation_configs: Row<{
        anchor_date: string;
        base_days: number;
        created_at: string;
        home_days: number;
        reserve_period_id: string;
        team_id: string;
        updated_at: string;
      }>;
      rotation_groups: Row<{
        color_token: string | null;
        id: string;
        initial_state: "base" | "home";
        name: string;
        reserve_period_id: string;
        sort_order: number;
        team_id: string;
      }>;
      rotation_members: Row<{
        created_at: string;
        ends_on: string | null;
        id: string;
        person_id: string;
        rotation_group_id: string;
        starts_on: string | null;
        team_id: string;
      }>;
      rotation_overrides: Row<{
        created_at: string;
        created_by: string | null;
        ends_on: string;
        from_rotation_group_id: string | null;
        id: string;
        person_id: string;
        reason: string | null;
        reserve_period_id: string;
        starts_on: string;
        team_id: string;
        to_rotation_group_id: string | null;
      }>;
      schedule_events: Row<{
        created_at: string;
        created_by: string | null;
        ends_at: string | null;
        event_type: string;
        id: string;
        is_all_day: boolean;
        location: string | null;
        reserve_period_id: string;
        starts_at: string;
        team_id: string;
        title: string;
        notes: string | null;
        updated_at: string;
      }>;
      schedule_publications: Row<{
        created_at: string;
        id: string;
        published_at: string | null;
        published_by: string | null;
        reserve_period_id: string;
        status: "draft" | "published";
        team_id: string;
        updated_at: string;
        version: number;
        week_starts_on: string;
      }>;
      task_assignments: Row<{
        assigned_by: string | null;
        assignment_role: string;
        availability_override: boolean;
        created_at: string;
        id: string;
        person_id: string;
        status: "assigned" | "replaced" | "cancelled";
        task_instance_id: string;
        task_instance_requirement_id: string;
        team_id: string;
        updated_at: string;
      }>;
      task_instance_requirements: Row<{
        created_at: string;
        id: string;
        pakal_type_id: string | null;
        required_count: number;
        requirement_type: "any_person" | "pakal";
        role_label: string;
        sort_order: number;
        task_instance_id: string;
        team_id: string;
      }>;
      task_instances: Row<{
        created_at: string;
        created_by: string | null;
        ends_at: string;
        id: string;
        location: string | null;
        notes: string | null;
        reserve_period_id: string;
        schedule_publication_id: string;
        starts_at: string;
        task_template_id: string | null;
        team_id: string;
        title: string;
        updated_at: string;
      }>;
      task_template_requirements: Row<{
        created_at: string;
        id: string;
        pakal_type_id: string | null;
        required_count: number;
        requirement_type: "any_person" | "pakal";
        role_label: string;
        sort_order: number;
        task_template_id: string;
        team_id: string;
      }>;
      task_templates: Row<{
        created_at: string;
        default_duration_minutes: number | null;
        default_location: string | null;
        description: string | null;
        id: string;
        is_active: boolean;
        name: string;
        team_id: string;
        updated_at: string;
      }>;
      team_memberships: Row<{
        id: string;
        is_active: boolean;
        role: "admin" | "manager" | "viewer";
        team_id: string;
        user_id: string;
      }>;
      team_settings: Row<{
        attendance_whatsapp_template: string | null;
        created_at: string;
        show_leave_reasons_to_viewers: boolean;
        team_id: string;
        updated_at: string;
        week_start_day: number;
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
        category: "WEAPON" | "OPTIC" | "AMRAL" | "PAKAL" | "OTHER";
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
    Functions: {
      replace_generated_rotation_blocks: {
        Args: {
          generated_blocks: Json;
          generator_config: Json;
          target_reserve_period_id: string;
          target_team_id: string;
        };
        Returns: undefined;
      };
      replace_rotation_series_from: {
        Args: {
          replace_from: string;
          replacement_blocks: Json;
          target_reserve_period_id: string;
          target_rotation_group_id: string;
          target_team_id: string;
        };
        Returns: undefined;
      };
      get_team_approved_leave_windows: {
        Args: {
          target_reserve_period_id: string;
          target_team_id: string;
        };
        Returns: {
          approved_ends_on: string | null;
          approved_starts_on: string | null;
          ends_on: string;
          id: string;
          person_id: string;
          starts_on: string;
          status: string;
        }[];
      };
      get_team_attendance_entries: {
        Args: {
          range_ends_on: string;
          range_starts_on: string;
          target_reserve_period_id: string;
          target_team_id: string;
        };
        Returns: {
          attendance_date: string;
          is_present: boolean;
          person_id: string;
        }[];
      };
      get_team_attendance_day_status: {
        Args: {
          range_ends_on: string;
          range_starts_on: string;
          target_reserve_period_id: string;
          target_team_id: string;
        };
        Returns: {
          attendance_date: string;
          status: string;
        }[];
      };
      get_person_attendance_summary: {
        Args: {
          target_person_id: string;
          target_team_id: string;
        };
        Returns: {
          present_count: number;
          reserve_period_id: string;
          total_count: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
