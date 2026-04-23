


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE OR REPLACE FUNCTION "public"."get_pending_intake_count"() RETURNS integer
    LANGUAGE "sql"
    AS $$
  select count(*) 
  from public.intake_requests 
  where status = 'new';
$$;


ALTER FUNCTION "public"."get_pending_intake_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'user',
    false -- DEIXA AS CONTAS CONGELADAS POR PADRÃO
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.active = true
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_post_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  stayed integer := 0;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.workflow_status is distinct from new.workflow_status then
    stayed := greatest(
      0,
      floor(extract(epoch from (now() - coalesce(old.last_transition_at, old.updated_at, now()))))::integer
    );

    insert into public.post_logs (
      post_id,
      changed_by,
      from_status,
      to_status,
      owner_role,
      stayed_seconds,
      metadata
    ) values (
      new.id,
      auth.uid(),
      old.workflow_status,
      new.workflow_status,
      new.owner_role,
      stayed,
      jsonb_strip_nulls(
        jsonb_build_object(
          'revision_count', to_jsonb(new)->'revision_count',
          'approval_status', to_jsonb(new)->'approval_status'
        )
      )
    );

    new.last_transition_at := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."log_post_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_ai_documents"("query_embedding" "public"."vector", "match_count" integer DEFAULT 8, "p_owner_id" "uuid" DEFAULT NULL::"uuid", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_is_admin" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.ai_documents d
  where
    (p_is_admin = true or d.owner_id = p_owner_id)
    and (p_client_id is null or d.client_id = p_client_id)
  order by d.embedding <=> query_embedding
  limit greatest(match_count, 1);
end;
$$;


ALTER FUNCTION "public"."match_ai_documents"("query_embedding" "public"."vector", "match_count" integer, "p_owner_id" "uuid", "p_client_id" "uuid", "p_is_admin" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_approval_public_links_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_approval_public_links_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_posting_calendar_items"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_posting_calendar_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_posting_calendars"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_posting_calendars"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_posting_calendar_item_client_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.calendar_id is not null then
    select pc.client_id
      into new.client_id
    from public.posting_calendars pc
    where pc.id = new.calendar_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_posting_calendar_item_client_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_posting_calendar_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_posting_calendar_templates_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "client_id" "uuid",
    "action" "text" NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ip" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "source" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(1536) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "media_url" "text",
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "platform" "text" DEFAULT 'instagram'::"text",
    "scheduled_date" "date",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "feedback" "text",
    "reviewer_name" "text",
    "decided_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "calendar_post_id" "uuid",
    CONSTRAINT "approval_items_platform_check" CHECK (("platform" = ANY (ARRAY['instagram'::"text", 'facebook'::"text", 'linkedin'::"text", 'tiktok'::"text", 'youtube'::"text", 'twitter'::"text", 'other'::"text"]))),
    CONSTRAINT "approval_items_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'revision_requested'::"text"])))
);


ALTER TABLE "public"."approval_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_public_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "slug" "text" NOT NULL,
    "entity_type" "text" DEFAULT 'calendar_item'::"text" NOT NULL,
    "entity_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "expires_at" timestamp with time zone,
    "used_at" timestamp with time zone,
    "used_by_name" "text",
    "used_by_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."approval_public_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "decided_by" "uuid",
    "decided_at" timestamp with time zone,
    "decision_notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approvals_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['file'::"text", 'post'::"text", 'creative'::"text", 'campaign'::"text", 'task'::"text", 'calendar_item'::"text"]))),
    CONSTRAINT "approvals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'revision_requested'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_custom_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "board_custom_fields_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'number'::"text", 'date'::"text", 'select'::"text", 'multi_select'::"text", 'checkbox'::"text", 'url'::"text", 'person'::"text"])))
);


ALTER TABLE "public"."board_custom_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text",
    "sort_order" integer DEFAULT 0,
    "collapsed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."board_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#94a3b8'::"text",
    "sort_order" integer DEFAULT 0,
    "is_done" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."board_statuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "client_id" "uuid",
    "owner_id" "uuid",
    "color" "text" DEFAULT '#6366f1'::"text",
    "icon" "text" DEFAULT 'kanban'::"text",
    "is_template" boolean DEFAULT false,
    "archived_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."boards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid",
    "task_id" "uuid",
    "client_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "event_type" "text" DEFAULT 'task'::"text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "all_day" boolean DEFAULT false,
    "color" "text",
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "calendar_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['task'::"text", 'campaign'::"text", 'post'::"text", 'meeting'::"text", 'deadline'::"text", 'milestone'::"text"])))
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_portal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_portal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "company" "text",
    "segment" "text",
    "industry" "text",
    "status" "text" DEFAULT 'lead'::"text" NOT NULL,
    "plan" "text" DEFAULT 'Performance Pro'::"text" NOT NULL,
    "notes" "text",
    "value" numeric(12,2) DEFAULT 0 NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "kanban_pipeline" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "drive_folder_id" "text",
    "drive_subfolders" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "portal_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(24), 'hex'::"text") NOT NULL,
    "portal_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_free_or_trade" boolean DEFAULT false NOT NULL,
    "logo_url" "text",
    "site_url" "text",
    "site_description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_visible_site" boolean DEFAULT true NOT NULL,
    "is_featured_site" boolean DEFAULT false NOT NULL,
    "testimonial_content" "text",
    "testimonial_author_name" "text",
    "testimonial_author_role" "text",
    "testimonial_author_avatar" "text",
    "testimonial_rating" integer DEFAULT 5 NOT NULL,
    "testimonial_display_order" integer DEFAULT 0 NOT NULL,
    "is_testimonial_visible" boolean DEFAULT false NOT NULL,
    "generate_drive_folder" boolean DEFAULT true NOT NULL,
    "one_time_payment" boolean DEFAULT false NOT NULL,
    "health_score" integer DEFAULT 100 NOT NULL,
    "health_status" "text" DEFAULT 'healthy'::"text" NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "next_action" "text",
    "next_action_due" timestamp with time zone,
    CONSTRAINT "clients_health_status_check" CHECK (("health_status" = ANY (ARRAY['healthy'::"text", 'attention'::"text", 'critical'::"text"]))),
    CONSTRAINT "clients_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "clients_status_check" CHECK (("status" = ANY (ARRAY['lead'::"text", 'pending'::"text", 'active'::"text", 'inactive'::"text", 'lost'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "rotation_interval" integer DEFAULT 8000,
    "enable_fun" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dashboard_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "client_id" "uuid",
    "board_id" "uuid",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "variables" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rendered_blocks" "jsonb",
    "version" integer DEFAULT 1,
    "drive_file_id" "text",
    "drive_web_view_link" "text",
    "drive_download_link" "text",
    "drive_folder_id" "text",
    "pdf_generated_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "signed_at" timestamp with time zone,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "doc_documents_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'generated'::"text", 'sent'::"text", 'signed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."doc_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doc_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'proposal'::"text" NOT NULL,
    "icon" "text" DEFAULT '📄'::"text",
    "color" "text" DEFAULT '#6366f1'::"text",
    "blocks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "variables" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "default_values" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "doc_templates_category_check" CHECK (("category" = ANY (ARRAY['proposal'::"text", 'contract'::"text", 'report'::"text", 'brief'::"text", 'invoice'::"text", 'onboarding'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."doc_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drive_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "file_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "mime_type" "text",
    "folder_name" "text",
    "folder_id" "text",
    "version" integer DEFAULT 1 NOT NULL,
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "task_id" "uuid",
    "uploaded_by" "uuid",
    "approval_status" "text",
    "description" "text",
    CONSTRAINT "drive_files_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."drive_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."file_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "uploaded_by" "uuid",
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "change_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."file_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "acquisition_cost" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_entries_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "finance_entries_status_check" CHECK (("status" = ANY (ARRAY['paid'::"text", 'pending'::"text", 'overdue'::"text"]))),
    CONSTRAINT "finance_entries_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."finance_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intake_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "template_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'general'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "assigned_to" "uuid",
    "form_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text" DEFAULT 'admin'::"text" NOT NULL,
    "deadline" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "task_id" "uuid",
    CONSTRAINT "intake_requests_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "intake_requests_source_check" CHECK (("source" = ANY (ARRAY['admin'::"text", 'portal'::"text", 'email'::"text", 'api'::"text"]))),
    CONSTRAINT "intake_requests_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'triaged'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "intake_requests_type_check" CHECK (("type" = ANY (ARRAY['general'::"text", 'creative'::"text", 'campaign'::"text", 'support'::"text", 'onboarding'::"text", 'internal'::"text"])))
);


