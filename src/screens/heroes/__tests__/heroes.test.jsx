import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Heroes from '../Heroes';
import HeroEditor from '../HeroEditor';

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock('@/entities/Character', () => ({ Character: api }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'parent' } }) }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: key => key }) }));
const fixture = { id: 'h1', name: 'Noa', age: 7, personality: 'kind', appearance: 'curly hair', created_by: 'parent' };
const show = path => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/heroes" element={<Heroes/>}/><Route path="/heroes/new" element={<HeroEditor/>}/><Route path="/heroes/:id" element={<HeroEditor/>}/></Routes></MemoryRouter>);
beforeEach(() => { cleanup(); vi.resetAllMocks(); api.list.mockResolvedValue([fixture, { ...fixture, id: 'other', name:'Other', created_by:'another' }]); api.get.mockResolvedValue(fixture); });
describe('heroes', () => {
  it('lists only the current user’s heroes from the fixture', async () => { show('/heroes'); expect(await screen.findByText('Noa')).toBeInTheDocument(); expect(screen.queryByText('Other')).not.toBeInTheDocument(); expect(api.list).toHaveBeenCalledWith('-created_date'); });
  it('shows success only after the entity save resolves', async () => { let resolve; api.update.mockReturnValue(new Promise(r => { resolve = r; })); show('/heroes/h1'); fireEvent.change(await screen.findByLabelText('heroes.name'), { target: { value:'Noya' } }); fireEvent.click(screen.getByText('heroes.save')); expect(api.update).toHaveBeenCalledOnce(); expect(screen.queryByText('heroes.saved')).not.toBeInTheDocument(); resolve({ ...fixture, name:'Noya' }); expect(await screen.findByText('heroes.saved')).toBeInTheDocument(); });
  it('offers a retry after a failed save', async () => { api.update.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(fixture); show('/heroes/h1'); fireEvent.click(await screen.findByText('heroes.save')); expect(await screen.findByText('heroes.saveError')).toBeInTheDocument(); fireEvent.click(screen.getByText('heroes.retry')); expect(await screen.findByText('heroes.saved')).toBeInTheDocument(); expect(api.update).toHaveBeenCalledTimes(2); });
  it('names the hero and preserves books in the delete dialog', async () => { show('/heroes/h1'); fireEvent.click(await screen.findByText('heroes.delete')); expect(screen.getByRole('alertdialog')).toHaveTextContent('Noa'); expect(screen.getByRole('alertdialog')).toHaveTextContent('heroes.deleteText'); expect(api.delete).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('heroes.cancel')); });
});
