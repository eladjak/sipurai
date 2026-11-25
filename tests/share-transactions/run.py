#!/usr/bin/env python3
"""Run only inside an isolated PID namespace: unshare --fork --pid --mount-proc python3 tests/share-transactions/run.py"""
import json
import subprocess, uuid, time
from pathlib import Path
name = 'sipurai-share-test-' + uuid.uuid4().hex[:12]
def run(*args, input=None, check=True):
    return subprocess.run(args, input=input, text=True, capture_output=True, check=check)
def sql(q, check=True):
    return run('docker','exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At',input=q,check=check)
try:
    run('docker','run','--rm','-d','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16-alpine')
    for _ in range(60):
        if run('docker','exec',name,'pg_isready','-U','postgres',check=False).returncode == 0: break
        time.sleep(.2)
    else: raise RuntimeError('postgres did not start')
    setup = '''CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE FUNCTION public.current_clerk_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.sub',true),'') $$;
''' + Path('scripts/setup-supabase-tables.sql').read_text() + '''
ALTER TABLE books ADD COLUMN is_public boolean NOT NULL DEFAULT false;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON books, community, comments TO authenticated, service_role;
GRANT SELECT ON community, comments TO anon;
ALTER TABLE books ENABLE ROW LEVEL SECURITY; ALTER TABLE community ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_books ON books TO authenticated USING (created_by = current_clerk_id()) WITH CHECK (created_by = current_clerk_id());
CREATE VIEW public.public_books AS SELECT id FROM books WHERE is_public;
GRANT SELECT ON public.public_books TO anon, authenticated;
CREATE POLICY owner_community ON community TO authenticated USING (created_by = current_clerk_id()) WITH CHECK (created_by = current_clerk_id());
CREATE POLICY public_community ON community FOR SELECT TO authenticated, anon USING (visibility = 'public');
CREATE POLICY owner_comments ON comments TO authenticated USING (created_by = current_clerk_id()) WITH CHECK (created_by = current_clerk_id());
CREATE POLICY public_comments ON comments FOR SELECT TO authenticated, anon USING (
  EXISTS (SELECT 1 FROM community WHERE community.id = comments.community_id AND community.visibility = 'public')
);
'''
    sql(setup)
    sql(Path('scripts/migrations/2026-11-25-community-book-privacy.sql').read_text())
    sql(Path('scripts/migrations/2026-11-25-sharing-transactions.sql').read_text())
    a='00000000-0000-0000-0000-000000000001'; b='00000000-0000-0000-0000-000000000002'
    sql(f"INSERT INTO books(id,created_by) VALUES ('{a}','owner'),('{b}','other');")
    def call(q, ok=True):
        r=sql(q,check=False)
        if (r.returncode==0) != ok: raise AssertionError((q,r.stdout,r.stderr))
        return r.stdout.strip()
    owner="SET ROLE authenticated; SET request.sub='owner'; "
    service="SET ROLE service_role; "
    listing="'{\"title\":\"hello\",\"description\":\"text\",\"tags\":[\"tag\"]}'::jsonb"
    pub=lambda expected, val=listing: f"SELECT sipurai_publish_book('{a}',{expected},{val});"
    def published(expected, listing_created, val=listing):
        assert json.loads(call(owner+pub(expected,val)).splitlines()[-1]) == {
            'is_public': True, 'listing_created': listing_created
        }
    for invalid in (
        {'title':'', 'description':'text', 'tags':[]},
        {'title':'title', 'description':'\t\n\u200b\ufeff', 'tags':[]},
        {'title':'title', 'description':'text', 'tags':{}},
        {'title':'title', 'description':'text', 'tags':[123]},
    ):
        malformed = "'" + json.dumps(invalid) + "'::jsonb"
        refused = sql(owner + pub('false', malformed), check=False)
        assert refused.returncode != 0 and 'sipurai_invalid_listing' in refused.stderr
    assert call(f"SELECT NOT is_public FROM books WHERE id='{a}';") == 't'
    assert call('SELECT count(*) FROM community;') == '0'
    published('false', True)
    published('true', False)
    assert call('SELECT count(*) FROM community;') == '1'
    call("SET ROLE anon; "+pub('true'),False)
    call("SET ROLE authenticated; SET request.sub='other'; "+pub('true'),False)
    call("SET ROLE authenticated; SELECT sipurai_unshare_book('"+a+"','owner');",False)
    call(service+f"SELECT sipurai_unshare_book('{a}','other');",False)
    assert call(service+f"SELECT sipurai_unshare_book('{a}','owner');").endswith('1')
    assert call(service+f"SELECT sipurai_unshare_book('{a}','owner');").endswith('0')
    call(owner+pub('true'),False)
    published('false', False, 'NULL')
    assert call('SELECT count(*) FROM community;') == '0'
    call(service+f"SELECT sipurai_unshare_book('{a}','owner');")
    sql(f"INSERT INTO community(id,book_id,created_by,user_id,visibility) VALUES ('10000000-0000-0000-0000-000000000001','{a}','owner',NULL,'public');")
    call(owner+pub('false','NULL'),False)
    call(owner+pub('false'),False)
    sql(f"UPDATE books SET is_public=true WHERE id='{a}';")
    published('true', False)
    assert call("SELECT count(*) FROM community WHERE id='10000000-0000-0000-0000-000000000001';") == '1'
    sql(f"INSERT INTO comments(created_by,community_id) VALUES ('other','10000000-0000-0000-0000-000000000001'); CREATE FUNCTION fail_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced'; END $$; CREATE TRIGGER fail_cleanup BEFORE DELETE ON comments FOR EACH ROW EXECUTE FUNCTION fail_cleanup();")
    call(service+f"SELECT sipurai_unshare_book('{a}','owner');",False)
    assert call(f"SELECT is_public AND (SELECT count(*)=1 FROM comments) AND (SELECT count(*)=1 FROM community) FROM books WHERE id='{a}';") == 't'
    sql('DROP TRIGGER fail_cleanup ON comments;')
    call(service+f"SELECT sipurai_unshare_book('{a}','owner');")
    sql("CREATE TRIGGER fail_insert BEFORE INSERT ON community FOR EACH ROW EXECUTE FUNCTION fail_cleanup();")
    call(owner+pub('false'),False)
    assert call(f"SELECT NOT is_public FROM books WHERE id='{a}';") == 't'
    sql('DROP TRIGGER fail_insert ON community;')
    call(owner+pub('false','NULL'))
    # Revoke holds the row lock; a publish request carrying its earlier public state must wait then fail.
    p=subprocess.Popen(['docker','exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    p.stdin.write(f"BEGIN; SET ROLE service_role; SELECT sipurai_unshare_book('{a}','owner'); SELECT pg_sleep(2); COMMIT;\n"); p.stdin.close()
    time.sleep(.4)
    start=time.monotonic(); call(owner+pub('true'),False)
    assert time.monotonic()-start > 1
    assert p.wait()==0
    # A publish holding the lock commits before the revoke; revoke then removes its listing.
    p=subprocess.Popen(['docker','exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    p.stdin.write(f"BEGIN; {owner} {pub('false')} SELECT pg_sleep(2); COMMIT;\n"); p.stdin.close()
    time.sleep(.4)
    start=time.monotonic(); assert call(service+f"SELECT sipurai_unshare_book('{a}','owner');").endswith('1')
    assert time.monotonic()-start > 1 and p.wait()==0
    assert call(f"SELECT NOT is_public AND (SELECT count(*)=0 FROM community WHERE book_id='{a}') FROM books WHERE id='{a}';") == 't'
    print('PASS: permissions, owner/stranger, legacy reuse, idempotence, link-only, stale, both rollback paths, ordered revoke/publish at READ COMMITTED')
    # A historical mismatched listing must not become public via link-only publish.
    sql(f"INSERT INTO community(book_id,created_by,user_id,visibility) VALUES ('{a}','other','other','public');")
    assert call(owner+f"SELECT count(*) FROM community WHERE book_id='{a}';").endswith('0')
    assert call("SET ROLE authenticated; SET request.sub='other'; "
                f"SELECT sipurai_private.book_has_listings('{a}');").endswith('f')
    call(owner+pub('false','NULL'),False)
    call(owner+pub('false'),False)
    assert call(f"SELECT NOT is_public FROM books WHERE id='{a}';") == 't'
    assert call(service+f"SELECT sipurai_unshare_book('{a}','owner');").endswith('1')
    call("SET ROLE authenticated; SET request.sub='other'; "
         f"INSERT INTO community(book_id,created_by) VALUES ('{a}','other');",False)
    published('false', False, 'NULL')
    assert call("SET ROLE anon; SELECT count(*) FROM public.community;").endswith('0')
    legacy = "SET ROLE authenticated; SET request.sub='other'; "
    call(legacy + f"INSERT INTO community(book_id,created_by,visibility) VALUES ('{b}','other','public');")
    assert call("SET ROLE anon; SELECT count(*) FROM public.community;").endswith('0')
    call(legacy + f"UPDATE books SET is_public=true WHERE id='{b}';")
    assert call("SET ROLE anon; SELECT count(*) FROM public.community;").endswith('1')
    print('PASS: inherited privacy RLS, historical foreign listing, and ownership on new listings')
    sql(Path('scripts/migrations/2026-11-25-sharing-transactions.rollback.sql').read_text())
    assert call("SELECT to_regproc('public.sipurai_publish_book') IS NULL;") == 't'
    assert call("SELECT to_regproc('public.sipurai_unshare_book') IS NULL;") == 't'
    assert call("SELECT to_regnamespace('sipurai_private') IS NULL;") == 't'
    assert call("SELECT count(*) FROM pg_policies WHERE policyname IN ('community_live_public_book_guard','comments_live_public_book_guard');") == '2'
    print('PASS: blank and malformed metadata rejected; rollback preserves SELECT privacy guards')
finally:
    run('docker','rm','-f',name,check=False)
