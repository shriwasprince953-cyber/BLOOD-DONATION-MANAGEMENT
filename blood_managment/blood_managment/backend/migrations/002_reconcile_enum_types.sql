
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Prevent data changes between validation and conversion.
LOCK TABLE public.profiles, public.donors, public.blood_requirements,
    public.donation_responses, public.notifications IN ACCESS EXCLUSIVE MODE;

DO $migration$
DECLARE
    spec record;
    target_oid oid;
    target_kind "char";
    existing_labels text[];
    label_sql text;
    source_oid oid;
    source_kind "char";
    default_sql text;
    conversion_sql text;
    default_conversion_sql text;
    invalid_value text;
    blood_conversion_template constant text := $expr$
        CASE (%s)::text
            WHEN 'A_POS' THEN 'A+' WHEN 'A_NEG' THEN 'A-'
            WHEN 'B_POS' THEN 'B+' WHEN 'B_NEG' THEN 'B-'
            WHEN 'AB_POS' THEN 'AB+' WHEN 'AB_NEG' THEN 'AB-'
            WHEN 'O_POS' THEN 'O+' WHEN 'O_NEG' THEN 'O-'
            ELSE (%s)::text
        END
    $expr$;
BEGIN
    FOR spec IN
        SELECT * FROM (VALUES
            ('profiles', 'role', 'user_role', ARRAY['DONOR', 'ADMIN']),
            ('donors', 'blood_group', 'blood_group', ARRAY['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
            ('blood_requirements', 'blood_group', 'blood_group', ARRAY['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
            ('blood_requirements', 'urgency_level', 'urgency_level', ARRAY['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
            ('blood_requirements', 'status', 'requirement_status', ARRAY['OPEN', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED']),
            ('donation_responses', 'status', 'response_status', ARRAY['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'NO_SHOW']),
            ('notifications', 'channel', 'notification_channel', ARRAY['IN_APP', 'SMS', 'EMAIL']),
            ('notifications', 'status', 'notification_status', ARRAY['QUEUED', 'SENT', 'FAILED'])
        ) AS expected(table_name, column_name, type_name, labels)
    LOOP
        SELECT a.atttypid, t.typtype, pg_get_expr(d.adbin, d.adrelid)
        INTO source_oid, source_kind, default_sql
        FROM pg_attribute a
        JOIN pg_type t ON t.oid = a.atttypid
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = to_regclass(format('public.%I', spec.table_name))
          AND a.attname = spec.column_name AND a.attnum > 0 AND NOT a.attisdropped;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Missing public.%.%; restore the missing column before retrying.',
                spec.table_name, spec.column_name;
        END IF;
        IF source_kind <> 'e' AND source_oid NOT IN ('text'::regtype, 'varchar'::regtype) THEN
            RAISE EXCEPTION 'Unexpected source type % on public.%.%',
                source_oid::regtype, spec.table_name, spec.column_name;
        END IF;

        SELECT t.oid, t.typtype INTO target_oid, target_kind
        FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = spec.type_name;

        IF NOT FOUND THEN
            SELECT string_agg(quote_literal(label), ', ' ORDER BY position)
            INTO label_sql FROM unnest(spec.labels) WITH ORDINALITY AS x(label, position);
            EXECUTE format('CREATE TYPE public.%I AS ENUM (%s)', spec.type_name, label_sql);
            target_oid := to_regtype(format('public.%I', spec.type_name));
        ELSE
            SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
            INTO existing_labels FROM pg_enum e WHERE e.enumtypid = target_oid;
            IF target_kind <> 'e' OR existing_labels IS DISTINCT FROM spec.labels THEN
                RAISE EXCEPTION 'public.% has unexpected labels %. Expected %. No changes committed.',
                    spec.type_name, existing_labels, spec.labels;
            END IF;
        END IF;

        -- Already repaired columns require no rewrite (safe to rerun).
        IF source_oid = target_oid THEN
            CONTINUE;
        END IF;

        conversion_sql := format('%I::text', spec.column_name);
        IF spec.type_name = 'blood_group' THEN
            conversion_sql := format(blood_conversion_template,
                quote_ident(spec.column_name), quote_ident(spec.column_name));
        END IF;

        EXECUTE format(
            'SELECT %I::text FROM public.%I WHERE (%s) <> ALL ($1) LIMIT 1',
            spec.column_name, spec.table_name, conversion_sql
        ) INTO invalid_value USING spec.labels;
        IF invalid_value IS NOT NULL THEN
            RAISE EXCEPTION 'Unsupported value % in public.%.%; no changes committed.',
                invalid_value, spec.table_name, spec.column_name;
        END IF;

        -- USING does not convert a column's default. Preserve and cast it separately.
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT',
            spec.table_name, spec.column_name);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE public.%I USING ((%s)::public.%I)',
            spec.table_name, spec.column_name, spec.type_name, conversion_sql, spec.type_name);

        IF default_sql IS NOT NULL THEN
            default_conversion_sql := format('(%s)::text', default_sql);
            IF spec.type_name = 'blood_group' THEN
                default_conversion_sql := format(blood_conversion_template, default_sql, default_sql);
            END IF;
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT ((%s)::public.%I)',
                spec.table_name, spec.column_name, default_conversion_sql, spec.type_name);
        END IF;
    END LOOP;
END
$migration$;

-- Successful execution returns eight rows, all with status OK.
SELECT expected.table_name, expected.column_name, c.udt_name AS actual_type,
       CASE WHEN c.udt_schema = 'public' AND c.udt_name = expected.type_name
            THEN 'OK' ELSE 'MISMATCH' END AS status
FROM (VALUES
    ('profiles', 'role', 'user_role'),
    ('donors', 'blood_group', 'blood_group'),
    ('blood_requirements', 'blood_group', 'blood_group'),
    ('blood_requirements', 'urgency_level', 'urgency_level'),
    ('blood_requirements', 'status', 'requirement_status'),
    ('donation_responses', 'status', 'response_status'),
    ('notifications', 'channel', 'notification_channel'),
    ('notifications', 'status', 'notification_status')
) AS expected(table_name, column_name, type_name)
LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = expected.table_name
    AND c.column_name = expected.column_name
ORDER BY expected.table_name, expected.column_name;

COMMIT;
