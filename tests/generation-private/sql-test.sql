-- Isolated PostgreSQL integration test; all test values synthetic.
SET ROLE service_role;
DO $$ DECLARE v jsonb; f bigint; f2 bigint; bid uuid:='11111111-1111-4111-8111-111111111111'; r uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; r2 uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; ck jsonb; pgid uuid; BEGIN
 BEGIN PERFORM public.sipurai_generation_tx('acquire','stranger',bid,r,null,'{}'); RAISE EXCEPTION 'cross owner allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.sipurai_generation_tx('acquire','owner',bid,r,null,'{}'); RAISE EXCEPTION 'legacy silently accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'provenance_missing' THEN RAISE; END IF; END;
 v:=public.sipurai_generation_tx('acquire','owner',bid,r,null,jsonb_build_object('newQuotaKey',bid,'seed','{"recipe":{"bookData":{},"characters":[],"scenes":[],"pageCount":2},"plan":[{"page_number":0,"description":"a"},{"page_number":1,"description":"b"}]}'::jsonb)); f:=(v->>'fence')::bigint;
 v:=public.sipurai_generation_tx('acquire','owner',bid,r,null,'{}'); IF (v->>'fence')::bigint<>f THEN RAISE EXCEPTION 'same run retry changed fence'; END IF;
 BEGIN PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,r,f,'{"expected":{"status":"draft","cover_image":""},"patch":{"status":"complete","cover_image":"x"}}'); RAISE EXCEPTION 'incomplete accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'book_incomplete' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sipurai_generation_tx('acquire','owner',bid,r2,null,'{}'); RAISE EXCEPTION 'lease not exclusive'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'lease_busy' THEN RAISE; END IF; END;
 ck:='{"recipe":{"bookData":{},"characters":[],"scenes":[],"pageCount":2},"drawingPrompts":["a","b"],"manuscriptSaved":true,"plan":[{"page_number":0,"description":"a"},{"page_number":1,"description":"b"}],"scenes":[],"cast":[],"manuscript":[{"page_number":0,"text_content":"edited 0","image_prompt":"prompt 0","layout_type":"cover"},{"page_number":1,"text_content":"edited 1","image_prompt":"prompt 1","layout_type":"standard"}]}'::jsonb;
 BEGIN PERFORM public.sipurai_generation_tx('savePlan','owner',bid,r,f,jsonb_build_object('checkpoint',jsonb_set(ck,'{manuscript,0,text_content}',to_jsonb(E'\t\n'::text)))); RAISE EXCEPTION 'blank text accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_checkpoint' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sipurai_generation_tx('savePlan','owner',bid,r,f,jsonb_build_object('checkpoint',jsonb_set(ck,'{plan,0}','null'::jsonb))); RAISE EXCEPTION 'bad checkpoint accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_checkpoint' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sipurai_generation_tx('savePlan','owner',bid,r,f,jsonb_build_object('checkpoint',jsonb_set(ck,'{plan,0,description}',to_jsonb('different'::text)))); RAISE EXCEPTION 'seed mismatch accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'seed_mismatch' THEN RAISE; END IF; END;
 PERFORM public.sipurai_generation_tx('savePlan','owner',bid,r,f,jsonb_build_object('checkpoint',ck));
 PERFORM public.sipurai_generation_tx('savePlan','owner',bid,r,f,jsonb_build_object('checkpoint',ck));
 v:=public.sipurai_generation_tx('listRows','owner',bid,r,f,'{}'); IF jsonb_array_length(v)<>2 OR v->0->>'text_content'<>'edited 0' THEN RAISE EXCEPTION 'skeleton failure'; END IF;
 pgid:=(v->0->>'id')::uuid;
 BEGIN PERFORM public.sipurai_generation_tx('commitPages','owner',bid,r,f,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',pgid,'expected',jsonb_build_array('text_content','image_url','image_prompt','layout_type'),'patch',jsonb_build_object('image_url','bad'))))); RAISE EXCEPTION 'array expected accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_page_patch' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sipurai_generation_tx('commitPages','owner',bid,r,f,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',pgid,'expected',jsonb_build_object('text_content','edited 0','image_url','','image_prompt','prompt 0','layout_type','cover'),'patch',jsonb_build_object('image_url',false))))); RAISE EXCEPTION 'boolean patch accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_page_patch' THEN RAISE; END IF; END;
 -- Parent edit after read must win; stale worker cannot overwrite it.
 UPDATE public.pages SET text_content='parent edit' WHERE id=pgid;
 BEGIN PERFORM public.sipurai_generation_tx('commitPages','owner',bid,r,f,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',pgid,'expected',jsonb_build_object('text_content','edited 0','image_url','','image_prompt','prompt 0','layout_type','cover'),'patch',jsonb_build_object('text_content','bad'))))); RAISE EXCEPTION 'stale write allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'page_conflict' THEN RAISE; END IF; END;
 IF (SELECT text_content FROM public.pages WHERE id=pgid)<>'parent edit' THEN RAISE EXCEPTION 'parent edit lost'; END IF;
 -- Entire batch rolls back if second item conflicts.
 BEGIN PERFORM public.sipurai_generation_tx('commitPages','owner',bid,r,f,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',pgid,'expected',jsonb_build_object('text_content','parent edit','image_url','','image_prompt','prompt 0','layout_type','cover'),'patch',jsonb_build_object('image_url','local')),jsonb_build_object('id',pgid,'expected',jsonb_build_object('text_content','stale','image_url','','image_prompt','prompt 0','layout_type','cover'),'patch',jsonb_build_object('image_url','bad'))))); RAISE EXCEPTION 'batch accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'page_conflict' THEN RAISE; END IF; END;
 IF (SELECT image_url FROM public.pages WHERE id=pgid)<>'' THEN RAISE EXCEPTION 'batch not atomic'; END IF;
 BEGIN PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,r,f,'{"expected":{"status":"draft","cover_image":""},"patch":{"status":"complete","cover_image":"x"}}'); RAISE EXCEPTION 'missing art accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'book_incomplete' THEN RAISE; END IF; END;
 UPDATE public.pages SET image_url='local image' WHERE book_id=bid;
 BEGIN PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,r,f,jsonb_build_object('expected',jsonb_build_object('status','draft','cover_image',''),'patch',jsonb_build_object('status','complete','cover_image',E'\t\n'))); RAISE EXCEPTION 'blank cover accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'book_incomplete' THEN RAISE; END IF; END;
 UPDATE public.pages SET image_url=E'\t\n' WHERE id=pgid;
 BEGIN PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,r,f,'{"expected":{"status":"draft","cover_image":""},"patch":{"status":"complete","cover_image":"x"}}'); RAISE EXCEPTION 'blank image accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'book_incomplete' THEN RAISE; END IF; END;
 UPDATE public.pages SET image_url='local image' WHERE id=pgid;
 PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,r,f,'{"expected":{"status":"draft","cover_image":""},"patch":{"status":"complete","cover_image":"x"}}');
 IF (SELECT status FROM public.books WHERE id=bid)<>'complete' THEN RAISE EXCEPTION 'complete rejected'; END IF;
 UPDATE public.pages SET image_prompt='' WHERE id=pgid;
 PERFORM public.sipurai_generation_tx('savePlan','owner',bid,r,f,jsonb_build_object('checkpoint',ck));
 IF (SELECT image_prompt FROM public.pages WHERE id=pgid)<>'' THEN RAISE EXCEPTION 'complete savePlan retry mutated page'; END IF;
 BEGIN PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,r,f,'{"expected":{"status":"complete","cover_image":"x"},"patch":{"cover_image":""}}'); RAISE EXCEPTION 'complete cover cleared'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'book_incomplete' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sipurai_generation_tx('commitPages','owner',bid,r,f,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',pgid,'expected',jsonb_build_object('text_content','parent edit','image_url','local image','image_prompt','','layout_type','cover'),'patch',jsonb_build_object('image_url',''))))); RAISE EXCEPTION 'complete page cleared'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'book_complete' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,r,f,'{"expected":{"status":"complete","cover_image":"x"},"patch":{"status":"draft","cover_image":""}}'); RAISE EXCEPTION 'implicit draft accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_book_patch' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,r,f,'{"expected":{"status":"complete","cover_image":"x"},"patch":{"status":"partial","cover_image":""}}'); RAISE EXCEPTION 'implicit repair accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_book_patch' THEN RAISE; END IF; END;
 PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,r,f,'{"expected":{"status":"complete","cover_image":"x"},"patch":{"status":"partial"}}');
 PERFORM public.sipurai_generation_tx('release','owner',bid,r,f,'{}');
 v:=public.sipurai_generation_tx('acquire','owner',bid,r2,null,'{}');f2:=(v->>'fence')::bigint;
 IF f2<=f OR v->'checkpoint' IS DISTINCT FROM ck THEN RAISE EXCEPTION 'checkpoint/fence failure'; END IF;
 BEGIN PERFORM public.sipurai_generation_tx('renew','owner',bid,r,f,'{}'); RAISE EXCEPTION 'stale lease renewed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'lease_lost' THEN RAISE; END IF; END;
