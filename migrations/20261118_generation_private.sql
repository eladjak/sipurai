-- STAGED ONLY. Requires the postgres-owned default ACL verified separately.
-- No grants, revokes, role changes or alterations to existing access.
BEGIN;
SET LOCAL lock_timeout = '3s';
-- Fail closed on historical duplicate page numbers; do not modify existing data.
CREATE UNIQUE INDEX IF NOT EXISTS pages_generation_unique_number ON public.pages (book_id, page_number);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT
            1
        FROM
            pg_catalog.pg_index i
            JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid
            JOIN pg_catalog.pg_namespace ns ON ns.oid = idx.relnamespace
        WHERE
            ns.nspname = 'public'
            AND idx.relname = 'pages_generation_unique_number'
            AND i.indrelid = 'public.pages'::regclass
            AND i.indisunique
            AND i.indisvalid
            AND i.indisready
            AND i.indpred IS NULL
            AND i.indexprs IS NULL
            AND i.indnkeyatts = 2
            AND (
                SELECT
                    array_agg(a.attname::text ORDER BY k.ord)
                FROM
                    unnest(i.indkey)
                    WITH ORDINALITY k (attnum, ord)
                    JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid
                        AND a.attnum = k.attnum) = ARRAY['book_id', 'page_number']::text[]) THEN
            RAISE EXCEPTION 'invalid_unique_page_index';
END IF;
END
$$;
CREATE SCHEMA IF NOT EXISTS sipurai_generation_private;
DO $$
BEGIN
    IF (
        SELECT
            pg_catalog.pg_get_userbyid(nspowner)
        FROM
            pg_catalog.pg_namespace
        WHERE
            nspname = 'sipurai_generation_private') IS DISTINCT FROM CURRENT_USER THEN
        RAISE EXCEPTION 'private_schema_owner_mismatch';
    END IF;
    IF has_schema_privilege('anon', 'sipurai_generation_private', 'USAGE') OR has_schema_privilege('authenticated', 'sipurai_generation_private', 'USAGE') THEN
        RAISE EXCEPTION 'private_generation_schema_exposed';
    END IF;
END
$$;
CREATE TABLE sipurai_generation_private.checkpoints (
    book_id uuid PRIMARY KEY REFERENCES public.books (id) ON DELETE CASCADE,
    owner_id text NOT NULL,
    quota_key uuid NOT NULL CHECK (quota_key = book_id),
    quota_book_key text NOT NULL CHECK (quota_book_key = quota_key::text),
    FOREIGN KEY (owner_id, quota_book_key) REFERENCES public.book_quota_reservations (user_id, book_key) ON DELETE RESTRICT,
    seed jsonb NOT NULL,
    checkpoint jsonb,
    lease_run uuid,
    fence bigint NOT NULL DEFAULT 0,
    lease_expires timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);
