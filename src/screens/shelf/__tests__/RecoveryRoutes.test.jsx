import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
const fixture = vi.hoisted(()=>({ user:{id:'owner-a'}, status:'generating', filter:vi.fn() }));
vi.mock('@/lib/flags',()=>({isNewShell:()=>true}));
vi.mock('@/lib/AuthContext',()=>({useAuth:()=>({user:fixture.user,isLoadingAuth:false,isLoadingPublicSettings:false}),AuthProvider:({children})=>children,FallbackAuthProvider:({children})=>children}));
vi.mock('@/hooks/useCurrentUser',()=>({useCurrentUser:()=>({user:fixture.user})}));
vi.mock('@/entities/Book',()=>({Book:{filter:(criteria)=>{fixture.filter(criteria);return Promise.resolve([{id:'book-a',title:'Owner story',status:fixture.status,created_by:'owner-a'}])}}}));
vi.mock('@/entities/Page',()=>({Page:{filter:vi.fn(async()=>[{page_number:1,text_content:''}])}}));
vi.mock('@/components/i18n/i18nProvider',()=>({useI18n:()=>({t:key=>key,language:'english',isRTL:false}),I18nProvider:({children})=>children}));
vi.mock('@/components/privacy/PrivacyGate',()=>({default:({children})=>children}));
vi.mock('@/shell/AppShell',()=>({default:({children})=><div>{children}</div>}));
vi.mock('@/lib/analytics',()=>({trackPageView:vi.fn(),identifyUser:vi.fn()}));
vi.mock('@/lib/errorTracking',()=>({initErrorTracking:vi.fn(),captureError:vi.fn()}));
vi.mock('@/lib/NavigationTracker',()=>({default:()=>null}));
vi.mock('@/utils/storageCleanup',()=>({cleanupStorage:vi.fn()}));
vi.mock('@/components/ClerkLocaleProvider',()=>({default:({children})=>children}));
vi.mock('@/pages.config',()=>{const Reader=()=>{const l=useLocation();return <p>Owner reader {l.search}</p>};return {pagesConfig:{mainPage:'Home',Layout:({children})=>children,Pages:{BookView:Reader,Settings:()=>null,Pricing:()=>null,LandingPage:()=>null,Blog:()=>null,BlogPost:()=>null,PrivacyPolicy:()=>null,TermsOfService:()=>null,Accessibility:()=>null,Contact:()=>null}}}});
afterEach(()=>{cleanup();fixture.filter.mockClear();vi.unstubAllEnvs()});
describe('real new-shell routes with a second-device empty browser',()=>{
 it.each([
  ['generating', /Owner story.*tonight\.generating/],
  ['partial', 'tonight.recover'],
  ['failed', /Owner story.*tonight\.failed/],
 ])('opens %s from Tonight and scopes lookup to owner',async (status,label)=>{
  localStorage.clear();fixture.status=status;vi.stubEnv('VITE_NEW_SHELL','true');const {NewShellRoutes}=await import('../../../App.jsx');
  render(<MemoryRouter initialEntries={['/']}><NewShellRoutes/></MemoryRouter>);
  fireEvent.click(await screen.findByRole('link',{name:label}));
  expect(await screen.findByText('Owner reader ?id=book-a')).toBeInTheDocument();
  expect(fixture.filter).toHaveBeenCalledWith({created_by:'owner-a'});
 });
});
