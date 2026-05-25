import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowDown, Sparkles } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';

const HowItWorksSection = () => {
  const { t, isRTL } = useI18n();

  const steps = [
    {
      emoji: '💡',
      title: t('landing.howItWorks.step1.title'),
      subtitle: t('landing.howItWorks.step1.subtitle'),
      description: t('landing.howItWorks.step1.description'),
      color: 'from-yellow-400 to-amber-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
      number: '1',
    },
    {
      emoji: '🧒',
      title: t('landing.howItWorks.step2.title'),
      subtitle: t('landing.howItWorks.step2.subtitle'),
      description: t('landing.howItWorks.step2.description'),
      color: 'from-pink-400 to-rose-500',
      bgColor: 'bg-pink-50 dark:bg-pink-950/20',
      number: '2',
    },
    {
      emoji: '🎨',
      title: t('landing.howItWorks.step3.title'),
      subtitle: t('landing.howItWorks.step3.subtitle'),
      description: t('landing.howItWorks.step3.description'),
      color: 'from-purple-400 to-violet-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      number: '3',
    },
    {
      emoji: '📖',
      title: t('landing.howItWorks.step4.title'),
      subtitle: t('landing.howItWorks.step4.subtitle'),
      description: t('landing.howItWorks.step4.description'),
      color: 'from-emerald-400 to-green-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
      number: '4',
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
            {t('landing.howItWorks.sectionTitle')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('landing.howItWorks.sectionSubtitle')}
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative max-w-3xl mx-auto">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-0 bottom-0 start-1/2 w-0.5 bg-gradient-to-b from-purple-200 via-purple-300 to-purple-200 dark:from-purple-800 dark:via-purple-700 dark:to-purple-800 -translate-x-1/2" />

          {steps.map((step, index) => {
            const isEven = index % 2 === 0;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: isEven ? (isRTL ? 30 : -30) : (isRTL ? -30 : 30) }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="relative mb-12 last:mb-0"
              >
                {/* Mobile: stacked layout */}
                <div className="md:hidden flex flex-col items-center text-center">
                  {/* Step icon circle */}
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg mb-4 relative z-10`}>
                    <span className="text-2xl">{step.emoji}</span>
                  </div>
                  <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mb-1">
                    {t('landing.howItWorks.stepLabel')} {step.number}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">
                    {step.title}
                  </h3>
                  {step.subtitle && (
                    <p className="text-sm font-semibold text-purple-500 dark:text-purple-400 mb-2 italic">
                      {step.subtitle}
                    </p>
                  )}
                  <p className="text-gray-600 dark:text-gray-400 max-w-sm">
                    {step.description}
                  </p>
                  {index < steps.length - 1 && (
                    <ArrowDown className="h-6 w-6 text-purple-300 dark:text-purple-700 mt-4" />
                  )}
                </div>

                {/* Desktop: alternating layout */}
                <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] gap-8 items-center">
                  {/* Left content */}
                  <div className={`${isEven ? 'text-end' : ''}`}>
                    {isEven ? (
                      <div>
                        <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mb-1">
                          {t('landing.howItWorks.stepLabel')} {step.number}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">
                          {step.title}
                        </h3>
                        {step.subtitle && (
                          <p className="text-sm font-semibold text-purple-500 dark:text-purple-400 mb-2 italic">
                            {step.subtitle}
                          </p>
                        )}
                        <p className="text-gray-600 dark:text-gray-400">
                          {step.description}
                        </p>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>

                  {/* Center circle with emoji */}
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg relative z-10`}>
                    <span className="text-2xl">{step.emoji}</span>
                  </div>

                  {/* Right content */}
                  <div>
                    {!isEven ? (
                      <div>
                        <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mb-1">
                          {t('landing.howItWorks.stepLabel')} {step.number}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-0.5">
                          {step.title}
                        </h3>
                        {step.subtitle && (
                          <p className="text-sm font-semibold text-purple-500 dark:text-purple-400 mb-2 italic">
                            {step.subtitle}
                          </p>
                        )}
                        <p className="text-gray-600 dark:text-gray-400">
                          {step.description}
                        </p>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA after steps */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-16 flex justify-center"
        >
          <Link
            to="/sign-up"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
            aria-label={t('howItWorks.readyCtaAriaLabel')}
          >
            <Sparkles className="h-5 w-5 flex-shrink-0" />
            {t('howItWorks.readyCta')}
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
