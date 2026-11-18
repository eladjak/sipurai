import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import SampleReader from './SampleReader';
import SignIn from './SignIn';
import SignUp from './SignUp';
const state = vi.hoisted(() => ({ user: false, shell: false }));
vi.mock('@/lib/flags', () => ({ isNewShell: () => state.shell }));
vi.mock('@/components/i18n/i18nProvider', async () => { const locale = (await import('@/components/i18n/locales/he/spxLibrary')).default; return { useI18n: () => ({ language:'hebrew', isRTL:true, t: key => key.split('.').reduce((v,p)=>v?.[p],locale) || key }) }; });
vi.mock('@clerk/clerk-react', async () => {
 const React = await import('react'); const { Link, useNavigate } = await import('react-router-dom');
 const Fake = ({ fallbackRedirectUrl, signUpUrl }) => { const navigate = useNavigate(); return <div>{signUpUrl && <Link to={signUpUrl}>signup</Link>}<button onClick={() => { state.user = true; navigate(fallbackRedirectUrl); }}>authenticate</button></div>; };
 return { SignIn: Fake, SignUp: Fake };
});
afterEach(() => { cleanup(); state.user = false; });
function Wizard() { return state.user ? <p>protected wizard</p> : <Navigate to={'/sign-in?redirect_url=' + encodeURIComponent(state.shell ? '/new' : '/BookWizard')} replace />; }
describe('sample to account to protected wizard', () => {
 it.each([[false,false],[false,true],[true,false],[true,true]])('shell %s signup %s', (shell, signup) => {
  state.shell = shell;
  render(<MemoryRouter initialEntries={['/samples/demo-dragons-garden?page=5']}><Routes><Route path="/samples/:id" element={<SampleReader/>}/><Route path="/sign-in" element={<SignIn/>}/><Route path="/sign-up" element={<SignUp/>}/><Route path="/BookWizard" element={<Wizard/>}/><Route path="/new" element={<Wizard/>}/></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('link',{name:'יוצרים סיפור משלכם'}));
  if (signup) fireEvent.click(screen.getByRole('link',{name:'signup'}));
  fireEvent.click(screen.getByRole('button',{name:'authenticate'}));
  expect(screen.getByText('protected wizard')).toBeInTheDocument();
 });
});