ALTER TABLE "public"."intake_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intake_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'general'::"text" NOT NULL,
    "fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "auto_assign_to" "uuid",
    "auto_create_task" boolean DEFAULT false NOT NULL,
    "default_priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "sla_hours" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intake_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."login_jokes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."login_jokes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'success'::"text", 'warning'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "required" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "automacao_executada" boolean DEFAULT false NOT NULL,
    CONSTRAINT "onboarding_tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."onboarding_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planejamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "plano_id" "uuid",
    "conteudo" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."planejamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "template_tarefas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "template_planejamento" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."planos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "changed_by" "uuid",
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "owner_role" "text",
    "stayed_seconds" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action" "text",
    "from_version" integer,
    "to_version" integer,
    "user_role" "text"
);


ALTER TABLE "public"."post_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "version_number" integer DEFAULT 1 NOT NULL,
    "title" "text",
    "content" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "change_reason" "text",
    "is_current" boolean DEFAULT false NOT NULL,
    "change_log" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."post_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posting_calendar_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "calendar_id" "uuid" NOT NULL,
    "post_date" "date" NOT NULL,
    "day_number" integer NOT NULL,
    "post_type" "text" DEFAULT 'feed'::"text" NOT NULL,
    "title" "text",
    "description" "text",
    "notes" "text",
    "image_url" "text",
    "video_url" "text",
    "label_color" "text",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workflow_status" "text" DEFAULT 'rascunho'::"text" NOT NULL,
    "owner_role" "text" DEFAULT 'social_media'::"text" NOT NULL,
    "owner_id" "uuid",
    "revision_count" integer DEFAULT 0 NOT NULL,
    "internal_checklist" "jsonb" DEFAULT '{"arte": false, "legenda": false, "drive_link": false}'::"jsonb" NOT NULL,
    "last_transition_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "posted_proof_url" "text",
    "approval_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approval_notes" "text",
    "approved_at" timestamp with time zone,
    "approved_by_name" "text",
    "checklist_arte_ok" boolean DEFAULT false NOT NULL,
    "checklist_legenda_ok" boolean DEFAULT false NOT NULL,
    "current_version_id" "uuid",
    "parent_post_id" "uuid",
    "version_number" integer DEFAULT 1 NOT NULL,
    "change_reason" "text",
    "change_log" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_current_version" boolean DEFAULT true NOT NULL,
    "superseded_at" timestamp with time zone,
    "deleted_at" timestamp without time zone,
    "client_id" "uuid",
    CONSTRAINT "posting_calendar_items_day_number_check" CHECK ((("day_number" >= 1) AND ("day_number" <= 31))),
    CONSTRAINT "posting_calendar_items_owner_role_check" CHECK (("owner_role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'equipe'::"text", 'cliente'::"text", 'sistema'::"text"]))),
    CONSTRAINT "posting_calendar_items_workflow_status_check" CHECK (("workflow_status" = ANY (ARRAY['rascunho'::"text", 'revisao_interna'::"text", 'aprovado_interno'::"text", 'em_aprovacao_cliente'::"text", 'revisao_cliente'::"text", 'aprovado_cliente'::"text", 'pronto_agendamento'::"text", 'agendado'::"text", 'publicado'::"text"])))
);


ALTER TABLE "public"."posting_calendar_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posting_calendar_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "client_id" "uuid",
    "reference_image_url" "text",
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "legend_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."posting_calendar_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posting_calendars" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "title" "text",
    "template_name" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "exported_file_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approval_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "approval_requested_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by_name" "text",
    CONSTRAINT "posting_calendars_month_check" CHECK ((("month" >= 0) AND ("month" <= 11))),
    CONSTRAINT "posting_calendars_year_check" CHECK ((("year" >= 2000) AND ("year" <= 2100)))
);


