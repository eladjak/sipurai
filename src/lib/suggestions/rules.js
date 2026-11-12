// Suggestions use only supplied data; no calls to models or services.
export function suggestions({ heroes = [], books = [], now = new Date(), t }) {
  const items = [];
  const labels = { newHero: vars => t('suggestions.newHero', vars), sequel: vars => t('suggestions.sequel', vars), bedtime: vars => t('suggestions.bedtime', vars), oldTopic: vars => t('suggestions.oldTopic', vars), birthday: vars => t('suggestions.birthday', vars) };
  const add = (id, key, vars = {}) => { const text = labels[key](vars); items.push({ id, text, action: text, costLabel: t('newStory.cost') }); };
  const unused = heroes.find(hero => !books.some(book => (book.selectedCharacters || book.selected_characters || []).some(character => character.id === hero.id)));
  if (unused?.name) add('new-hero', 'newHero', { name: unused.name });
  const finished = books.filter(book => book.status === 'complete' && book.title).sort((a,b) => String(b.created_date || '').localeCompare(String(a.created_date || '')))[0];
  if (finished) add('sequel', 'sequel', { title: finished.title });
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Jerusalem', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', hourCycle:'h23' }).formatToParts(now);
  const part = name => Number(parts.find(p => p.type === name)?.value);
  if (part('hour') >= 19) add('bedtime', 'bedtime');
  const old = books.filter(book => book.title && book.created_date && now - new Date(book.created_date) >= 90 * 86400000).sort((a,b) => String(a.created_date).localeCompare(String(b.created_date)))[0];
  if (old && !books.some(book => book !== old && book.title === old.title && book.created_date && now - new Date(book.created_date) < 90 * 86400000)) add('old-topic', 'oldTopic', { title: old.title });
  const today = Date.UTC(part('year'), part('month') - 1, part('day'));
  const birthday = heroes.find(hero => { const match = /^(?:\d{4})-(\d{2})-(\d{2})/.exec(hero.birthday || hero.birth_date || ''); if (!match) return false; const month = Number(match[1]), day = Number(match[2]); return [part('year'),part('year')+1].some(year => { const d = new Date(Date.UTC(year, month - 1, day)); return d.getUTCMonth() === month - 1 && d.getUTCDate() === day && d - today >= 0 && d - today <= 6 * 86400000; }); });
  if (birthday?.name) add('birthday', 'birthday', { name:birthday.name });
  return items.slice(0,3);
}