END $$;
DO $$ DECLARE v jsonb; bid uuid:='33333333-3333-4333-8333-333333333333'; BEGIN
 BEGIN PERFORM public.sipurai_generation_tx('acquire','owner','44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,'{"newQuotaKey":"44444444-4444-4444-8444-444444444444","seed":{},"createBook":{"title":"x","total_pages":2}}'); RAISE EXCEPTION 'missing reservation accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'reservation_missing' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.books WHERE id='44444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'unreserved stub created'; END IF;
 BEGIN PERFORM public.sipurai_generation_tx('acquire','stranger',bid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,jsonb_build_object('newQuotaKey',bid,'seed','{}'::jsonb,'createBook',jsonb_build_object('title','x','total_pages',2))); RAISE EXCEPTION 'another owner reservation accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'reservation_missing' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sipurai_generation_tx('acquire','owner',bid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,jsonb_build_object('newQuotaKey',bid,'createBook',jsonb_build_object('title','test','total_pages',2))); RAISE EXCEPTION 'missing seed accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_request' THEN RAISE; END IF; END;
 IF EXISTS (SELECT 1 FROM public.books WHERE id=bid) THEN RAISE EXCEPTION 'stub created'; END IF;
 v:=public.sipurai_generation_tx('acquire','owner',bid,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,jsonb_build_object('newQuotaKey',bid,'seed','{"recipe":{"bookData":{},"characters":[],"scenes":[],"pageCount":2},"plan":[{"page_number":0,"description":"a"},{"page_number":1,"description":"b"}]}'::jsonb,'createBook',jsonb_build_object('title','family title','total_pages',2,'created_by','stranger','is_public',true,'status','complete')));
 IF v->'book'->>'created_by'<>'owner' OR (v->'book'->>'is_public')::boolean OR v->'book'->>'status'<>'generating' OR v->'book'->>'title'<>'family title' THEN RAISE EXCEPTION 'unsafe atomic create'; END IF;
END $$;
DO $$ DECLARE bid uuid:='33333333-3333-4333-8333-333333333333'; run uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; ck jsonb; v jsonb; BEGIN
 INSERT INTO public.pages(book_id,created_by,page_number,text_content,image_url,image_prompt,layout_type) VALUES(bid,'owner',0,'parent text','parent image','parent prompt','parent layout');
 ck:='{"recipe":{"bookData":{},"characters":[],"scenes":[],"pageCount":2},"drawingPrompts":["a","b"],"manuscriptSaved":true,"plan":[{"page_number":0,"description":"a"},{"page_number":1,"description":"b"}],"scenes":[],"cast":[],"manuscript":[{"page_number":0,"text_content":"edited 0","image_prompt":"new prompt","layout_type":"cover"},{"page_number":1,"text_content":"edited 1","image_prompt":"prompt 1","layout_type":"standard"}]}'::jsonb;
 PERFORM public.sipurai_generation_tx('savePlan','owner',bid,run,1,jsonb_build_object('checkpoint',ck));
 PERFORM public.sipurai_generation_tx('savePlan','owner',bid,run,1,jsonb_build_object('checkpoint',ck));
 v:=public.sipurai_generation_tx('listRows','owner',bid,run,1,'{}');
 IF jsonb_array_length(v)<>2 OR v->0->>'text_content'<>'parent text' OR v->0->>'image_url'<>'parent image' OR v->0->>'image_prompt'<>'parent prompt' OR v->0->>'layout_type'<>'parent layout' OR v->1->>'text_content'<>'edited 1' THEN RAISE EXCEPTION 'existing edit lost or skeleton duplicate'; END IF;
 PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,run,1,'{"expected":{"status":"generating","cover_image":""},"patch":{"status":"partial"}}');
 BEGIN PERFORM public.sipurai_generation_tx('bookWrite','owner',bid,run,1,'{"expected":{"status":"generating","cover_image":""},"patch":{"status":"failed"}}'); RAISE EXCEPTION 'book conflict missed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'book_conflict' THEN RAISE; END IF; END;