ALTER TABLE "public"."posting_calendars" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "avatar_url" "text",
    "bio" "text" DEFAULT ''::"text" NOT NULL,
    "specialties" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "performance_score" numeric(5,2) DEFAULT 0 NOT NULL,
    "active_projects" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "username" "text",
    "access_scope" "text" DEFAULT 'limited'::"text",
    "functional_profile" "text" DEFAULT 'operacao'::"text",
    CONSTRAINT "profiles_access_scope_check" CHECK (("access_scope" = ANY (ARRAY['full'::"text", 'limited'::"text", 'client_only'::"text"]))),
    CONSTRAINT "profiles_functional_profile_check" CHECK (("functional_profile" = ANY (ARRAY['direcao'::"text", 'operacao'::"text", 'gestao'::"text", 'criacao'::"text", 'cliente'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'equipe'::"text", 'cliente'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" "text" NOT NULL,
    "action" "text" NOT NULL,
    "client_id" "uuid",
    "user_id" "uuid",
    "table_name" "text",
    "query" "text",
    "message" "text",
    "error" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_custom_field_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "field_id" "uuid" NOT NULL,
    "value_text" "text",
    "value_number" numeric,
    "value_date" timestamp with time zone,
    "value_json" "jsonb"
);


ALTER TABLE "public"."task_custom_field_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "depends_on_task_id" "uuid" NOT NULL,
    "dependency_type" "text" DEFAULT 'blocks'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "task_dependencies_dependency_type_check" CHECK (("dependency_type" = ANY (ARRAY['blocks'::"text", 'related'::"text"])))
);


ALTER TABLE "public"."task_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "title" "text",
    "link_type" "text" DEFAULT 'general'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "task_links_link_type_check" CHECK (("link_type" = ANY (ARRAY['general'::"text", 'figma'::"text", 'gdrive'::"text", 'notion'::"text", 'loom'::"text", 'github'::"text"])))
);


ALTER TABLE "public"."task_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_state_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "time_in_prev_status_minutes" integer
);


ALTER TABLE "public"."task_state_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'todo'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "assignee_id" "uuid",
    "due_date" timestamp with time zone,
    "checklist" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "custom_fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sla_deadline" timestamp with time zone,
    "last_action_at" timestamp with time zone DEFAULT "now"(),
    "next_action" "text",
    "next_action_by" "uuid",
    "service_type" "text",
    "group_id" "text",
    "intake_request_id" "uuid",
    "board_id" "uuid",
    "section_id" "uuid",
    "status_id" "uuid",
    "publish_at" timestamp with time zone,
    "estimated_minutes" integer,
    "activity_type" "text",
    "channel" "text",
    "approval_required" boolean DEFAULT false,
    "approval_id" "uuid",
    "sort_order" integer DEFAULT 0,
    "intake_id" "uuid",
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."timeline_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "actor_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."timeline_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "trigger_event" "text" NOT NULL,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workflow_definitions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_documents"
    ADD CONSTRAINT "ai_documents_owner_id_source_source_id_key" UNIQUE ("owner_id", "source", "source_id");



ALTER TABLE ONLY "public"."ai_documents"
    ADD CONSTRAINT "ai_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_items"
    ADD CONSTRAINT "approval_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_public_links"
    ADD CONSTRAINT "approval_public_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_public_links"
    ADD CONSTRAINT "approval_public_links_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_custom_fields"
    ADD CONSTRAINT "board_custom_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_sections"
    ADD CONSTRAINT "board_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_statuses"
    ADD CONSTRAINT "board_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_portal"
    ADD CONSTRAINT "client_portal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_portal"
    ADD CONSTRAINT "client_portal_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_portal_token_key" UNIQUE ("portal_token");



ALTER TABLE ONLY "public"."dashboard_settings"
    ADD CONSTRAINT "dashboard_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_documents"
    ADD CONSTRAINT "doc_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doc_templates"
    ADD CONSTRAINT "doc_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drive_files"
    ADD CONSTRAINT "drive_files_file_id_key" UNIQUE ("file_id");



ALTER TABLE ONLY "public"."drive_files"
    ADD CONSTRAINT "drive_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_comments"
    ADD CONSTRAINT "file_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_file_id_version_number_key" UNIQUE ("file_id", "version_number");



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_entries"
    ADD CONSTRAINT "finance_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intake_requests"
    ADD CONSTRAINT "intake_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intake_templates"
    ADD CONSTRAINT "intake_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."login_jokes"
    ADD CONSTRAINT "login_jokes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_tasks"
    ADD CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planejamentos"
    ADD CONSTRAINT "planejamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planos"
    ADD CONSTRAINT "planos_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."planos"
    ADD CONSTRAINT "planos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_logs"
    ADD CONSTRAINT "post_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_versions"
    ADD CONSTRAINT "post_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posting_calendar_items"
    ADD CONSTRAINT "posting_calendar_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posting_calendar_templates"
    ADD CONSTRAINT "posting_calendar_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posting_calendars"
    ADD CONSTRAINT "posting_calendars_client_id_month_year_key" UNIQUE ("client_id", "month", "year");



