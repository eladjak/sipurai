import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n/i18nProvider';
import { trackEvent } from '@/lib/analytics';
import { Feedback } from '@/entities/Feedback';

/**
 * GiftEditionCTA — a DEMAND-GATE (measurement only, NO payment).
 *
 * Validates willingness-to-pay for a printed / premium "gift edition" of a book
 * BEFORE any print (BookPod) or checkout integration is built. Per Elad's
 * demand-over-vanity rule: measure real intent first, build the pipeline only
 * if the clicks are real.
 *
 * On "I'm interested": logs an analytics event (Umami, cookieless) AND — for
 * signed-in users — persists an interest row via the existing Feedback entity
 * (feedback_type='gift_edition_interest'), so intent is durable and queryable,
 * not just an ephemeral analytics ping. No email is collected here; the
 * signed-in user is already identifiable server-side by their Clerk id, and we
 * never collect a child's data (COPPA).
 *
 * Explicitly does NOT: take payment, create an order, send anything, or promise
 * a delivery. Pure interest capture.
 *
 * @param {{ book: { id?: string, title?: string }, isGuest?: boolean, nightMode?: boolean }} props
 */
export default function GiftEditionCTA({ book, isGuest = false, nightMode = false }) {
  const { t, isRTL } = useI18n();
  const [state, setState] = useState('idle'); // idle | saving | done
  const [tier, setTier] = useState(null); // 'digital' | 'print'

  const registerInterest = async (chosenTier) => {
    if (state === 'saving') return;
    setTier(chosenTier);
    setState('saving');

    // Analytics ping (works for guests too — anonymous, cookieless).
    trackEvent('gift_edition_interest', {
      tier: chosenTier,
      book_id: book?.id || null,
      is_guest: isGuest,
    });

    // Durable record for signed-in users (guests can't write under RLS, and
    // we don't collect guest PII). Best-effort — a failure must not break UX.
    if (!isGuest && book?.id) {
      try {
        await Feedback.create({
          book_id: book.id,
          feedback_type: 'gift_edition_interest',
          content: `interest:${chosenTier}`,
          is_suggestion: false,
          privacy: 'private',
          status: 'pending',
        });
      } catch {
        // swallow — analytics already captured the signal
      }
    }

    setState('done');
  };

  const cardBg = nightMode
    ? 'bg-gray-900 ring-gray-700'
    : 'bg-gradient-to-br from-amber-50 to-rose-50 dark:from-amber-900/20 dark:to-rose-900/20 ring-amber-100 dark:ring-amber-800/30';

  return (
    <div className={`max-w-2xl mx-auto mt-4 rounded-2xl p-6 shadow-lg ring-1 ${cardBg}`}>
      <AnimatePresence mode="wait">
        {state === 'done' ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className={`text-xl font-bold mb-1 ${nightMode ? 'text-amber-100' : 'text-gray-800 dark:text-gray-100'}`}>
              {t('giftEdition.thanksTitle')}
            </h3>
            <p className={`text-sm ${nightMode ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {t('giftEdition.thanksBody')}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="offer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <div className="text-3xl mb-2" aria-hidden="true">🎁</div>
            <h3 className={`text-xl font-bold mb-1 ${nightMode ? 'text-amber-100' : 'text-gray-800 dark:text-gray-100'}`}>
              {t('giftEdition.title')}
            </h3>
            <p className={`text-sm mb-5 ${nightMode ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {t('giftEdition.subtitle')}
            </p>
            <div className={`flex flex-wrap justify-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button
                variant="outline"
                disabled={state === 'saving'}
                onClick={() => registerInterest('digital')}
                className="flex items-center gap-2 rounded-xl"
              >
                {state === 'saving' && tier === 'digital'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Gift className="h-4 w-4" />}
                {t('giftEdition.digitalCta')}
              </Button>
              <Button
                disabled={state === 'saving'}
                onClick={() => registerInterest('print')}
                className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white flex items-center gap-2 rounded-xl shadow-md"
              >
                {state === 'saving' && tier === 'print'
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Gift className="h-4 w-4" />}
                {t('giftEdition.printCta')}
              </Button>
            </div>
            <p className={`mt-3 text-xs ${nightMode ? 'text-gray-500' : 'text-gray-400 dark:text-gray-500'}`}>
              {t('giftEdition.noChargeNote')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
