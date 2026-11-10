import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { updateMeta, resetMeta } from '@/lib/seo';

import englishLegal from '@/components/i18n/locales/en/legal';
import { termsContent } from '@/data/termsContent';

const TermsOfService = () => {
  const { language, isRTL, t } = useI18n();
  const c = termsContent;

  useEffect(() => {
    updateMeta({ title: c.metaTitle, description: c.metaDesc });
    return () => resetMeta();
  }, [c]);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 text-indigo-200 hover:text-white transition-colors mb-8 text-sm font-medium"
          >
            <BackIcon className="h-4 w-4" />
            {t('legal.backHome')}
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <ScrollText className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-300" />
              <span className="text-indigo-200 font-medium">Sipurai</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">{t('legal.termsTitle')}</h1>
          <p className="text-indigo-200 text-sm">{t('legal.termsUpdated')}</p>
        </div>
      </div>

      {language !== 'hebrew' && (
        <p className="max-w-3xl mx-auto px-4 pt-6" lang="en" dir="ltr">{language === 'yiddish' ? englishLegal.legal.bindingTerms : t('legal.bindingTerms')}</p>
      )}
      {/* Intro */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8" lang="he" dir="rtl">
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-xl p-5 text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
          {c.intro}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12" lang="he" dir="rtl">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {c.sections.map((section, idx) => (
            <section
              key={idx}
              className={`px-6 sm:px-8 py-8 ${idx < c.sections.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
            >
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
                {section.heading}
              </h2>
              <div className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed space-y-3">
                {section.body.split('\n\n').map((para, pIdx) => {
                  if (!para.trim()) return null;
                  if (para.includes('\n•')) {
                    const lines = para.split('\n');
                    return (
                      <div key={pIdx}>
                        {lines.map((line, lIdx) => {
                          if (line.startsWith('•')) {
                            return (
                              <p key={lIdx} className="flex gap-2 leading-relaxed">
                                <span className="text-indigo-500 mt-1 shrink-0">•</span>
                                <span>{line.slice(1).trim()}</span>
                              </p>
                            );
                          }
                          return <p key={lIdx}>{renderBold(line)}</p>;
                        })}
                      </div>
                    );
                  }
                  return <p key={pIdx}>{renderBold(para)}</p>;
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 space-x-4 rtl:space-x-reverse">
          <Link to="/privacy" className="inline-flex min-h-11 items-center hover:text-indigo-600 transition-colors underline">
            {t('legal.privacy')}
          </Link>
          <span>·</span>
          <a href="mailto:support@sipurai.ai" className="inline-flex min-h-11 items-center hover:text-indigo-600 transition-colors">
            support@sipurai.ai
          </a>
        </div>
      </div>
    </div>
  );
};

function renderBold(text) {
  if (!text.includes('**')) return text;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-gray-800 dark:text-gray-200">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

export default TermsOfService;
