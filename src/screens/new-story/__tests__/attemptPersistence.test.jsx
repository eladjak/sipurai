import React from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, renderHook, waitFor} from '@testing-library/react';
const mocks=vi.hoisted(()=>({owner:'user-a', filter:vi.fn(), reserve:vi.fn(), generate:vi.fn(), key:vi.fn()}));
vi.mock('@/hooks/useCurrentUser',()=>({useCurrentUser:()=>({user:{id:mocks.owner}})}));
vi.mock('@/entities/Book',()=>({Book:{generationStore:{},filter:mocks.filter}}));
vi.mock('@/entities/Page',()=>({Page:{}}));
vi.mock('@/integrations/Core',()=>({InvokeLLM:vi.fn(),GenerateImage:vi.fn()}));
vi.mock('@/lib/bookQuota',()=>({newBookKey:mocks.key,reserveBookSlot:mocks.reserve,clearActiveBookKey:vi.fn(),QuotaError:class extends Error {}}));
vi.mock('@/lib/bookGeneration',()=>({generateBookIncremental:mocks.generate}));
import {useNewStory,newStoryStorageKey} from '../useNewStory';
const id='11111111-1111-4111-8111-111111111111';
beforeEach(()=>{localStorage.clear();mocks.owner='user-a';mocks.key.mockReset().mockReturnValue('11111111-1111-4111-8111-111111111111');mocks.filter.mockReset().mockResolvedValue([]);mocks.reserve.mockReset().mockImplementation(()=>new Promise(()=>{}));mocks.generate.mockReset();});
describe('private resumable attempts',()=>{
 it('persists an attempt before reserve and reuses it after reload without automatic reserve',async()=>{
  const first=renderHook(()=>useNewStory('english','leave'));
  act(()=>{first.result.current.setHero({id:'h',name:'Maya'});first.result.current.setTopic('Forest');first.result.current.setStep(2)});
  act(()=>{first.result.current.start()});
  expect(JSON.parse(localStorage.getItem(newStoryStorageKey('user-a'))).attemptId).toBe(id);
  expect(mocks.reserve).toHaveBeenCalledWith(id);
  first.unmount();mocks.reserve.mockClear();
  const second=renderHook(()=>useNewStory('english','leave'));
  expect(second.result.current.topic).toBe('Forest');
  expect(mocks.reserve).not.toHaveBeenCalled();
  await act(async()=>{void second.result.current.start();await Promise.resolve()});
  await waitFor(()=>expect(mocks.reserve).toHaveBeenCalledWith(id));
 });
 it('resumes an existing owned book without a fresh quota request or outline',async()=>{
  localStorage.setItem(newStoryStorageKey('user-a'),JSON.stringify({step:2,hero:{id:'h',name:'Maya'},topic:'Forest',attemptId:id}));
  mocks.filter.mockResolvedValue([{id,created_by:'user-a'}]);mocks.generate.mockResolvedValue({bookId:id,status:'partial'});
  const {result}=renderHook(()=>useNewStory('english','leave'));
  await act(async()=>{await result.current.start()});
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.generate.mock.calls[0][0].bookId).toBe(id);
  expect(result.current.state).toBe('partial');
 });
 it('does not show account A draft to account B',()=>{
  localStorage.setItem(newStoryStorageKey('user-a'),JSON.stringify({hero:{id:'h',name:'Private A'},topic:'Secret'}));
  mocks.owner='user-b';const {result}=renderHook(()=>useNewStory('english','leave'));
  expect(result.current.topic).toBe('');expect(result.current.hero).toBeNull();
  expect(localStorage.getItem(newStoryStorageKey('user-a'))).toContain('Secret');
 });
 it('never reserves when checking the previous attempt fails',async()=>{
  localStorage.setItem(newStoryStorageKey('user-a'),JSON.stringify({step:2,hero:{id:'h',name:'Maya'},topic:'Forest',attemptId:id}));
  mocks.filter.mockRejectedValue(Error('offline'));
  const {result}=renderHook(()=>useNewStory('english','leave'));
  await act(async()=>{await result.current.start()});
  expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.generate).not.toHaveBeenCalled();expect(result.current.state).toBe('failed');
 });
 it('clears the visible draft when the active account changes',()=>{
  localStorage.setItem(newStoryStorageKey('user-a'),JSON.stringify({hero:{id:'h',name:'Private A'},topic:'Secret'}));
  const {result,rerender}=renderHook(()=>useNewStory('english','leave'));
  expect(result.current.topic).toBe('Secret');mocks.owner='user-b';rerender();
  expect(result.current.topic).toBe('');expect(result.current.hero).toBeNull();
 });

 it('keeps completed draft data but gives a later explicit new story a fresh key',async()=>{
  const next='22222222-2222-4222-8222-222222222222';mocks.key.mockReturnValueOnce(id).mockReturnValueOnce(next);
  mocks.reserve.mockReset().mockResolvedValue({ok:true});mocks.generate.mockResolvedValue({bookId:id,status:'complete'});
  const first=renderHook(()=>useNewStory('english','leave'));
  act(()=>{first.result.current.setHero({id:'h',name:'Maya'});first.result.current.setTopic('Forest');first.result.current.setStep(2)});
  await act(async()=>{await first.result.current.start()});
  expect(JSON.parse(localStorage.getItem(newStoryStorageKey('user-a')))).toMatchObject({topic:'Forest',attemptId:null});
  first.unmount();mocks.reserve.mockClear();mocks.reserve.mockImplementation(()=>new Promise(()=>{}));
  const second=renderHook(()=>useNewStory('english','leave'));expect(mocks.reserve).not.toHaveBeenCalled();
  act(()=>{void second.result.current.start()});expect(mocks.reserve).toHaveBeenCalledWith(next);
 });

 it('persists selected landscape size per owner and sends it to the recipe',async()=>{
  mocks.reserve.mockResolvedValue({ok:true});mocks.generate.mockResolvedValue({bookId:id,status:'partial'});
  const first=renderHook(()=>useNewStory('english','leave'));
  act(()=>{first.result.current.setHero({id:'h',name:'Maya'});first.result.current.setTopic('Forest');first.result.current.setStep(2);first.result.current.setPrintSize('landscape-210x170')});
  first.unmount();const second=renderHook(()=>useNewStory('english','leave'));
  expect(second.result.current.printSize).toBe('landscape-210x170');
  await act(async()=>{await second.result.current.start()});
  expect(mocks.generate.mock.calls[0][0].recipe.checkpointInputs().bookData.print_size).toBe('landscape-210x170');
 });

 it('does not reveal a completed result when the account changes mid-run',async()=>{
  mocks.reserve.mockResolvedValue({ok:true});let finish, emit;const pending=new Promise(resolve=>{finish=resolve});mocks.generate.mockImplementation(({onEvent})=>{emit=onEvent;return pending});
  const {result,rerender}=renderHook(()=>useNewStory('english','leave'));
  act(()=>{result.current.setHero({id:'h',name:'Private A'});result.current.setTopic('Secret');result.current.setStep(2)});
  await act(async()=>{void result.current.start();await Promise.resolve();await Promise.resolve()});
  act(()=>emit({type:'page-image',ready:2,illustrated:1,total:2}));
  expect(result.current.waiting).toMatchObject({stage:'drawing',counts:{ready:2,illustrated:1,total:2}});
  mocks.owner='user-b';rerender();
  act(()=>emit({type:'page-image',ready:2,illustrated:2,total:2}));
  expect(result.current.waiting).toBeNull();
  await act(async()=>{finish({bookId:id,status:'complete'});await pending});
  expect(result.current.topic).toBe('');expect(result.current.bookId).toBeNull();expect(result.current.state).toBeNull();
 });

});
