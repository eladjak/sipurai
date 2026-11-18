import { useI18n } from '@/components/i18n/i18nProvider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Pencil, ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { printOrderApi } from '@/lib/printOrder/api';
import { PageShell, Card, PrimaryButton, SecondaryButton, InlineAlert, ActionBar } from '@/components/checkout/ui';
import { Stepper } from '@/components/checkout/Stepper';
import { QtyStepper } from '@/components/checkout/QtyStepper';
import { MethodCards } from '@/components/checkout/MethodCards';
import { AddressForm } from '@/components/checkout/AddressForm';
import { PriceLines, PaymentNotes } from '@/components/checkout/SummaryCard';
import { useQuote } from '@/components/checkout/useQuote';
import { emptyAddress, validateAddress, normalizeAddress, ADDRESS_FIELDS } from '@/components/checkout/validation';
import { formatIls, makeIdempotencyKey } from '@/components/checkout/format';
import { Book } from '@/entities/Book';
import useSubscription from '@/hooks/useSubscription';
import { configuredPrintEditionPolicy as policy, printEditionCapabilities } from '@/lib/printEdition/policy';
import { paperOptions } from '@/screens/print-edition/PaperPreferences';

const draftKey = (bookId) => `sipurai.printDraft.${bookId}`;
const idemKey = (bookId) => `sipurai.printKey.${bookId}`;

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJson(store, key, value) {
  try {
    (store === 'session' ? window.sessionStorage : window.localStorage).setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota: the form simply works without a draft */
  }
}

const stepMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.18, ease: 'easeOut' },
};

/**
 * The checkout flow. Dependencies (api, redirect) are injectable so the same component
 * renders in tests and in the screenshot harness without a network or a Clerk session.
 */