-- Service-only transaction boundary. owner is supplied ONLY by verified backend.
-- Fixed search path, fully qualified data objects, no dynamic SQL. No client ACL changes.
CREATE OR REPLACE FUNCTION public.sipurai_generation_tx (p_action text, p_owner text, p_book uuid, p_run uuid, p_fence bigint DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
DECLARE
    c sipurai_generation_private.checkpoints%ROWTYPE;
    b public.books%ROWTYPE;
    fields jsonb;
    item jsonb;
    n integer;
    i integer;
    changed integer;
    result jsonb;
BEGIN
    IF current_setting('role', TRUE) IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'service_only'
            USING ERRCODE = '42501';
    END IF;
    IF p_owner IS NULL OR p_owner = '' OR p_book IS NULL OR p_run IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'invalid_request';
    END IF;
    -- Fresh book and seed are inserted in this same transaction, or neither exists.
    -- A conflict with any existing UUID is resolved only after explicit owner verification.
    IF p_action = 'acquire' AND p_payload ? 'createBook' THEN
        fields := p_payload -> 'createBook';
        IF jsonb_typeof(fields) IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload -> 'seed') IS DISTINCT FROM 'object' OR p_payload ->> 'newQuotaKey' IS NULL OR (p_payload ->> 'newQuotaKey')::uuid <> p_book OR jsonb_typeof(fields -> 'title') IS DISTINCT FROM 'string' OR coalesce((fields ->> 'total_pages')::integer, 0)
        NOT BETWEEN 1 AND 100 THEN
            RAISE EXCEPTION 'invalid_request';
        END IF;
        INSERT INTO public.books (id, created_by, title, description, moral, art_style, length, genre, age_range, language, child_name, child_age, child_gender, tone, interests, family_members, status, cover_image, total_pages, child_names, selected_characters, is_public, print_size, print_edition)
            VALUES (p_book, p_owner, fields ->> 'title', coalesce(fields ->> 'description', ''),coalesce(fields->>'moral',''), coalesce(fields ->> 'art_style', 'cartoon'), coalesce(fields ->> 'length', 'medium'), coalesce(fields ->> 'genre', ''),coalesce(fields->>'age_range',''), coalesce(fields ->> 'language', 'english'), coalesce(fields ->> 'child_name', ''),(fields->>'child_age')::integer,coalesce(fields->>'child_gender','neutral'),coalesce(fields->>'tone',''), coalesce(fields ->> 'interests', ''),coalesce(fields->>'family_members',''), 'generating', '', (fields ->> 'total_pages')::integer, coalesce(fields -> 'childNames', '[]'::jsonb), coalesce(fields -> 'selectedCharacters', '[]'::jsonb), FALSE, fields ->> 'print_size', fields -> 'printEdition')
        ON CONFLICT (id)
            DO NOTHING;
    END IF;
    SELECT
        *
    INTO
        b
    FROM
        public.books
    WHERE
        id = p_book
        AND created_by = p_owner
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'book_not_owned'
            USING ERRCODE = '42501';
    END IF;
    -- Match deletion order: book, reservation, checkpoint.
    IF p_action = 'acquire' AND p_payload ? 'newQuotaKey' THEN
        IF (p_payload ->> 'newQuotaKey') IS NULL OR (p_payload ->> 'newQuotaKey')::uuid <> p_book THEN
            RAISE EXCEPTION 'quota_key_mismatch';
        END IF;
        PERFORM
            1
        FROM
            public.book_quota_reservations q
        WHERE
            q.user_id = p_owner
            AND q.book_key = p_book::text
        FOR KEY SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'reservation_missing';
        END IF;
    END IF;
    SELECT
        *
    INTO
        c
    FROM
        sipurai_generation_private.checkpoints
    WHERE
        book_id = p_book
        AND owner_id = p_owner
    FOR UPDATE;
    IF p_action = 'acquire' THEN
        IF NOT FOUND THEN
            IF p_payload ->> 'newQuotaKey' IS NULL OR (p_payload ->> 'newQuotaKey')::uuid <> p_book THEN
                RAISE EXCEPTION 'provenance_missing';
            END IF;
            IF jsonb_typeof(p_payload -> 'seed') IS DISTINCT FROM 'object' THEN
                RAISE EXCEPTION 'seed_required';
            END IF;
            INSERT INTO sipurai_generation_private.checkpoints (book_id, owner_id, quota_key, quota_book_key, seed)
                VALUES (p_book, p_owner, p_book, p_book::text, p_payload -> 'seed')
            RETURNING
                *
            INTO
                c;
        ELSIF p_payload ? 'newQuotaKey'
                AND (p_payload ->> 'newQuotaKey')::uuid <> c.quota_key THEN
                RAISE EXCEPTION 'quota_key_mismatch';
        ELSIF p_payload ? 'seed'
                AND p_payload -> 'seed' IS DISTINCT FROM c.seed THEN
                RAISE EXCEPTION 'seed_immutable';
        END IF;
        -- Active retries with the same run keep the same fence.
        IF c.lease_expires > clock_timestamp() THEN
            IF c.lease_run IS DISTINCT FROM p_run THEN
                RAISE EXCEPTION 'lease_busy';
            END IF;
            RETURN jsonb_build_object('quotaKey', c.quota_key, 'fence', c.fence, 'expiresAt', c.lease_expires, 'seed', c.seed, 'checkpoint', c.checkpoint, 'book', to_jsonb (b));
        END IF;
        UPDATE
            sipurai_generation_private.checkpoints
        SET
            lease_run = p_run,
            fence = fence + 1,
            lease_expires = clock_timestamp() + interval '90 seconds',
            updated_at = clock_timestamp()
        WHERE
            book_id = p_book
        RETURNING
            *
        INTO
            c;
        RETURN jsonb_build_object('quotaKey', c.quota_key, 'fence', c.fence, 'expiresAt', c.lease_expires, 'seed', c.seed, 'checkpoint', c.checkpoint, 'book', to_jsonb (b));
    END IF;
    IF NOT FOUND OR c.lease_run IS DISTINCT FROM p_run OR c.fence IS DISTINCT FROM p_fence OR c.lease_expires IS NULL OR c.lease_expires <= clock_timestamp() THEN
        RAISE EXCEPTION 'lease_lost';
    END IF;
    IF p_action = 'renew' THEN
        UPDATE
            sipurai_generation_private.checkpoints
        SET
            lease_expires = clock_timestamp() + interval '90 seconds',
            updated_at = clock_timestamp()
        WHERE
            book_id = p_book
        RETURNING
            lease_expires
        INTO
            c.lease_expires;
        RETURN jsonb_build_object('expiresAt', c.lease_expires);
    ELSIF p_action = 'release' THEN
        UPDATE
            sipurai_generation_private.checkpoints
        SET
            lease_run = NULL,
            lease_expires = NULL,
            updated_at = clock_timestamp()
        WHERE
            book_id = p_book;
        RETURN jsonb_build_object('released', TRUE);
    ELSIF p_action = 'listRows' THEN
        SELECT
            coalesce(jsonb_agg(to_jsonb (p)
                ORDER BY p.page_number), '[]'::jsonb)
        INTO
            result
        FROM
            public.pages p
        WHERE
            p.book_id = p_book
            AND p.created_by = p_owner;
        RETURN result;
    ELSIF p_action = 'savePlan' THEN
        result := p_payload -> 'checkpoint';
        IF jsonb_typeof(result) IS DISTINCT FROM 'object' OR jsonb_typeof(result -> 'plan') IS DISTINCT FROM 'array' OR jsonb_typeof(result -> 'scenes') IS DISTINCT FROM 'array' OR jsonb_typeof(result -> 'cast') IS DISTINCT FROM 'array' OR jsonb_typeof(result -> 'manuscript') IS DISTINCT FROM 'array' OR jsonb_typeof(result -> 'recipe') IS DISTINCT FROM 'object' OR jsonb_typeof(result -> 'drawingPrompts') IS DISTINCT FROM 'array' OR result -> 'manuscriptSaved' IS DISTINCT FROM 'true'::jsonb THEN
            RAISE EXCEPTION 'invalid_checkpoint';
        END IF;
        n := jsonb_array_length(result -> 'plan');
        IF n < 1 OR n > 100 OR jsonb_array_length(result -> 'manuscript') <> n OR jsonb_array_length(result -> 'drawingPrompts') <> n THEN
            RAISE EXCEPTION 'invalid_checkpoint_length';
        END IF;
        IF jsonb_typeof(result -> 'recipe' -> 'bookData') IS DISTINCT FROM 'object'
           OR jsonb_typeof(result -> 'recipe' -> 'characters') IS DISTINCT FROM 'array'
           OR jsonb_typeof(result -> 'recipe' -> 'scenes') IS DISTINCT FROM 'array'
           OR jsonb_typeof(result -> 'recipe' -> 'pageCount') IS DISTINCT FROM 'number'
           OR (result -> 'recipe' ->> 'pageCount')::integer <> n THEN RAISE EXCEPTION 'invalid_checkpoint'; END IF;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(result -> 'cast') e WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'object')
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(result -> 'scenes') e WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'object')
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(result -> 'recipe' -> 'characters') e WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'object')
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(result -> 'recipe' -> 'scenes') e WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'object') THEN RAISE EXCEPTION 'invalid_checkpoint'; END IF;
        FOR i IN 0..n - 1 LOOP
            IF jsonb_typeof(result -> 'plan' -> i) IS DISTINCT FROM 'object'
               OR jsonb_typeof(result -> 'plan' -> i -> 'page_number') IS DISTINCT FROM 'number'
               OR (result -> 'plan' -> i ->> 'page_number')::integer IS DISTINCT FROM i
               OR jsonb_typeof(result -> 'plan' -> i -> 'description') IS DISTINCT FROM 'string'
               OR jsonb_typeof(result -> 'drawingPrompts' -> i) IS DISTINCT FROM 'string'
               OR length(btrim(result -> 'drawingPrompts' ->> i)) = 0 THEN RAISE EXCEPTION 'invalid_checkpoint'; END IF;
            item := result -> 'manuscript' -> i;
            IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR (item ->> 'page_number')::integer IS DISTINCT FROM i OR jsonb_typeof(item -> 'text_content') IS DISTINCT FROM 'string' OR length(btrim(item ->> 'text_content')) = 0 OR jsonb_typeof(item -> 'image_prompt') IS DISTINCT FROM 'string' OR jsonb_typeof(item -> 'layout_type') IS DISTINCT FROM 'string' THEN
                RAISE EXCEPTION 'invalid_checkpoint';
            END IF;
        END LOOP;
        IF result -> 'recipe' IS DISTINCT FROM c.seed -> 'recipe' OR result -> 'plan' IS DISTINCT FROM c.seed -> 'plan' THEN
            RAISE EXCEPTION 'seed_mismatch';
        END IF;
        IF c.checkpoint IS NOT NULL AND c.checkpoint IS DISTINCT FROM result THEN
            RAISE EXCEPTION 'checkpoint_immutable';
        END IF;
        IF b.status = 'complete' THEN
            IF c.checkpoint IS NULL THEN RAISE EXCEPTION 'book_complete'; END IF;
            RETURN jsonb_build_object('pages', n, 'checkpoint', c.checkpoint);
        END IF;
        IF EXISTS (
            SELECT
                1
            FROM
                public.pages
            WHERE
                book_id = p_book
                AND created_by IS DISTINCT FROM p_owner) THEN
        RAISE EXCEPTION 'page_owner_mismatch';
    END IF;
    IF EXISTS (
        SELECT
            1
        FROM
            public.pages
        WHERE
            book_id = p_book
        GROUP BY
            page_number
        HAVING
            count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate_page_numbers';
END IF;
    UPDATE
        sipurai_generation_private.checkpoints
    SET
        CHECKPOINT = result,
        updated_at = clock_timestamp()
    WHERE
        book_id = p_book;
    FOR i IN 0..n - 1 LOOP
        item := result -> 'manuscript' -> i;
        INSERT INTO public.pages (book_id, created_by, page_number, text_content, image_url, image_prompt, layout_type)
        SELECT
            p_book,
            p_owner,
            i,
            item ->> 'text_content',
            '',
            item ->> 'image_prompt',
            item ->> 'layout_type'
        WHERE
            NOT EXISTS (
                SELECT
                    1
                FROM
                    public.pages
                WHERE
                    book_id = p_book
                    AND page_number = i);
        -- Fill only blank generated fields; preserve existing text, image, prompt and layout.
        UPDATE
            public.pages
        SET
            text_content = CASE WHEN coalesce(text_content, '')='' THEN
                item ->> 'text_content'
            ELSE
                text_content
            END, image_prompt = CASE WHEN coalesce(image_prompt, '')='' THEN
                item ->> 'image_prompt'
            ELSE
                image_prompt
            END
            WHERE
                book_id = p_book
                AND created_by = p_owner
                AND page_number = i;
        GET DIAGNOSTICS changed = ROW_COUNT;
        IF changed <> 1 THEN RAISE EXCEPTION 'page_conflict'; END IF;
    END LOOP;
    IF c.lease_expires <= clock_timestamp() THEN
        RAISE EXCEPTION 'lease_lost';
    END IF;
    RETURN jsonb_build_object('pages', n, 'checkpoint', result);
ELSIF p_action = 'commitPages' THEN
    IF b.status = 'complete' THEN RAISE EXCEPTION 'book_complete'; END IF;
    IF c.checkpoint IS NULL THEN
        RAISE EXCEPTION 'checkpoint_missing';
    END IF;
    IF jsonb_typeof(p_payload -> 'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload -> 'items')
        NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'invalid_batch';
    END IF;
    n := 0;
    FOR item IN
    SELECT
        value
    FROM
        jsonb_array_elements(p_payload -> 'items')
        LOOP
            IF NOT (item ? 'id' AND item ? 'expected' AND item ? 'patch')
               OR jsonb_typeof(item -> 'expected') IS DISTINCT FROM 'object'
               OR NOT ((item -> 'expected') ?& ARRAY['text_content', 'image_url', 'image_prompt', 'layout_type'])
               OR (item -> 'expected') - ARRAY['text_content', 'image_url', 'image_prompt', 'layout_type'] <> '{}'::jsonb
               OR jsonb_typeof(item -> 'patch') IS DISTINCT FROM 'object'
               OR (item -> 'patch') - ARRAY['text_content', 'image_url', 'image_prompt', 'layout_type'] <> '{}'::jsonb
               OR EXISTS (SELECT 1 FROM jsonb_each(item -> 'expected') x WHERE jsonb_typeof(x.value) NOT IN ('string','null'))
               OR EXISTS (SELECT 1 FROM jsonb_each(item -> 'patch') x WHERE jsonb_typeof(x.value) NOT IN ('string','null')) THEN
                RAISE EXCEPTION 'invalid_page_patch';
            END IF;
            UPDATE
                public.pages
            SET
                text_content = CASE WHEN (item -> 'patch') ? 'text_content' THEN
                    item -> 'patch' ->> 'text_content'
                ELSE
                    text_content
                END,
                image_url = CASE WHEN (item -> 'patch') ? 'image_url' THEN
                    item -> 'patch' ->> 'image_url'
                ELSE
                    image_url
                END,
                image_prompt = CASE WHEN (item -> 'patch') ? 'image_prompt' THEN
                    item -> 'patch' ->> 'image_prompt'
                ELSE
                    image_prompt
                END,
                layout_type = CASE WHEN (item -> 'patch') ? 'layout_type' THEN
                    item -> 'patch' ->> 'layout_type'
                ELSE
                    layout_type
                END
            WHERE
                id = (item ->> 'id')::uuid
                AND book_id = p_book
                AND created_by = p_owner
                AND text_content IS NOT DISTINCT FROM item -> 'expected' ->> 'text_content'
                AND image_url IS NOT DISTINCT FROM item -> 'expected' ->> 'image_url'
                AND image_prompt IS NOT DISTINCT FROM item -> 'expected' ->> 'image_prompt'
                AND layout_type IS NOT DISTINCT FROM item -> 'expected' ->> 'layout_type';
            GET DIAGNOSTICS changed = ROW_COUNT;
            IF changed <> 1 THEN
                RAISE EXCEPTION 'page_conflict';
            END IF;
            n := n + 1;
        END LOOP;
    IF c.lease_expires <= clock_timestamp() THEN
        RAISE EXCEPTION 'lease_lost';
    END IF;
    RETURN jsonb_build_object('updated', n);
ELSIF p_action = 'bookWrite' THEN
    IF jsonb_typeof(p_payload -> 'expected') IS DISTINCT FROM 'object' OR NOT ((p_payload -> 'expected') ?& ARRAY['status', 'cover_image']) OR jsonb_typeof(p_payload -> 'patch') IS DISTINCT FROM 'object' OR (p_payload -> 'patch') - ARRAY['status', 'cover_image', 'total_pages'] <> '{}'::jsonb THEN
        RAISE EXCEPTION 'invalid_book_patch';
    END IF;
    IF (p_payload -> 'patch') ? 'status' AND (jsonb_typeof(p_payload -> 'patch' -> 'status') IS DISTINCT FROM 'string' OR (p_payload -> 'patch' ->> 'status')
NOT IN ('draft', 'generating', 'partial', 'complete', 'failed')) THEN
        RAISE EXCEPTION 'invalid_book_patch';
    END IF;
    IF (p_payload -> 'patch') ? 'cover_image' AND jsonb_typeof(p_payload -> 'patch' -> 'cover_image') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION 'invalid_book_patch';
    END IF;
    IF (p_payload -> 'patch') ? 'total_pages' AND (jsonb_typeof(p_payload -> 'patch' -> 'total_pages') IS DISTINCT FROM 'number' OR NOT ((p_payload -> 'expected') ? 'total_pages') OR (p_payload -> 'patch' ->> 'total_pages')::integer NOT BETWEEN 1 AND 100) THEN
        RAISE EXCEPTION 'invalid_book_patch';
    END IF;
    IF (p_payload -> 'patch') ? 'total_pages' AND c.checkpoint IS NOT NULL AND (p_payload -> 'patch' ->> 'total_pages')::integer <> jsonb_array_length(c.checkpoint -> 'plan') THEN
        RAISE EXCEPTION 'invalid_book_patch';
    END IF;
    -- Reopening is an explicit status-only transition; repair writes come later.
    IF b.status = 'complete' AND (p_payload -> 'patch' ->> 'status') IN ('partial','generating','failed')
       AND (p_payload -> 'patch') - 'status' <> '{}'::jsonb THEN RAISE EXCEPTION 'invalid_book_patch'; END IF;
    IF coalesce(p_payload -> 'patch' ->> 'status', b.status) = 'complete' THEN
        -- Freeze existing rows for this book during the completion snapshot.
        -- The live pages table has no book FK; concurrent inserts remain possible.
        PERFORM pg_catalog.set_config('lock_timeout', '3s', true);
        PERFORM 1 FROM public.pages WHERE book_id=p_book ORDER BY page_number, id FOR UPDATE;
        n := coalesce((p_payload -> 'patch' ->> 'total_pages')::integer, b.total_pages);
        -- One statement uses one snapshot for both count and validity.
        SELECT count(*), count(*) FILTER (WHERE created_by IS DISTINCT FROM p_owner
            OR page_number IS NULL OR page_number < 0 OR page_number >= n
            OR nullif(btrim(coalesce(text_content,'')), '') IS NULL
            OR nullif(btrim(coalesce(image_url,'')), '') IS NULL
            OR coalesce(image_prompt,'') LIKE '[Image generation failed] %')
          INTO changed, i FROM public.pages WHERE book_id=p_book;
        IF c.checkpoint IS NULL OR n IS DISTINCT FROM jsonb_array_length(c.checkpoint -> 'plan')
           OR nullif(btrim(coalesce(CASE WHEN (p_payload -> 'patch') ? 'cover_image'
               THEN p_payload -> 'patch' ->> 'cover_image' ELSE b.cover_image END, '')), '') IS NULL
           OR changed <> n OR i <> 0 THEN
            RAISE EXCEPTION 'book_incomplete';
        END IF;
    END IF;
    UPDATE
        public.books
    SET
        total_pages = CASE WHEN (p_payload -> 'patch') ? 'total_pages' THEN
            (p_payload -> 'patch' ->> 'total_pages')::integer
        ELSE
            total_pages
        END,
        status = CASE WHEN (p_payload -> 'patch') ? 'status' THEN
            p_payload -> 'patch' ->> 'status'
        ELSE
            status
        END,
        cover_image = CASE WHEN (p_payload -> 'patch') ? 'cover_image' THEN
            p_payload -> 'patch' ->> 'cover_image'
        ELSE
            cover_image
        END
    WHERE
        id = p_book
        AND created_by = p_owner
        AND status IS NOT DISTINCT FROM p_payload -> 'expected' ->> 'status'
        AND cover_image IS NOT DISTINCT FROM p_payload -> 'expected' ->> 'cover_image'
        AND (NOT ((p_payload -> 'patch') ? 'total_pages')
            OR total_pages IS NOT DISTINCT FROM (p_payload -> 'expected' ->> 'total_pages')::integer);
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN
        RAISE EXCEPTION 'book_conflict';
    END IF;
    IF c.lease_expires <= clock_timestamp() THEN
        RAISE EXCEPTION 'lease_lost';
    END IF;
    RETURN jsonb_build_object('updated', TRUE);
END IF;
    RAISE EXCEPTION 'invalid_action';
END
$$;
COMMIT;
