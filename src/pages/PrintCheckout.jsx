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
  initialAddress,
  persist = true,
  quoteDebounceMs = 250,
}) {
  const saved = useMemo(() => (persist ? readJson(draftKey(bookId)) : null), [persist, bookId]);
  const [config, setConfig] = useState({ status: 'loading', data: null, error: null });
  const [step, setStep] = useState(initialStep);
  const [qty, setQty] = useState(saved?.qty || 1);
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

  const maxQty = config.data?.maxQty || 10;
  const pickupOn = !!config.data?.pickup?.enabled;
  const effectiveMethod = method === 'pickup' && !pickupOn && config.status === 'ready' ? 'ship' : method;
  const errors = useMemo(() => validateAddress(address, effectiveMethod), [address, effectiveMethod]);

  // Autosave the form draft (never anything about payment).
  useEffect(() => {
    if (!persist) return;
    writeJson('local', draftKey(bookId), { qty, method, address });
  }, [persist, bookId, qty, method, address]);

  const quoteEnabled = config.status === 'ready' && config.data?.enabled !== false;
  const q = useQuote(api, { bookId, qty, method: effectiveMethod, enabled: quoteEnabled, debounceMs: quoteDebounceMs });

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
    if (inFlight.current) return; // double tap, double click, Enter + click
    inFlight.current = true;
    setCreating(true);
    setCreateError(null);
    const addr = effectiveMethod === 'ship' ? normalizeAddress(address) : null;
    const sig = JSON.stringify({ bookId, qty, method: effectiveMethod, addr });
    try {
      const res = await api.createOrder({
        bookId,
        qty,
        method: effectiveMethod,
        address: addr,
        idempotencyKey: ensureKey(sig),
      });
      if (!res || !res.checkoutUrl) {
        const e = new Error('no checkout url');
        e.message_he = 'לא הצלחנו לפתוח את עמוד התשלום. ההזמנה לא חויבה. נסו שוב.';
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
    else if (q.status === 'loading' && !q.quote) reason = 'מחשבים את המחיר, עוד רגע…';
    else if (q.status === 'error') reason = 'עדיין אין לנו מחיר להזמנה. לחצו על "נסו שוב" למעלה.';
  }
  const nextDisabled = config.status !== 'ready' || (step === 3 && (q.status !== 'ready' || !q.quote)) || creating;

  // ---- top-level states ----
  if (config.status === 'loading') {
    return (
      <PageShell title="הזמנת ספר מודפס" backTo={`/BookView?id=${bookId}`} backLabel="חזרה לספר">
        <div className="space-y-4" aria-busy="true" role="status" aria-label="טוענים">
          <Skeleton className="h-16 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
      </PageShell>
    );
  }
  if (config.status === 'error') {
    return (
      <PageShell title="הזמנת ספר מודפס" backTo={`/BookView?id=${bookId}`} backLabel="חזרה לספר">
        <InlineAlert title="לא הצלחנו לטעון את ההזמנה" onRetry={loadConfig}>
          {config.error?.message_he || 'משהו השתבש. נסו שוב בעוד רגע.'}
        </InlineAlert>
      </PageShell>
    );
  }
  if (config.data?.enabled === false) {
    return (
      <PageShell title="הזמנת ספר מודפס" backTo={`/BookView?id=${bookId}`} backLabel="חזרה לספר">
        <InlineAlert tone="info" title="ההזמנה של ספר מודפס עדיין לא זמינה">
          אנחנו מכינים אותה. הספר הדיגיטלי שלכם ממשיך לעבוד כרגיל.
        </InlineAlert>
      </PageShell>
    );
  }

  const stepTitles = { 1: 'כמה עותקים, ואיך לקבל?', 2: effectiveMethod === 'ship' ? 'לאן לשלוח?' : 'איסוף עצמי', 3: 'בדיקה אחרונה לפני התשלום' };

  return (
    <PageShell title={stepTitles[step]} backTo={step === 1 ? `/BookView?id=${bookId}` : undefined} backLabel="חזרה לספר" headingRef={headingRef}>
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
                  כמה עותקים להדפיס?
                </h2>
                <QtyStepper value={qty} onChange={setQty} max={maxQty} />
              </Card>
              <Card>
                <MethodCards value={effectiveMethod} onChange={setMethod} pickup={config.data?.pickup} />
              </Card>
              <p className="px-1 text-sm text-slate-600 dark:text-slate-300">
                {q.quote ? (
                  <>
                    מחיר משוער להזמנה:{' '}
                    <strong className="text-slate-900 dark:text-white" dir="ltr">
                      {formatIls(q.quote.totalAgorot)}
                    </strong>{' '}
                    כולל מע״מ.
                  </>
                ) : q.status === 'error' ? (
                  'המחיר יוצג בשלב הסיכום.'
                ) : (
                  'מחשבים מחיר…'
                )}{' '}
                בשלב האחרון תראו את הפירוט המלא לפני שמשלמים.
              </p>
            </div>
          )}

          {step === 2 && (
            <Card>
              {effectiveMethod === 'ship' ? (
                <>
                  <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    מלאו את הכתובת שאליה נשלח את הספר. הפרטים נשמרים במכשיר הזה, כך שאם תצאו באמצע לא תצטרכו להתחיל מחדש.
                  </p>
                  <AddressForm values={address} onChange={setAddress} errors={errors} shown={shown} idPrefix="addr" />
                </>
              ) : (
                <div className="space-y-2 text-base leading-relaxed text-slate-700 dark:text-slate-200">
                  <p>באיסוף עצמי אין צורך בכתובת ואין עלות משלוח.</p>
                  <p>אחרי התשלום תראו בעמוד "ההזמנות שלי" מתי הספר מוכן לאיסוף.</p>
                </div>
              )}
            </Card>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {q.status === 'error' && <InlineAlert title="לא הצלחנו לחשב מחיר" onRetry={q.retry}>{q.error?.message_he}</InlineAlert>}
              {(q.quote || q.status === 'loading') && (
              <Card aria-label="פירוט המחיר">
                <h2 className="mb-2 text-base font-bold text-slate-900 dark:text-white">
                  {qty === 1 ? 'עותק אחד' : `${qty} עותקים`} של הספר
                </h2>
                <PriceLines quote={q.quote} loading={q.status === 'loading'} />
              </Card>
              )}
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    <p className="font-bold text-slate-900 dark:text-white">{effectiveMethod === 'ship' ? 'משלוח סיפוראי' : config.data?.pickup?.label_he || 'איסוף עצמי'}</p>
                    {effectiveMethod === 'ship' && (
                      <p data-testid="summary-address">
                        {address.fullName}
                        <br />
                        {address.street} {address.houseNumber}
                        {address.apartment ? `, דירה ${address.apartment}` : ''}, {address.city}
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
                    עריכה
                  </button>
                </div>
              </Card>
              <Card>
                <PaymentNotes />
              </Card>
              {createError && (
                <div id="create-error">
                <InlineAlert title="לא הצלחנו להעביר אתכם לתשלום" onRetry={submit} retryLabel="נסו שוב">
                  {createError.message_he || 'משהו השתבש. לא חויבתם. נסו שוב בעוד רגע.'}
                </InlineAlert>
                </div>
              )}
              <p className="px-1 text-center text-xs text-slate-500 dark:text-slate-400">
                שינוי הכתובת או הכמות לא מפסיד כלום. אפשר לחזור לכל שלב.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <ActionBar reason={reason}>
        {step > 1 && (
          <SecondaryButton type="button" onClick={() => setStep((s) => s - 1)} disabled={creating} aria-label="חזרה לשלב הקודם">
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
            חזרה
          </SecondaryButton>
        )}
        {step < 3 ? (
          <PrimaryButton type="button" className="flex-1" onClick={goNext} disabled={nextDisabled}>
            המשך
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </PrimaryButton>
        ) : (
          <PrimaryButton type="button" className="flex-1" onClick={submit} disabled={nextDisabled} loading={creating} data-testid="pay-button">
            {creating ? (
              'מעבירים לתשלום…'
            ) : (
              <>
                <Lock className="h-5 w-5" aria-hidden="true" />
                המשך לתשלום
              </>
            )}
          </PrimaryButton>
        )}
      </ActionBar>
    </PageShell>
  );
}

export default function PrintCheckout() {
  const { id } = useParams();
  return <PrintCheckoutView bookId={id} />;
}