ALTER TABLE ONLY "public"."posting_calendars"
    ADD CONSTRAINT "posting_calendars_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_logs"
    ADD CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."task_custom_field_values"
    ADD CONSTRAINT "task_custom_field_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_custom_field_values"
    ADD CONSTRAINT "task_custom_field_values_task_id_field_id_key" UNIQUE ("task_id", "field_id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_task_id_depends_on_task_id_key" UNIQUE ("task_id", "depends_on_task_id");



ALTER TABLE ONLY "public"."task_links"
    ADD CONSTRAINT "task_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_state_changes"
    ADD CONSTRAINT "task_state_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."timeline_events"
    ADD CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_definitions"
    ADD CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_logs_action" ON "public"."activity_logs" USING "btree" ("action");



CREATE INDEX "idx_activity_logs_client_created_at" ON "public"."activity_logs" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_activity_logs_client_id" ON "public"."activity_logs" USING "btree" ("client_id");



CREATE INDEX "idx_activity_logs_created_at" ON "public"."activity_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_logs_entity" ON "public"."activity_logs" USING "btree" ("entity");



CREATE INDEX "idx_activity_logs_user_id" ON "public"."activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_ai_documents_embedding" ON "public"."ai_documents" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_ai_documents_owner_created_at" ON "public"."ai_documents" USING "btree" ("owner_id", "created_at" DESC);



CREATE INDEX "idx_approval_items_approval" ON "public"."approval_items" USING "btree" ("approval_id");



CREATE INDEX "idx_approval_items_calendar_post" ON "public"."approval_items" USING "btree" ("calendar_post_id");



CREATE INDEX "idx_approval_items_status" ON "public"."approval_items" USING "btree" ("status");



CREATE INDEX "idx_approval_links_slug" ON "public"."approval_public_links" USING "btree" ("slug");



CREATE INDEX "idx_approval_public_links_approval_id" ON "public"."approval_public_links" USING "btree" ("approval_id");



CREATE INDEX "idx_approval_public_links_client_id" ON "public"."approval_public_links" USING "btree" ("client_id");



CREATE INDEX "idx_approval_public_links_slug" ON "public"."approval_public_links" USING "btree" ("slug");



CREATE INDEX "idx_approvals_client" ON "public"."approvals" USING "btree" ("client_id", "status");



CREATE INDEX "idx_approvals_entity" ON "public"."approvals" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_approvals_status" ON "public"."approvals" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_board_sections_board" ON "public"."board_sections" USING "btree" ("board_id", "sort_order");



CREATE INDEX "idx_board_statuses_board" ON "public"."board_statuses" USING "btree" ("board_id", "sort_order");



CREATE INDEX "idx_boards_client" ON "public"."boards" USING "btree" ("client_id");



CREATE INDEX "idx_calendar_events_starts" ON "public"."calendar_events" USING "btree" ("starts_at", "client_id");



CREATE INDEX "idx_client_portal_active_expires" ON "public"."client_portal" USING "btree" ("is_active", "expires_at");



CREATE INDEX "idx_client_portal_client_created" ON "public"."client_portal" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_clients_health_status" ON "public"."clients" USING "btree" ("health_status");



CREATE INDEX "idx_clients_owner_id" ON "public"."clients" USING "btree" ("owner_id");



CREATE INDEX "idx_clients_status" ON "public"."clients" USING "btree" ("status");



CREATE INDEX "idx_doc_documents_client" ON "public"."doc_documents" USING "btree" ("client_id");



CREATE INDEX "idx_doc_documents_status" ON "public"."doc_documents" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_doc_templates_category" ON "public"."doc_templates" USING "btree" ("category", "is_active");



CREATE INDEX "idx_drive_files_client_updated_at" ON "public"."drive_files" USING "btree" ("client_id", "updated_at" DESC);



CREATE INDEX "idx_drive_files_folder_id" ON "public"."drive_files" USING "btree" ("folder_id");



CREATE INDEX "idx_drive_files_task_id" ON "public"."drive_files" USING "btree" ("task_id");



CREATE INDEX "idx_file_comments_file_id" ON "public"."file_comments" USING "btree" ("file_id", "created_at" DESC);



CREATE INDEX "idx_finance_entries_client_date" ON "public"."finance_entries" USING "btree" ("client_id", "date" DESC);



CREATE INDEX "idx_finance_entries_type_status" ON "public"."finance_entries" USING "btree" ("type", "status");



CREATE INDEX "idx_intake_requests_assigned" ON "public"."intake_requests" USING "btree" ("assigned_to", "status");



CREATE INDEX "idx_intake_requests_assigned_to" ON "public"."intake_requests" USING "btree" ("assigned_to");



CREATE INDEX "idx_intake_requests_client" ON "public"."intake_requests" USING "btree" ("client_id", "status");



CREATE INDEX "idx_intake_requests_created_at" ON "public"."intake_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_intake_requests_created_by" ON "public"."intake_requests" USING "btree" ("created_by");



CREATE INDEX "idx_intake_requests_status" ON "public"."intake_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_intake_requests_status_created" ON "public"."intake_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_notifications_user_id_created_at" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_onboarding_tasks_client_order" ON "public"."onboarding_tasks" USING "btree" ("client_id", "order_index");



CREATE INDEX "idx_post_logs_post_created" ON "public"."post_logs" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "idx_post_logs_post_id" ON "public"."post_logs" USING "btree" ("post_id");



CREATE UNIQUE INDEX "idx_post_versions_current_unique" ON "public"."post_versions" USING "btree" ("post_id") WHERE ("is_current" = true);



CREATE INDEX "idx_post_versions_post_created" ON "public"."post_versions" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "idx_post_versions_post_id" ON "public"."post_versions" USING "btree" ("post_id");



CREATE INDEX "idx_post_versions_post_id_version_number" ON "public"."post_versions" USING "btree" ("post_id", "version_number" DESC);



CREATE UNIQUE INDEX "idx_post_versions_post_version" ON "public"."post_versions" USING "btree" ("post_id", "version_number");



CREATE INDEX "idx_posting_calendar_items_calendar_approval" ON "public"."posting_calendar_items" USING "btree" ("calendar_id", "approval_status");



CREATE INDEX "idx_posting_calendar_items_calendar_id" ON "public"."posting_calendar_items" USING "btree" ("calendar_id");



CREATE INDEX "idx_posting_calendar_items_client_workflow_date" ON "public"."posting_calendar_items" USING "btree" ("client_id", "workflow_status", "post_date");



CREATE INDEX "idx_posting_calendar_items_current_version" ON "public"."posting_calendar_items" USING "btree" ("parent_post_id", "is_current_version") WHERE ("is_current_version" = true);



CREATE INDEX "idx_posting_calendar_items_current_version_id" ON "public"."posting_calendar_items" USING "btree" ("current_version_id");



CREATE INDEX "idx_posting_calendar_items_parent_post_id" ON "public"."posting_calendar_items" USING "btree" ("parent_post_id");



CREATE INDEX "idx_posting_calendar_items_parent_version" ON "public"."posting_calendar_items" USING "btree" ("parent_post_id", "version_number" DESC);



CREATE INDEX "idx_posting_calendar_items_post_date" ON "public"."posting_calendar_items" USING "btree" ("post_date");



CREATE INDEX "idx_posting_calendar_items_workflow_status" ON "public"."posting_calendar_items" USING "btree" ("workflow_status", "owner_role", "revision_count");



CREATE INDEX "idx_posting_calendar_templates_client" ON "public"."posting_calendar_templates" USING "btree" ("client_id", "updated_at" DESC);



CREATE INDEX "idx_posting_calendar_templates_scope_active" ON "public"."posting_calendar_templates" USING "btree" ("is_active", "updated_at" DESC);



CREATE UNIQUE INDEX "idx_posting_calendar_templates_slug_scope" ON "public"."posting_calendar_templates" USING "btree" (COALESCE(("client_id")::"text", 'default'::"text"), "slug");



CREATE INDEX "idx_posting_calendars_client_approval" ON "public"."posting_calendars" USING "btree" ("client_id", "approval_status");



CREATE INDEX "idx_posting_calendars_client_id" ON "public"."posting_calendars" USING "btree" ("client_id");



CREATE INDEX "idx_posting_calendars_month_year" ON "public"."posting_calendars" USING "btree" ("month", "year");



CREATE INDEX "idx_task_state_changes_task" ON "public"."task_state_changes" USING "btree" ("task_id", "changed_at");



CREATE INDEX "idx_tasks_assignee_id" ON "public"."tasks" USING "btree" ("assignee_id");



CREATE INDEX "idx_tasks_board" ON "public"."tasks" USING "btree" ("board_id", "section_id", "sort_order");



CREATE INDEX "idx_tasks_client_status_order" ON "public"."tasks" USING "btree" ("client_id", "status", "order_index");



CREATE INDEX "idx_tasks_service_type" ON "public"."tasks" USING "btree" ("service_type");



CREATE INDEX "idx_tasks_sla_deadline" ON "public"."tasks" USING "btree" ("sla_deadline") WHERE ("sla_deadline" IS NOT NULL);



CREATE INDEX "idx_tasks_status_id" ON "public"."tasks" USING "btree" ("status_id");



CREATE INDEX "idx_timeline_actor" ON "public"."timeline_events" USING "btree" ("actor_id");



CREATE INDEX "idx_timeline_events_client" ON "public"."timeline_events" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_timeline_events_entity" ON "public"."timeline_events" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "onboarding_tasks_client_automacao_idx" ON "public"."onboarding_tasks" USING "btree" ("client_id", "automacao_executada");



CREATE UNIQUE INDEX "planejamentos_cliente_id_uidx" ON "public"."planejamentos" USING "btree" ("cliente_id");



CREATE INDEX "planos_nome_idx" ON "public"."planos" USING "btree" ("lower"("nome"));



CREATE UNIQUE INDEX "profiles_username_idx" ON "public"."profiles" USING "btree" ("username");



CREATE INDEX "system_logs_client_id_idx" ON "public"."system_logs" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "system_logs_created_at_idx" ON "public"."system_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "system_logs_scope_action_idx" ON "public"."system_logs" USING "btree" ("scope", "action", "created_at" DESC);



CREATE OR REPLACE TRIGGER "set_approvals_updated_at" BEFORE UPDATE ON "public"."approvals" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_file_comments_updated_at" BEFORE UPDATE ON "public"."file_comments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_intake_requests_updated_at" BEFORE UPDATE ON "public"."intake_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_intake_templates_updated_at" BEFORE UPDATE ON "public"."intake_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_workflow_definitions_updated_at" BEFORE UPDATE ON "public"."workflow_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ai_documents_updated_at" BEFORE UPDATE ON "public"."ai_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_approval_public_links_updated_at" BEFORE UPDATE ON "public"."approval_public_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_approval_public_links_updated_at"();



CREATE OR REPLACE TRIGGER "trg_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_drive_files_updated_at" BEFORE UPDATE ON "public"."drive_files" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_finance_entries_updated_at" BEFORE UPDATE ON "public"."finance_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_onboarding_tasks_updated_at" BEFORE UPDATE ON "public"."onboarding_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_posting_calendar_items_log_transition" BEFORE UPDATE ON "public"."posting_calendar_items" FOR EACH ROW EXECUTE FUNCTION "public"."log_post_transition"();



CREATE OR REPLACE TRIGGER "trg_posting_calendar_items_updated_at" BEFORE UPDATE ON "public"."posting_calendar_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_posting_calendar_items"();



CREATE OR REPLACE TRIGGER "trg_posting_calendars_updated_at" BEFORE UPDATE ON "public"."posting_calendars" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_posting_calendars"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_posting_calendar_item_client_id" BEFORE INSERT OR UPDATE OF "calendar_id" ON "public"."posting_calendar_items" FOR EACH ROW EXECUTE FUNCTION "public"."sync_posting_calendar_item_client_id"();



CREATE OR REPLACE TRIGGER "trg_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_posting_calendar_templates_updated_at" BEFORE UPDATE ON "public"."posting_calendar_templates" FOR EACH ROW EXECUTE FUNCTION "public"."touch_posting_calendar_templates_updated_at"();



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_documents"
    ADD CONSTRAINT "ai_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_documents"
    ADD CONSTRAINT "ai_documents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_items"
    ADD CONSTRAINT "approval_items_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_items"
    ADD CONSTRAINT "approval_items_calendar_post_id_fkey" FOREIGN KEY ("calendar_post_id") REFERENCES "public"."posting_calendar_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_public_links"
    ADD CONSTRAINT "approval_public_links_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_public_links"
    ADD CONSTRAINT "approval_public_links_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_custom_fields"
    ADD CONSTRAINT "board_custom_fields_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_sections"
    ADD CONSTRAINT "board_sections_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_statuses"
    ADD CONSTRAINT "board_statuses_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_portal"
    ADD CONSTRAINT "client_portal_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."doc_documents"
    ADD CONSTRAINT "doc_documents_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."doc_documents"
    ADD CONSTRAINT "doc_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."doc_documents"
    ADD CONSTRAINT "doc_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."doc_documents"
    ADD CONSTRAINT "doc_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."doc_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."doc_templates"
    ADD CONSTRAINT "doc_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."drive_files"
    ADD CONSTRAINT "drive_files_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drive_files"
    ADD CONSTRAINT "drive_files_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."drive_files"
    ADD CONSTRAINT "drive_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_comments"
    ADD CONSTRAINT "file_comments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_comments"
    ADD CONSTRAINT "file_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."file_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_comments"
    ADD CONSTRAINT "file_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_comments"
    ADD CONSTRAINT "file_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_versions"
    ADD CONSTRAINT "file_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_entries"
    ADD CONSTRAINT "finance_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."timeline_events"
    ADD CONSTRAINT "fk_timeline_actor" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intake_requests"
    ADD CONSTRAINT "intake_requests_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intake_requests"
    ADD CONSTRAINT "intake_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intake_requests"
    ADD CONSTRAINT "intake_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intake_requests"
    ADD CONSTRAINT "intake_requests_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."intake_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intake_requests"
    ADD CONSTRAINT "intake_task_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."intake_templates"
    ADD CONSTRAINT "intake_templates_auto_assign_to_fkey" FOREIGN KEY ("auto_assign_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_tasks"
    ADD CONSTRAINT "onboarding_tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planejamentos"
    ADD CONSTRAINT "planejamentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planejamentos"
    ADD CONSTRAINT "planejamentos_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."post_logs"
    ADD CONSTRAINT "post_logs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posting_calendar_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posting_calendar_items"
    ADD CONSTRAINT "posting_calendar_items_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "public"."posting_calendars"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posting_calendar_items"
    ADD CONSTRAINT "posting_calendar_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posting_calendar_items"
    ADD CONSTRAINT "posting_calendar_items_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "public"."post_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posting_calendar_items"
    ADD CONSTRAINT "posting_calendar_items_parent_post_id_fkey" FOREIGN KEY ("parent_post_id") REFERENCES "public"."posting_calendar_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posting_calendar_templates"
    ADD CONSTRAINT "posting_calendar_templates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posting_calendars"
    ADD CONSTRAINT "posting_calendars_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posting_calendars"
    ADD CONSTRAINT "posting_calendars_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_logs"
    ADD CONSTRAINT "system_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_custom_field_values"
    ADD CONSTRAINT "task_custom_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."board_custom_fields"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_custom_field_values"
    ADD CONSTRAINT "task_custom_field_values_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_dependencies"
    ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_links"
    ADD CONSTRAINT "task_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_state_changes"
    ADD CONSTRAINT "task_state_changes_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."task_state_changes"
    ADD CONSTRAINT "task_state_changes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_intake_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."intake_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_intake_request_id_fkey" FOREIGN KEY ("intake_request_id") REFERENCES "public"."intake_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_next_action_by_fkey" FOREIGN KEY ("next_action_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."board_sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."board_statuses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."timeline_events"
    ADD CONSTRAINT "timeline_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."timeline_events"
    ADD CONSTRAINT "timeline_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



CREATE POLICY "Allow all for authenticated" ON "public"."intake_requests" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated insert post_logs" ON "public"."post_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert post_versions" ON "public"."post_versions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated read post_logs" ON "public"."post_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read post_versions" ON "public"."post_versions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update post_versions" ON "public"."post_versions" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow public read-only access to visible clients" ON "public"."clients" FOR SELECT TO "anon" USING (("is_visible_site" = true));



CREATE POLICY "Anon update approval_items status" ON "public"."approval_items" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Anon update calendar item approval" ON "public"."posting_calendar_items" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated full access approval_items" ON "public"."approval_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated full access approval_public_links" ON "public"."approval_public_links" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated full access calendar items" ON "public"."posting_calendar_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Gestão total admin" ON "public"."login_jokes" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Internal insert post_versions" ON "public"."post_versions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'equipe'::"text", 'sistema'::"text"]))))));



CREATE POLICY "Internal select post_versions" ON "public"."post_versions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'equipe'::"text", 'sistema'::"text"]))))));



CREATE POLICY "Internal select posting_calendar_items" ON "public"."posting_calendar_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'equipe'::"text", 'sistema'::"text"]))))));



CREATE POLICY "Internal update post_versions" ON "public"."post_versions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'equipe'::"text", 'sistema'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'equipe'::"text", 'sistema'::"text"]))))));



CREATE POLICY "Internal update posting_calendar_items" ON "public"."posting_calendar_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'equipe'::"text", 'sistema'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'equipe'::"text", 'sistema'::"text"]))))));



CREATE POLICY "Leitura logada" ON "public"."login_jokes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Leitura pública autenticada" ON "public"."dashboard_settings" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Permitir gestão para admins" ON "public"."login_jokes" USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))));



CREATE POLICY "Permitir leitura para todos logados" ON "public"."login_jokes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Public read approval_items via link" ON "public"."approval_items" FOR SELECT USING (true);



CREATE POLICY "Public read approval_public_links by slug" ON "public"."approval_public_links" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public read calendar items" ON "public"."posting_calendar_items" FOR SELECT USING (true);



CREATE POLICY "Public update approval_items status" ON "public"."approval_items" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Users can insert activity logs" ON "public"."activity_logs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read activity logs" ON "public"."activity_logs" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_logs_insert" ON "public"."activity_logs" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("user_id" = "auth"."uid"())));