END $$;
DO $$ DECLARE bid uuid:='55555555-5555-4555-8555-555555555555'; run uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; ck jsonb; BEGIN
 PERFORM public.sipurai_generation_tx('acquire','owner',bid,run,NULL,jsonb_build_object('newQuotaKey',bid,'seed','{"recipe":{"bookData":{},"characters":[],"scenes":[],"pageCount":1},"plan":[{"page_number":0,"description":"a"}]}'::jsonb,'createBook',jsonb_build_object('title','test','total_pages',1)));
 INSERT INTO public.pages(book_id,created_by,page_number,text_content,image_url,image_prompt,layout_type) VALUES(bid,'stranger',0,'other','','','standard');
 ck:='{"recipe":{"bookData":{},"characters":[],"scenes":[],"pageCount":1},"drawingPrompts":["a"],"manuscriptSaved":true,"plan":[{"page_number":0,"description":"a"}],"scenes":[],"cast":[],"manuscript":[{"page_number":0,"text_content":"text","image_prompt":"prompt","layout_type":"cover"}]}'::jsonb;
 BEGIN PERFORM public.sipurai_generation_tx('savePlan','owner',bid,run,1,jsonb_build_object('checkpoint',ck)); RAISE EXCEPTION 'mismatched page accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'page_owner_mismatch' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 BEGIN DELETE FROM public.book_quota_reservations WHERE user_id='owner' AND book_key='11111111-1111-4111-8111-111111111111'; RAISE EXCEPTION 'reservation deletion accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
