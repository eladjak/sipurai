import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Theatre from '../Theatre';
import words from '@/components/i18n/locales/en/newStory';
import { Page } from '@/entities/Page';
vi.mock('@/entities/Page', () => ({ Page: { filter: vi.fn(), update: vi.fn() } }));
const t = key => key.split('.').reduce((a,k) => a?.[k], words) || key;
const pages = [{id:'2',page_number:2,text_content:'Second page'}, {id:'1',page_number:1,text_content:'First page'}];
beforeEach(() => { vi.clearAllMocks(); Page.filter.mockResolvedValue(pages); });
describe('writing theatre', () => {
 it('reads ready pages in order and skips to the next', async () => { render(<Theatre bookId="b" state="queued" t={t}/>); expect(await screen.findByText('First page')).toBeTruthy(); fireEvent.click(screen.getByRole('button',{name:'Next page'})); expect(screen.getByText('Second page')).toBeTruthy(); });
 it('waits for the existing save to resolve before confirming', async () => { let finish; Page.update.mockReturnValue(new Promise(r => { finish=r; })); render(<Theatre bookId="b" state="queued" t={t}/>); await screen.findByText('First page'); fireEvent.click(screen.getByRole('button',{name:'Edit text'})); fireEvent.change(screen.getByLabelText('Page text'),{target:{value:'Edited'}}); fireEvent.click(screen.getByRole('button',{name:'Save text'})); expect(Page.update).toHaveBeenCalledWith('1',{text_content:'Edited'}); expect(screen.queryByText('Text saved')).toBeNull(); finish(); expect(await screen.findByText('Text saved')).toBeTruthy(); });
 it('does not offer unsupported report or replace actions', async () => { render(<Theatre bookId="b" state="queued" t={t}/>); await screen.findByText('First page'); expect(screen.queryByRole('button',{name:/report|replace|regenerate/i})).toBeNull(); });
 it('keeps pages readable after failure', async () => { render(<Theatre bookId="b" state="failed" t={t}/>); expect(await screen.findByText('First page')).toBeTruthy(); expect(screen.getByText(/story stopped/i)).toBeTruthy(); fireEvent.click(screen.getByRole('button',{name:'Next page'})); expect(screen.getByText('Second page')).toBeTruthy(); });
});