CREATE POLICY "activity_logs_select" ON "public"."activity_logs" FOR SELECT USING (true);



ALTER TABLE "public"."ai_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_documents_all" ON "public"."ai_documents" USING ((("owner_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("owner_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."approval_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_items_full_access" ON "public"."approval_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



ALTER TABLE "public"."approval_public_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_public_links_insert_authenticated" ON "public"."approval_public_links" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "approval_public_links_select_anon_active_only" ON "public"."approval_public_links" FOR SELECT TO "anon" USING ((("is_active" = true) AND (("expires_at" IS NULL) OR ("expires_at" > "now"()))));



CREATE POLICY "approval_public_links_select_authenticated" ON "public"."approval_public_links" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "approval_public_links_update_anon_active_only" ON "public"."approval_public_links" FOR UPDATE TO "anon" USING ((("is_active" = true) AND (("expires_at" IS NULL) OR ("expires_at" > "now"())))) WITH CHECK (("is_active" = true));



CREATE POLICY "approval_public_links_update_authenticated" ON "public"."approval_public_links" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."approvals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approvals_full_access" ON "public"."approvals" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "approvals_insert" ON "public"."approvals" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "approvals_select" ON "public"."approvals" FOR SELECT USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "approvals"."client_id") AND ("c"."owner_id" = "auth"."uid"())))) OR ("requested_by" = "auth"."uid"())));



