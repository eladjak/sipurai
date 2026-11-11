import { useEffect, useRef, useState } from 'react';
import { Book } from '@/entities/Book';
import { Page } from '@/entities/Page';
import { InvokeLLM, GenerateImage } from '@/integrations/Core';
import { generateBookIncremental } from '@/lib/bookGeneration';
import { buildRecipe, pageCountFor } from '@/lib/bookRecipe';
import { reserveBookSlot, clearActiveBookKey, newBookKey } from '@/lib/bookQuota';
import { moderateInput } from '@/utils/content-moderation';

export function useNewStory(language, leaveMessage) {
 const [step, setStep] = useState(0), [hero, setHero] = useState(null), [topic, setTopic] = useState('');
 const [length, setLength] = useState('medium'), [style, setStyle] = useState('disney');
 const [state, setState] = useState(null), [bookId, setBookId] = useState(null), [invalid, setInvalid] = useState(false);
 const lock = useRef(false), key = useRef(null), savedBook = useRef(null);
 useEffect(() => { const offline = () => { if (lock.current) setState('disconnected'); }; window.addEventListener('offline', offline); return () => window.removeEventListener('offline', offline); }, []);
 useEffect(() => { if (!(hero || topic) || state) return; const before = e => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', before); const click = e => { const a = e.target.closest?.('a[href]'); if (a && !window.confirm(leaveMessage)) e.preventDefault(); }; document.addEventListener('click', click, true); return () => { window.removeEventListener('beforeunload', before); document.removeEventListener('click', click, true); }; }, [hero, topic, state, leaveMessage]);
 const start = async () => {
  if (lock.current) return;
  if (moderateInput(topic, 'description').blocked) { setInvalid(true); return; }
  setInvalid(false); lock.current = true; setState('queued'); key.current ||= newBookKey();
  const timer = setTimeout(() => setState(s => s === 'queued' ? 'slow' : s), 30000);
  try {
   await reserveBookSlot(key.current);
   const characters = [hero];
   const persistedCharacters = characters.map(c => ({ id:c.id, name:c.name, appearance:c.appearance || '', description:c.description || '', traits:c.traits || '' }));
   const bookData = { title: topic, description: topic, moral:'', art_style:style, length, genre:'adventure', age_range:'5-7', language: language === 'hebrew' ? 'hebrew' : 'english', child_name:hero.name, child_age:hero.age || 5, child_gender:'neutral', tone:'exciting', interests:'', family_members:'', status:'draft', cover_image:'', print_size:'square-220', selectedCharacters:persistedCharacters };
   const recipe = buildRecipe({ bookData, characters, scenes:[], topic, useRhyming:false, rhymeSettings:{pattern:'aabb',meter:'free',complexity:'simple'}, storyBible:null, pageCount:pageCountFor(length), defaultAgeRange:localStorage.getItem('preferredAgeRange') || '5-10' });
   const result = await generateBookIncremental({ entities:{ Book, Page }, ai:{ InvokeLLM, GenerateImage }, recipe, bookId:savedBook.current, onEvent:event => { if ((event.type === 'book-created' || event.type === 'resumed') && event.bookId) { savedBook.current = event.bookId; setBookId(event.bookId); } } });
   if (result.bookId) { savedBook.current = result.bookId; setBookId(result.bookId); }
   if (result.status === 'failed' || !result.bookId) throw new Error('Story not readable');
   setState('success');
  } catch (err) { if (err?.bookId) { savedBook.current = err.bookId; setBookId(err.bookId); } setState(navigator.onLine ? 'failed' : 'disconnected'); }
  finally { clearTimeout(timer); clearActiveBookKey(); lock.current = false; }
 };
 return { step,setStep,hero,setHero,topic,setTopic,length,setLength,style,setStyle,state,bookId,start,invalid };
}