UPDATE sipurai_generation_private.checkpoints SET lease_expires=clock_timestamp()-interval '1 second' WHERE book_id='11111111-1111-4111-8111-111111111111';
SET ROLE service_role;
DO $$ DECLARE v jsonb; BEGIN
 v:=public.sipurai_generation_tx('acquire','owner','11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',NULL,'{}');
 IF (v->>'fence')::int<>3 THEN RAISE EXCEPTION 'expiry takeover failed'; END IF;
 BEGIN PERFORM public.sipurai_generation_tx('renew','owner','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,'{}'); RAISE EXCEPTION 'expired fence survived'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'lease_lost' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.sipurai_generation_tx('listRows','owner','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'{}'); RAISE EXCEPTION 'client RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM <> 'service_only' THEN RAISE; END IF; END;
 BEGIN PERFORM * FROM sipurai_generation_private.checkpoints; RAISE EXCEPTION 'private table readable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.sipurai_generation_tx('listRows','owner','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'{}'); RAISE EXCEPTION 'anon RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM <> 'service_only' THEN RAISE; END IF; END;
 BEGIN PERFORM * FROM sipurai_generation_private.checkpoints; RAISE EXCEPTION 'anon private table readable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM sipurai_generation_private.checkpoints)<>3 THEN RAISE EXCEPTION 'missing checkpoint'; END IF; DELETE FROM public.books WHERE id IN ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555'); IF EXISTS(SELECT 1 FROM sipurai_generation_private.checkpoints) THEN RAISE EXCEPTION 'cascade failed'; END IF; DELETE FROM public.book_quota_reservations WHERE user_id='owner' AND book_key='11111111-1111-4111-8111-111111111111'; IF EXISTS(SELECT 1 FROM public.book_quota_reservations WHERE user_id='owner' AND book_key='11111111-1111-4111-8111-111111111111') THEN RAISE EXCEPTION 'quota deletion blocked after book removal'; END IF; END $$;