CREATE POLICY "approvals_select_anon_by_active_public_link" ON "public"."approvals" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."approval_public_links" "apl"
  WHERE (("apl"."approval_id" = "approvals"."id") AND ("apl"."is_active" = true) AND (("apl"."expires_at" IS NULL) OR ("apl"."expires_at" > "now"()))))));



CREATE POLICY "approvals_update" ON "public"."approvals" FOR UPDATE USING (("public"."is_admin"() OR ("requested_by" = "auth"."uid"())));



CREATE POLICY "approvals_update_anon_by_active_public_link" ON "public"."approvals" FOR UPDATE TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."approval_public_links" "apl"
  WHERE (("apl"."approval_id" = "approvals"."id") AND ("apl"."is_active" = true) AND (("apl"."expires_at" IS NULL) OR ("apl"."expires_at" > "now"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."approval_public_links" "apl"
  WHERE (("apl"."approval_id" = "approvals"."id") AND ("apl"."is_active" = true) AND (("apl"."expires_at" IS NULL) OR ("apl"."expires_at" > "now"()))))));



CREATE POLICY "auth_all_board_custom_fields" ON "public"."board_custom_fields" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_board_sections" ON "public"."board_sections" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_board_statuses" ON "public"."board_statuses" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_boards" ON "public"."boards" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_calendar_events" ON "public"."calendar_events" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_doc_documents" ON "public"."doc_documents" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_doc_templates" ON "public"."doc_templates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_task_cf_values" ON "public"."task_custom_field_values" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_task_dependencies" ON "public"."task_dependencies" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_task_links" ON "public"."task_links" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_task_state_changes" ON "public"."task_state_changes" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."board_custom_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."boards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_items_full_access" ON "public"."posting_calendar_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



