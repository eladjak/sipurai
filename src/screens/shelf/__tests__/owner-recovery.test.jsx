import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Shelf from '../Shelf';
import { useShelf } from '../useShelf';
const state = vi.hoisted(() => ({ id:'owner-a', pending:null }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: state.id ? { id: state.id } : null }) }));
vi.mock('@/entities/Book', () => ({ Book: { filter: vi.fn(({ created_by }) => created_by === 'owner-a' ? Promise.resolve(['generating','partial','failed'].map((status,index) => ({ id:'book-'+index, title:'Story '+index, status, created_by:created_by }))) : new Promise(resolve => { state.pending = resolve; })) } }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t:key=>key, isRTL:false }) }));
function Location() { const l = useLocation(); return <div data-testid="destination">{l.pathname+l.search}</div>; }
function ShelfProbe() { const data=useShelf(); return <div>{data.books.map(book=><span key={book.id}>{book.title}</span>)}</div>; }
afterEach(() => { cleanup(); localStorage.clear(); state.id='owner-a'; state.pending=null; });
describe('cross-device owner recovery', () => {
 it('keeps recent history private across A to B to A and ignores unowned legacy data', async () => {
  localStorage.setItem('sipurai-shelf-recent', JSON.stringify(['book-0']));
  const tree = () => <MemoryRouter initialEntries={['/shelf']}><Shelf /></MemoryRouter>;
  const view = render(tree());
  fireEvent.click(await screen.findByRole('button', { name: /Story 0/ }));
  expect(screen.queryByRole('button', { name: 'shelf.recent' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'spxRecovery.openBook' }));
  expect(localStorage.getItem('sipurai-shelf-recent:owner-a')).toBe('["book-0"]');
  state.id = 'owner-b'; view.rerender(tree());
  await waitFor(() => expect(state.pending).toBeTypeOf('function'));
  await act(async () => state.pending([{ id:'b-book', title:'B story', status:'partial', created_by:'owner-b' }]));
  fireEvent.click(await screen.findByRole('button', { name: /B story/ }));
  expect(screen.queryByRole('button', { name: 'shelf.recent' })).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'spxRecovery.openBook' }));
  expect(localStorage.getItem('sipurai-shelf-recent:owner-b')).toBe('["b-book"]');
  state.id = 'owner-a'; view.rerender(tree());
  expect(await screen.findByRole('button', { name: 'shelf.recent' })).toBeInTheDocument();
  expect(localStorage.getItem('sipurai-shelf-recent:owner-a')).toBe('["book-0"]');
  expect(localStorage.getItem('sipurai-shelf-recent')).toBe('["book-0"]');
 });
 it.each([['generating',0], ['partial',1], ['failed',2]])('opens %s from the actual shelf view', async (_status,index) => {
  render(<MemoryRouter initialEntries={['/shelf']}><Location/><Routes><Route path="/shelf" element={<Shelf/>}/><Route path="/BookView" element={<p>owner reader</p>}/></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{ name:new RegExp('Story '+index) }));
  fireEvent.click(screen.getByRole('link',{name:'spxRecovery.openBook'}));
  expect(screen.getByTestId('destination')).toHaveTextContent(`/BookView?id=book-${index}`);
 });
 it('closes an open sheet immediately when the family changes', async () => {
  const tree = () => <MemoryRouter initialEntries={['/shelf']}><Shelf /></MemoryRouter>;
  const view = render(tree());
  fireEvent.click(await screen.findByRole('button', { name: /Story 0/ }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Story 0');
  state.id = 'owner-b';
  view.rerender(tree());
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByText('Story 0')).toBeNull();
 });
 it('does not show account A books during a switch to account B', async () => {
  const view=render(<ShelfProbe/>); await screen.findByText('Story 0'); state.id='owner-b'; view.rerender(<ShelfProbe/>);
  expect(screen.queryByText('Story 0')).toBeNull();
  await waitFor(()=>expect(state.pending).toBeTypeOf('function'));
 });
});
