import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { updateMeta, resetMeta } from '@/lib/seo';
import { policyContent as content } from '@/data/privacyPolicyContent';


const PrivacyPolicy = () => {
  const { language, isRTL } = useI18n();
  const lang = language === 'hebrew' || language === 'yiddish' ? 'he' : 'en';
  const c = content[lang];

  useEffect(() => {
    updateMeta({ title: c.metaTitle, description: c.metaDesc });
    return () => resetMeta();
  }, [c]);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-purple-200 hover:text-white transition-colors mb-8 text-sm font-medium"
          >
            <BackIcon className="h-4 w-4" />
            {c.backLink}
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <Shield className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-300" />
              <span className="text-purple-200 font-medium">Sipurai</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-2">{c.title}</h1>
          <p className="text-purple-200 text-sm">{c.subtitle}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          {c.sections.map((section, idx) => (
            <section
              key={idx}
              id={section.id || undefined}
              className={`px-6 sm:px-8 py-8 ${idx < c.sections.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
            >
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
                {section.heading}
              </h2>
              <div className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed space-y-3">
                {section.body.split('\n\n').map((para, pIdx) => {
                  if (!para.trim()) return null;
                  // Render bullet lists
                  if (para.includes('\n•')) {
                    const lines = para.split('\n');
                    return (
                      <div key={pIdx}>
                        {lines.map((line, lIdx) => {
                          if (line.startsWith('•')) {
                            return (
                              <p key={lIdx} className="flex gap-2 leading-relaxed">
                                <span className="text-purple-500 mt-1 shrink-0">•</span>
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
          <Link to="/terms" className="hover:text-purple-600 transition-colors underline">
            {lang === 'he' ? 'תנאי שימוש' : 'Terms of Service'}
          </Link>
          <span>·</span>
          <a href="mailto:support@sipurai.ai" className="hover:text-purple-600 transition-colors">
            support@sipurai.ai
          </a>
        </div>
      </div>
    </div>
  );
};

// Helper to render **bold** markdown syntax
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

export default PrivacyPolicy;