ALTER TABLE "public"."client_portal" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_portal_all" ON "public"."client_portal" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_portal"."client_id") AND (("c"."owner_id" = "auth"."uid"()) OR "public"."is_admin"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_portal"."client_id") AND (("c"."owner_id" = "auth"."uid"()) OR "public"."is_admin"())))));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_delete" ON "public"."clients" FOR DELETE USING ((("owner_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "clients_insert" ON "public"."clients" FOR INSERT WITH CHECK ((("owner_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "clients_select" ON "public"."clients" FOR SELECT USING ((("owner_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "clients_update" ON "public"."clients" FOR UPDATE USING ((("owner_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("owner_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."dashboard_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doc_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drive_files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "drive_files_all" ON "public"."drive_files" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "drive_files"."client_id") AND (("c"."owner_id" = "auth"."uid"()) OR "public"."is_admin"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "drive_files"."client_id") AND (("c"."owner_id" = "auth"."uid"()) OR "public"."is_admin"())))));



ALTER TABLE "public"."file_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "file_comments_delete" ON "public"."file_comments" FOR DELETE USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



CREATE POLICY "file_comments_insert" ON "public"."file_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "file_comments_select" ON "public"."file_comments" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "file_comments_update" ON "public"."file_comments" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



ALTER TABLE "public"."file_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "file_versions_insert" ON "public"."file_versions" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "file_versions_select" ON "public"."file_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."drive_files" "df"
     JOIN "public"."clients" "c" ON (("c"."id" = "df"."client_id")))
  WHERE (("df"."id" = "file_versions"."file_id") AND (("c"."owner_id" = "auth"."uid"()) OR "public"."is_admin"())))));



ALTER TABLE "public"."finance_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_entries_all" ON "public"."finance_entries" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "finance_entries"."client_id") AND (("c"."owner_id" = "auth"."uid"()) OR "public"."is_admin"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "finance_entries"."client_id") AND (("c"."owner_id" = "auth"."uid"()) OR "public"."is_admin"())))));



ALTER TABLE "public"."intake_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "intake_requests_insert" ON "public"."intake_requests" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "intake_requests_select" ON "public"."intake_requests" FOR SELECT USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "intake_requests"."client_id") AND ("c"."owner_id" = "auth"."uid"())))) OR ("assigned_to" = "auth"."uid"()) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "intake_requests_update" ON "public"."intake_requests" FOR UPDATE USING (("public"."is_admin"() OR ("assigned_to" = "auth"."uid"()) OR ("created_by" = "auth"."uid"())));



ALTER TABLE "public"."intake_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "intake_templates_all" ON "public"."intake_templates" USING ("public"."is_admin"());



CREATE POLICY "intake_templates_select" ON "public"."intake_templates" FOR SELECT USING ((("is_active" = true) OR "public"."is_admin"()));



ALTER TABLE "public"."login_jokes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert_admin" ON "public"."notifications" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."onboarding_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "onboarding_tasks_all" ON "public"."onboarding_tasks" USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "onboarding_tasks"."client_id") AND (("c"."owner_id" = "auth"."uid"()) OR "public"."is_admin"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "onboarding_tasks"."client_id") AND (("c"."owner_id" = "auth"."uid"()) OR "public"."is_admin"())))));



ALTER TABLE "public"."planejamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_logs_full_access" ON "public"."post_logs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



ALTER TABLE "public"."post_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posting_calendar_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posting_calendar_items_delete_authenticated" ON "public"."posting_calendar_items" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "posting_calendar_items_insert_authenticated" ON "public"."posting_calendar_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "posting_calendar_items_select_authenticated" ON "public"."posting_calendar_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "posting_calendar_items_update_authenticated" ON "public"."posting_calendar_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."posting_calendar_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posting_calendar_templates_select" ON "public"."posting_calendar_templates" FOR SELECT USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "posting_calendar_templates"."client_id") AND ("c"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "posting_calendar_templates_write" ON "public"."posting_calendar_templates" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "posting_calendar_templates"."client_id") AND ("c"."owner_id" = "auth"."uid"())))))) WITH CHECK (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "posting_calendar_templates"."client_id") AND ("c"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "posting_calendars_delete_authenticated" ON "public"."posting_calendars" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "posting_calendars_insert_authenticated" ON "public"."posting_calendars" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "posting_calendars_select_authenticated" ON "public"."posting_calendars" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "posting_calendars_update_authenticated" ON "public"."posting_calendars" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE USING ((("id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."system_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_logs_internal_insert" ON "public"."system_logs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profile"
  WHERE (("profile"."id" = "auth"."uid"()) AND (COALESCE("profile"."role", ''::"text") = ANY (ARRAY['admin'::"text", 'admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'sistema'::"text"]))))));



CREATE POLICY "system_logs_internal_select" ON "public"."system_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profile"
  WHERE (("profile"."id" = "auth"."uid"()) AND (COALESCE("profile"."role", ''::"text") = ANY (ARRAY['admin'::"text", 'admin_estrategico'::"text", 'admin_operacional'::"text", 'gestor'::"text", 'social_media'::"text", 'sistema'::"text"]))))));



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_settings_admin" ON "public"."system_settings" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "system_settings_delete_full_admin" ON "public"."system_settings" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text"])) AND ("p"."access_scope" = 'full'::"text")))));



CREATE POLICY "system_settings_insert_full_admin" ON "public"."system_settings" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text"])) AND ("p"."access_scope" = 'full'::"text")))));



CREATE POLICY "system_settings_read" ON "public"."system_settings" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "system_settings_select_authenticated" ON "public"."system_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "system_settings_update_full_admin" ON "public"."system_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text"])) AND ("p"."access_scope" = 'full'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin_estrategico'::"text", 'admin_operacional'::"text"])) AND ("p"."access_scope" = 'full'::"text")))));



