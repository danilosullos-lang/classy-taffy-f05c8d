\set ON_ERROR_STOP on

-- Integration test against a real PostgreSQL server. The test role is deliberately
-- neither a superuser nor the table owner, so FORCE ROW LEVEL SECURITY is exercised.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aetheria_ci_rls') THEN
    CREATE ROLE aetheria_ci_rls NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE aetheria_ci_rls NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO aetheria_ci_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON aetheria_characters TO aetheria_ci_rls;

INSERT INTO aetheria_users (id, email, password_hash)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'rls-user-one@example.invalid', 'ci-only-not-a-secret'),
  ('00000000-0000-4000-8000-000000000002', 'rls-user-two@example.invalid', 'ci-only-not-a-secret')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

DELETE FROM aetheria_characters
WHERE id IN (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);

INSERT INTO aetheria_characters
  (id, user_id, slot, name, race, class_id, level, map_id, revision)
VALUES
  ('10000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000001', 0, 'RlsUserOne', 'human', 'fighter', 10, 'talking_island', 1),
  ('10000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-000000000002', 0, 'RlsUserTwo', 'elf', 'archer', 12, 'talking_island', 1)
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id, slot = EXCLUDED.slot, name = EXCLUDED.name,
    race = EXCLUDED.race, class_id = EXCLUDED.class_id, level = EXCLUDED.level,
    map_id = EXCLUDED.map_id, revision = EXCLUDED.revision;

SET ROLE aetheria_ci_rls;

DO $rls_test$
DECLARE
  user_one CONSTANT UUID := '00000000-0000-4000-8000-000000000001';
  user_two CONSTANT UUID := '00000000-0000-4000-8000-000000000002';
  character_one CONSTANT UUID := '10000000-0000-4000-8000-000000000001';
  character_two CONSTANT UUID := '10000000-0000-4000-8000-000000000002';
  visible_rows INTEGER;
  affected_rows INTEGER;
  new_revision INTEGER;
  inserted_id UUID;
BEGIN
  -- Missing/empty transaction identity must expose no character rows.
  PERFORM set_config('app.user_id', '', true);
  SELECT count(*) INTO visible_rows FROM aetheria_characters;
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'RLS leaked % rows without an authenticated user', visible_rows;
  END IF;

  -- User one sees only its own row.
  PERFORM set_config('app.user_id', user_one::text, true);
  SELECT count(*) INTO visible_rows FROM aetheria_characters;
  IF visible_rows <> 1 THEN
    RAISE EXCEPTION 'user one expected 1 visible row, received %', visible_rows;
  END IF;
  SELECT count(*) INTO visible_rows
    FROM aetheria_characters WHERE user_id <> user_one;
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'user one can see another user character';
  END IF;

  -- A cross-user update is filtered by USING and changes no row.
  UPDATE aetheria_characters SET level = 80 WHERE id = character_two;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'cross-user update affected % rows', affected_rows;
  END IF;

  -- The same compare-and-swap predicate used by the API advances exactly once.
  UPDATE aetheria_characters
     SET revision = revision + 1, level = 11
   WHERE id = character_one AND user_id = user_one AND revision = 1
   RETURNING revision INTO new_revision;
  IF new_revision IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'expected revision 2 after current write, received %', new_revision;
  END IF;

  UPDATE aetheria_characters
     SET revision = revision + 1, level = 99
   WHERE id = character_one AND user_id = user_one AND revision = 1;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'stale revision update affected % rows', affected_rows;
  END IF;

  -- WITH CHECK must reject an insert that attempts to write for another user.
  BEGIN
    INSERT INTO aetheria_characters
      (user_id, slot, name, race, class_id, level, map_id)
    VALUES
      (user_two, 1, 'RlsWrongOwner', 'human', 'fighter', 1, 'talking_island');
    RAISE EXCEPTION 'RLS accepted an insert for another user';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  -- An occupied slot remains create-only and cannot create a second character.
  INSERT INTO aetheria_characters
    (user_id, slot, name, race, class_id, level, map_id)
  VALUES
    (user_one, 0, 'RlsDuplicateSlot', 'human', 'fighter', 1, 'talking_island')
  ON CONFLICT (user_id, slot) DO NOTHING
  RETURNING id INTO inserted_id;
  IF inserted_id IS NOT NULL THEN
    RAISE EXCEPTION 'occupied character slot unexpectedly created a row';
  END IF;

  -- User two can still see its own row, not user one's updated row.
  PERFORM set_config('app.user_id', user_two::text, true);
  SELECT count(*) INTO visible_rows FROM aetheria_characters;
  IF visible_rows <> 1 THEN
    RAISE EXCEPTION 'user two expected 1 visible row, received %', visible_rows;
  END IF;

  -- Clear the transaction-local identity before leaving this block.
  PERFORM set_config('app.user_id', '', true);
  SELECT count(*) INTO visible_rows FROM aetheria_characters;
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'clearing transaction identity left % rows visible', visible_rows;
  END IF;
END
$rls_test$;

-- set_config(..., true) must not leak the identity into the next transaction.
DO $scope_test$
DECLARE
  visible_rows INTEGER;
BEGIN
  SELECT count(*) INTO visible_rows FROM aetheria_characters;
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'transaction-local app.user_id leaked across statements';
  END IF;
END
$scope_test$;

RESET ROLE;

-- Keep the ephemeral CI database clean if the script is reused in the same job.
DELETE FROM aetheria_characters
WHERE id IN (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
DELETE FROM aetheria_users
WHERE id IN (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002'
);

\echo 'Aetheria PostgreSQL integration: RLS isolation, WITH CHECK, transaction-local scope, slot uniqueness and revision compare-and-swap passed.'
