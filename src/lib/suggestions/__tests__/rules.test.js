import { describe, it, expect } from 'vitest';
import { suggestions } from '../rules';
const t = (key, vars = {}) => `${key}:${Object.values(vars).join(',')}`;
const run = data => suggestions({ t, now: new Date('2026-12-12T12:00:00Z'), ...data });
const has = (data, id) => run(data).some(item => item.id === id);
describe('suggestion rules', () => {
 it('suggests a hero without a book only', () => { expect(has({heroes:[{id:'a',name:'A'}],books:[]}, 'new-hero')).toBe(true); expect(has({heroes:[{id:'a',name:'A'}],books:[{selectedCharacters:[{id:'a'}]}]}, 'new-hero')).toBe(false); });
 it('suggests a sequel only for a finished book', () => { expect(has({books:[{status:'complete',title:'Moon'}]}, 'sequel')).toBe(true); expect(has({books:[{status:'draft',title:'Moon'}]}, 'sequel')).toBe(false); expect(has({books:[{status:'completed',title:'Moon'}]}, 'sequel')).toBe(false); });
 it('suggests bedtime from 19:00 in Jerusalem including December', () => { expect(has({now:new Date('2026-12-12T16:59:00Z')}, 'bedtime')).toBe(false); expect(has({now:new Date('2026-12-12T17:01:00Z')}, 'bedtime')).toBe(true); });
 it('suggests a topic last used long ago only', () => { expect(has({books:[{title:'Sea',created_date:'2026-01-01'}]}, 'old-topic')).toBe(true); expect(has({books:[{title:'Sea',created_date:'2026-12-10'}]}, 'old-topic')).toBe(false); });
 it('suggests birthdays only in the coming week', () => { expect(has({heroes:[{id:'a',name:'A',birthday:'2020-12-17'}]}, 'birthday')).toBe(true); expect(has({heroes:[{id:'a',name:'A',birthday:'2020-11-17'}]}, 'birthday')).toBe(false); expect(has({heroes:[{id:'a',name:'A'}]}, 'birthday')).toBe(false); });
 it('limits results to three and includes cost without invented number', () => { const items=run({heroes:[{id:'a',name:'A',birthday:'2020-12-17'}],books:[{status:'complete',title:'Moon',created_date:'2026-01-01'}],now:new Date('2026-12-12T17:01:00Z')}); expect(items).toHaveLength(3); expect(items.every(x => x.costLabel && !/\d/.test(x.costLabel))).toBe(true); });
});