ALTER TABLE "public"."task_custom_field_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_state_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_all" ON "public"."tasks" USING ((("assignee_id" = "auth"."uid"()) OR "public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "tasks"."client_id") AND (("c"."owner_id" = "auth"."uid"()) OR "public"."is_admin"()))))));



ALTER TABLE "public"."timeline_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "timeline_events_insert" ON "public"."timeline_events" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "timeline_events_select" ON "public"."timeline_events" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."workflow_definitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workflow_definitions_all" ON "public"."workflow_definitions" USING ("public"."is_admin"());





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."activity_logs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."posting_calendar_items";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";





























































































































































































GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_intake_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_intake_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_intake_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_post_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_post_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_post_transition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_ai_documents"("query_embedding" "public"."vector", "match_count" integer, "p_owner_id" "uuid", "p_client_id" "uuid", "p_is_admin" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."match_ai_documents"("query_embedding" "public"."vector", "match_count" integer, "p_owner_id" "uuid", "p_client_id" "uuid", "p_is_admin" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_ai_documents"("query_embedding" "public"."vector", "match_count" integer, "p_owner_id" "uuid", "p_client_id" "uuid", "p_is_admin" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_approval_public_links_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_approval_public_links_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_approval_public_links_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_posting_calendar_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_posting_calendar_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_posting_calendar_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_posting_calendars"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_posting_calendars"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_posting_calendars"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_posting_calendar_item_client_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_posting_calendar_item_client_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_posting_calendar_item_client_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_posting_calendar_templates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_posting_calendar_templates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_posting_calendar_templates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";















GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_documents" TO "anon";
GRANT ALL ON TABLE "public"."ai_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_documents" TO "service_role";



GRANT ALL ON TABLE "public"."approval_items" TO "anon";
GRANT ALL ON TABLE "public"."approval_items" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_items" TO "service_role";



GRANT ALL ON TABLE "public"."approval_public_links" TO "anon";
GRANT ALL ON TABLE "public"."approval_public_links" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_public_links" TO "service_role";



GRANT ALL ON TABLE "public"."approvals" TO "anon";
GRANT ALL ON TABLE "public"."approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."approvals" TO "service_role";



GRANT ALL ON TABLE "public"."board_custom_fields" TO "anon";
GRANT ALL ON TABLE "public"."board_custom_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."board_custom_fields" TO "service_role";



GRANT ALL ON TABLE "public"."board_sections" TO "anon";
GRANT ALL ON TABLE "public"."board_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."board_sections" TO "service_role";



GRANT ALL ON TABLE "public"."board_statuses" TO "anon";
GRANT ALL ON TABLE "public"."board_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."board_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."boards" TO "anon";
GRANT ALL ON TABLE "public"."boards" TO "authenticated";
GRANT ALL ON TABLE "public"."boards" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."client_portal" TO "anon";
GRANT ALL ON TABLE "public"."client_portal" TO "authenticated";
GRANT ALL ON TABLE "public"."client_portal" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_settings" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_settings" TO "service_role";



GRANT ALL ON TABLE "public"."doc_documents" TO "anon";
GRANT ALL ON TABLE "public"."doc_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_documents" TO "service_role";



GRANT ALL ON TABLE "public"."doc_templates" TO "anon";
GRANT ALL ON TABLE "public"."doc_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."doc_templates" TO "service_role";



GRANT ALL ON TABLE "public"."drive_files" TO "anon";
GRANT ALL ON TABLE "public"."drive_files" TO "authenticated";
GRANT ALL ON TABLE "public"."drive_files" TO "service_role";



GRANT ALL ON TABLE "public"."file_comments" TO "anon";
GRANT ALL ON TABLE "public"."file_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."file_comments" TO "service_role";



GRANT ALL ON TABLE "public"."file_versions" TO "anon";
GRANT ALL ON TABLE "public"."file_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."file_versions" TO "service_role";



GRANT ALL ON TABLE "public"."finance_entries" TO "anon";
GRANT ALL ON TABLE "public"."finance_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_entries" TO "service_role";



GRANT ALL ON TABLE "public"."intake_requests" TO "anon";
GRANT ALL ON TABLE "public"."intake_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."intake_requests" TO "service_role";



GRANT ALL ON TABLE "public"."intake_templates" TO "anon";
GRANT ALL ON TABLE "public"."intake_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."intake_templates" TO "service_role";



GRANT ALL ON TABLE "public"."login_jokes" TO "anon";
GRANT ALL ON TABLE "public"."login_jokes" TO "authenticated";
GRANT ALL ON TABLE "public"."login_jokes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_tasks" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."planejamentos" TO "anon";
GRANT ALL ON TABLE "public"."planejamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."planejamentos" TO "service_role";



GRANT ALL ON TABLE "public"."planos" TO "anon";
GRANT ALL ON TABLE "public"."planos" TO "authenticated";
GRANT ALL ON TABLE "public"."planos" TO "service_role";



GRANT ALL ON TABLE "public"."post_logs" TO "anon";
GRANT ALL ON TABLE "public"."post_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."post_logs" TO "service_role";



GRANT ALL ON TABLE "public"."post_versions" TO "anon";
GRANT ALL ON TABLE "public"."post_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."post_versions" TO "service_role";



GRANT ALL ON TABLE "public"."posting_calendar_items" TO "anon";
GRANT ALL ON TABLE "public"."posting_calendar_items" TO "authenticated";
GRANT ALL ON TABLE "public"."posting_calendar_items" TO "service_role";



GRANT ALL ON TABLE "public"."posting_calendar_templates" TO "anon";
GRANT ALL ON TABLE "public"."posting_calendar_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."posting_calendar_templates" TO "service_role";



GRANT ALL ON TABLE "public"."posting_calendars" TO "anon";
GRANT ALL ON TABLE "public"."posting_calendars" TO "authenticated";
GRANT ALL ON TABLE "public"."posting_calendars" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."system_logs" TO "anon";
GRANT ALL ON TABLE "public"."system_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_logs" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."task_custom_field_values" TO "anon";
GRANT ALL ON TABLE "public"."task_custom_field_values" TO "authenticated";
GRANT ALL ON TABLE "public"."task_custom_field_values" TO "service_role";



GRANT ALL ON TABLE "public"."task_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."task_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."task_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."task_links" TO "anon";
GRANT ALL ON TABLE "public"."task_links" TO "authenticated";
GRANT ALL ON TABLE "public"."task_links" TO "service_role";



GRANT ALL ON TABLE "public"."task_state_changes" TO "anon";
GRANT ALL ON TABLE "public"."task_state_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."task_state_changes" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."timeline_events" TO "anon";
GRANT ALL ON TABLE "public"."timeline_events" TO "authenticated";
GRANT ALL ON TABLE "public"."timeline_events" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_definitions" TO "anon";
GRANT ALL ON TABLE "public"."workflow_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_definitions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Admins podem alterar logos"
  on "storage"."objects"
  as permissive
  for update
  to public
using ((bucket_id = 'logos'::text));



  create policy "Admins podem subir logos"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'logos'::text));



  create policy "Logos são públicas"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'logos'::text));



  create policy "posting_calendars_admin_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'posting-calendars'::text) AND public.is_admin()));



  create policy "posting_calendars_admin_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'posting-calendars'::text) AND public.is_admin()))
with check (((bucket_id = 'posting-calendars'::text) AND public.is_admin()));



  create policy "posting_calendars_admin_write"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'posting-calendars'::text) AND public.is_admin()));



  create policy "posting_calendars_public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'posting-calendars'::text));



  create policy "posting_calendars_storage_auth_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'posting-calendars'::text));



  create policy "posting_calendars_storage_auth_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'posting-calendars'::text));



  create policy "posting_calendars_storage_auth_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'posting-calendars'::text))
with check ((bucket_id = 'posting-calendars'::text));



  create policy "posting_calendars_storage_public_read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'posting-calendars'::text));