export function PrintCheckoutView({
  bookId,
  api = printOrderApi,
  redirect = (url) => window.location.assign(url),
  initialStep = 1,
  initialAddress = undefined,
  persist = true,
  quoteDebounceMs = 250,
  loadEdition = null,
  initialEdition = null,
  allowUpgradedPaper = true,
}) {
  const { t: translate } = useI18n();

  /** @type {(key: string, values?: any) => string} */
  const t = translate;
  /** @returns {any} */
  const errorText = (error) => error?.code === 'network' ? t('print.checkoutPage.network') : error?.code === 'unauthorized' ? t('print.checkoutPage.unauthorized') : error?.code === 'forbidden' ? t('print.checkoutPage.forbidden') :
    error?.code === 'print_edition_not_orderable' ? t('print.checkoutPage.editionNotOrderable') : t('print.checkoutPage.generic');
  const saved = useMemo(() => (persist ? readJson(draftKey(bookId)) : null), [persist, bookId]);
  const [config, setConfig] = useState({ status: 'loading', data: null, error: null });
  const [step, setStep] = useState(initialStep);
  const [qty, setQty] = useState(saved?.qty || 1);
  const [paper, setPaper] = useState(initialEdition?.paper || saved?.paper || 'standard');
  const [cover, setCover] = useState(initialEdition?.cover || saved?.cover || 'softcover');
  const [editionStatus, setEditionStatus] = useState(loadEdition ? 'loading' : 'ready');
  const [editionRetry, setEditionRetry] = useState(0);
  const [method, setMethod] = useState(saved?.method || 'ship');
  const [address, setAddress] = useState({ ...emptyAddress(), ...(saved?.address || {}), ...(initialAddress || {}) });
  const [shown, setShown] = useState({});
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const headingRef = useRef(null);
  const inFlight = useRef(false);
  const keyRef = useRef(null);

  const loadConfig = useCallback(async () => {
    setConfig({ status: 'loading', data: null, error: null });
    try {
      const data = await api.getConfig();
      setConfig({ status: 'ready', data, error: null });
    } catch (error) {
      setConfig({ status: 'error', data: null, error });
    }
  }, [api]);
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!loadEdition) return undefined;
    let active = true;
    setEditionStatus('loading');
    loadEdition(bookId).then(book => {
      if (!active) return;
      if (!book) throw new Error('Book unavailable');
      if (book.printEdition) {
        setPaper(book.printEdition.paper || 'standard');
        setCover(book.printEdition.cover || 'softcover');
      }
      setEditionStatus('ready');
    }).catch(() => { if (active) setEditionStatus('error'); });
    return () => { active = false; };
  }, [loadEdition, bookId, editionRetry]);

  const maxQty = config.data?.maxQty || 10;
  const pickupOn = !!config.data?.pickup?.enabled;
  const effectiveMethod = method === 'pickup' && !pickupOn && config.status === 'ready' ? 'ship' : method;
  const errors = useMemo(() => validateAddress(address, effectiveMethod, t), [address, effectiveMethod, t]);

  // Autosave the form draft (never anything about payment).
  useEffect(() => {
    if (!persist) return;
    writeJson('local', draftKey(bookId), { qty, method, address, paper, cover });
  }, [persist, bookId, qty, method, address, paper, cover]);

  const quoteEnabled = config.status === 'ready' && editionStatus === 'ready' && config.data?.enabled !== false && cover === 'softcover' && (allowUpgradedPaper || paper === 'standard') && ['standard', 'chrome-matte-130', 'chrome-matte-170'].includes(paper);
  const q = useQuote(api, { bookId, qty, method: effectiveMethod, paper, enabled: quoteEnabled && paper !== 'premium', debounceMs: quoteDebounceMs });
  const quoteMatches = q.status === 'ready' && q.quote?.paper === paper && q.quote?.qty === qty && q.quote?.method === effectiveMethod && q.quote?.cover === 'softcover' && Number.isInteger(q.quote?.pageCount) && Boolean(q.quote?.presetId) && Boolean(q.quote?.priceVersion) && Number.isInteger(q.quote?.totalAgorot);

  // Move focus to the step heading so screen readers and keyboard users land in the right place.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus?.();
    try {
      window.scrollTo?.({ top: 0 });
    } catch {
      /* jsdom */
    }
  }, [step]);

  // If the browser restores this page from the back/forward cache after the payment
  // redirect, do not leave the button stuck on "redirecting".
  useEffect(() => {
    const onShow = (e) => {
      if (e.persisted) {
        inFlight.current = false;
        setCreating(false);
      }
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const goNext = () => {
    if (step === 2 && effectiveMethod === 'ship') {
      const keys = Object.keys(errors);
      if (keys.length) {
        setShown(Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, true])));
        const first = ADDRESS_FIELDS.find((k) => errors[k]);
        setTimeout(() => document.getElementById(`addr-${first}`)?.focus?.(), 0);
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const ensureKey = (sig) => {
    if (!keyRef.current && persist) {
      try {
        keyRef.current = JSON.parse(window.sessionStorage.getItem(idemKey(bookId)) || 'null');
      } catch {
        keyRef.current = null;
      }
    }
    if (!keyRef.current || keyRef.current.sig !== sig) {
      keyRef.current = { sig, key: makeIdempotencyKey() };
      if (persist) writeJson('session', idemKey(bookId), keyRef.current);
    }
    return keyRef.current.key;
  };

  const submit = async () => {
    if (inFlight.current || !quoteMatches) return; // Never submit without the matching server quote.
    inFlight.current = true;
    setCreating(true);
    setCreateError(null);
    const addr = effectiveMethod === 'ship' ? normalizeAddress(address) : null;
    const sig = JSON.stringify({ bookId, qty, method: effectiveMethod, paper, addr, total: q.quote.totalAgorot, priceVersion: q.quote.priceVersion });
    try {
      const res = await api.createOrder({
        bookId,
        qty,
        method: effectiveMethod,
        paper,
        cover: 'softcover',
        acceptedQuote: {
          bookId, presetId: q.quote.presetId, pageCount: q.quote.pageCount,
          paper: q.quote.paper, cover: q.quote.cover, qty: q.quote.qty,
          method: q.quote.method, totalAgorot: q.quote.totalAgorot,
          priceVersion: q.quote.priceVersion,
        },
        address: addr,
        idempotencyKey: ensureKey(sig),
      });
      if (!res || !res.checkoutUrl) {
        const e = new Error('no checkout url');
        e.message_he = t('print.checkoutPage.generic');
        throw e;
      }
      redirect(res.checkoutUrl); // stays in the "redirecting" state on purpose
    } catch (error) {
      inFlight.current = false;
      setCreating(false);
      setCreateError(error);
    }
  };

  useEffect(() => {
    if (createError) document.getElementById('create-error')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [createError]);

  // ---- reasons the primary button is disabled, in words ----
  let reason = '';
  if (step === 3) {
    if (creating) reason = '';
    else if (q.status === 'loading' && !q.quote) reason = t('print.checkoutPage.waitingPrice');
    else if (q.status === 'error' || !['standard', 'chrome-matte-130', 'chrome-matte-170'].includes(paper) || (q.quote && q.quote.paper !== paper)) reason = t('print.checkoutPage.noPrice');
  }
  const nextDisabled = config.status !== 'ready' || editionStatus !== 'ready' || cover !== 'softcover' || (!allowUpgradedPaper && paper !== 'standard') || !['standard', 'chrome-matte-130', 'chrome-matte-170'].includes(paper) || (step === 3 && (!quoteMatches)) || creating;

  // ---- top-level states ----
  if (config.status === 'loading' || editionStatus === 'loading') {
    return (
      <PageShell title={t('print.checkoutPage.pageTitle')} backTo={`/BookView?id=${bookId}`} backLabel={t('print.checkoutPage.backBook')}>
        <div className="space-y-4" aria-busy="true" role="status" aria-label={t('print.checkoutPage.loading')}>
          <Skeleton className="h-16 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
      </PageShell>
    );
  }
  if (config.status === 'error' || editionStatus === 'error') {
    return (
      <PageShell title={t('print.checkoutPage.pageTitle')} backTo={`/BookView?id=${bookId}`} backLabel={t('print.checkoutPage.backBook')}>
        <InlineAlert className="" title={t('print.checkoutPage.loadError')} onRetry={() => { loadConfig(); setEditionRetry(n => n + 1); }}>
          {errorText(config.error)}
        </InlineAlert>
      </PageShell>
    );
  }
  if (config.data?.enabled === false) {
    return (
      <PageShell title={t('print.checkoutPage.pageTitle')} backTo={`/BookView?id=${bookId}`} backLabel={t('print.checkoutPage.backBook')}>
        <InlineAlert tone="info" title={t('print.checkoutPage.unavailable')}>
          {t('print.checkoutPage.unavailableHint')}
        </InlineAlert>
      </PageShell>
    );
  }

  const stepTitles = { 1: t('print.checkoutPage.step1'), 2: effectiveMethod === 'ship' ? t('print.checkoutPage.step2') : t('print.checkoutCopy.pickup'), 3: t('print.checkoutPage.step3') };

  return (
    <PageShell title={stepTitles[step]} backTo={step === 1 ? `/BookView?id=${bookId}` : undefined} backLabel={t('print.checkoutPage.backBook')} headingRef={headingRef}>
      <div className="mb-5">
        <Stepper current={step} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} {...stepMotion}>
          {step === 1 && (
            <div className="space-y-5">
              <Card>
                <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                  <BookOpen className="h-5 w-5 text-purple-600" aria-hidden="true" />
                  {t('print.checkoutPage.howMany')}
                </h2>
                <QtyStepper value={qty} onChange={setQty} max={maxQty} />
              </Card>
              <Card className="">
                <fieldset>
                  <legend className="mb-3 text-base font-bold">{t('print.paperChoice.paper')}</legend>
                  <div className="grid gap-2">
                    {paperOptions(t).map(([option, name, hint]) => (
                      <label key={option} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-slate-300 p-3 focus-within:ring-2 focus-within:ring-purple-500">
                        <input className="mt-1 accent-purple-700" type="radio" name="checkout-paper" checked={paper === option} disabled={option !== 'standard' && !allowUpgradedPaper} onChange={() => setPaper(option)} />
                        <span><span className="block font-semibold">{name}</span><span className="block text-sm text-slate-600 dark:text-slate-300">{option !== 'standard' && !allowUpgradedPaper ? t('print.paperChoice.unavailablePlan') : hint}</span></span>
                      </label>
                    ))}
                  </div>
                  {!allowUpgradedPaper && paper !== 'standard' && <p role="status">{t('print.paperChoice.unavailablePlan')}</p>}
                  {!['standard', 'chrome-matte-130', 'chrome-matte-170'].includes(paper) && <p role="status">{t('print.paperChoice.legacyPaper')}</p>}
                </fieldset>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t('print.paperChoice.hint')}</p>
                <fieldset className="mt-4">
                  <legend className="font-semibold">{t('print.paperChoice.cover')}</legend>
                  <label className="flex min-h-11 items-center gap-3">
                    <input type="radio" name="checkout-cover" checked={cover === 'softcover'} onChange={() => setCover('softcover')} />
                    {t('print.paperChoice.softcover')}
                  </label>
                  <p className="text-sm">{t('print.paperChoice.hardSoon')}</p>
                  {cover !== 'softcover' && <p role="status">{t('print.paperChoice.legacyCover')}</p>}
                </fieldset>
              </Card>
              <Card>
                <MethodCards value={effectiveMethod} onChange={setMethod} pickup={config.data?.pickup} />
              </Card>
              <p className="px-1 text-sm text-slate-600 dark:text-slate-300">
                {quoteMatches ? (
                  <>
                    {t('print.checkoutPage.estimated')}{' '}
                    <strong className="text-slate-900 dark:text-white" dir="ltr">
                      {formatIls(q.quote.totalAgorot)}
                    </strong>{' '}
                    {t('print.checkoutPage.final')}
                  </>
                ) : q.status === 'error' ? (
                  t('print.checkoutPage.priceLater')
                ) : (
                  t('print.checkoutPage.calculating')
                )}{' '}
                {t('print.checkoutPage.fullDetails')}
              </p>
            </div>
          )}

          {step === 2 && (
            <Card>
              {effectiveMethod === 'ship' ? (
                <>
                  <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {t('print.checkoutPage.addressHint')}
                  </p>
                  <AddressForm values={address} onChange={setAddress} errors={errors} shown={shown} idPrefix="addr" />
                </>
              ) : (
                <div className="space-y-2 text-base leading-relaxed text-slate-700 dark:text-slate-200">
                  <p>{t('print.checkoutPage.pickupHint1')}</p>
                  <p>{t('print.checkoutPage.pickupHint2')}</p>
                </div>
              )}
            </Card>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {q.status === 'error' && <InlineAlert title={t('print.checkoutPage.quoteError')} onRetry={q.retry}>{errorText(q.error)}</InlineAlert>}
              {(q.quote || q.status === 'loading') && (
              <Card aria-label={t('print.checkoutPage.priceDetails')}>
                <h2 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
                  {qty === 1 ? t('print.checkoutPage.oneBook') : t('print.checkoutPage.manyBooks', { qty })}
                  <span className="block text-sm font-normal">{paperOptions(t).find(([id]) => id === paper)?.[1]}</span>
                </h2>
                <PriceLines quote={q.quote} loading={q.status === 'loading'} />
              </Card>
              )}
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    <p className="font-bold text-slate-900 dark:text-white">{effectiveMethod === 'ship' ? t('print.checkoutCopy.delivery') : t('print.checkoutCopy.pickup')}</p>
                    {effectiveMethod === 'ship' && (
                      <p data-testid="summary-address">
                        {address.fullName}
                        <br />
                        {address.street} {address.houseNumber}
                        {address.apartment ? `, ${t('print.checkoutPage.apartment', { apartment: address.apartment })}` : ''}, {address.city}
                        <br />
                        <span dir="ltr">{address.phone}</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(effectiveMethod === 'ship' ? 2 : 1)}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-purple-700 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-purple-300"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    {t('print.checkoutPage.edit')}
                  </button>
                </div>
              </Card>
              <Card>
                <PaymentNotes />
              </Card>
              {createError && (
                <div id="create-error">
                <InlineAlert title={t('print.checkoutPage.createError')} onRetry={submit} retryLabel={t('print.checkoutPage.retry')}>
                  {/** @type {any} */ (<>
                    {(createError.code === 'unauthorized' || createError.code === 'network') && <p>{errorText(createError)}</p>}
                    <p>{/** @type {any} */ (t('print.checkoutPage.createUncertain'))}</p>
                  </>)}
                </InlineAlert>
                </div>
              )}
              <p className="px-1 text-center text-xs text-slate-500 dark:text-slate-400">
                {t('print.checkoutPage.changeHint')}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <ActionBar reason={reason}>
        {step > 1 && (
          <SecondaryButton type="button" onClick={() => setStep((s) => s - 1)} disabled={creating} aria-label={t('print.checkoutPage.backStep')}>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
            {t('print.checkoutPage.back')}
          </SecondaryButton>
        )}
        {step < 3 ? (
          <PrimaryButton type="button" className="flex-1" onClick={goNext} disabled={nextDisabled}>
            {t('print.checkoutPage.continue')}
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </PrimaryButton>
        ) : (
          <PrimaryButton type="button" className="flex-1" onClick={submit} disabled={nextDisabled} loading={creating} data-testid="pay-button">
            {creating ? (
              t('print.checkoutPage.redirecting')
            ) : (
              <>
                <Lock className="h-5 w-5" aria-hidden="true" />
                {t('print.checkoutPage.pay')}
              </>
            )}
          </PrimaryButton>
        )}
      </ActionBar>
    </PageShell>
  );
}

function SubscribedCheckout({ id }) {
  const { plan } = useSubscription();
  return <PrintCheckoutView bookId={id} loadEdition={Book.get} allowUpgradedPaper={printEditionCapabilities(policy, plan).upgradedPaper} />;
}

export default function PrintCheckout() {
  const { id } = useParams();
  if (policy === 'subscriber-preview') return <SubscribedCheckout id={id} />;
  return <PrintCheckoutView bookId={id} loadEdition={Book.get} allowUpgradedPaper={printEditionCapabilities(policy).upgradedPaper} />;
}
