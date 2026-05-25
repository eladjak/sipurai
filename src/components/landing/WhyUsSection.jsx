import { motion } from 'framer-motion';
import { useI18n } from '@/components/i18n/i18nProvider';
import {
  Sparkles, Shield, Globe, Palette, Gamepad2, Heart,
  Zap, BookOpen, Users
} from 'lucide-react';

const WhyUsSection = () => {
  const { t, isRTL } = useI18n();

  const advantages = [
    {
      icon: Sparkles,
      gradient: 'from-purple-500 to-indigo-500',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      titleKey: 'landing.whyUs.personalized.title',
      descKey: 'landing.whyUs.personalized.description',
    },
    {
      icon: Shield,
      gradient: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      titleKey: 'landing.whyUs.safety.title',
      descKey: 'landing.whyUs.safety.description',
    },
    {
      icon: Globe,
      gradient: 'from-blue-500 to-cyan-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      titleKey: 'landing.whyUs.trilingual.title',
      descKey: 'landing.whyUs.trilingual.description',
    },
    {
      icon: Palette,
      gradient: 'from-pink-500 to-rose-500',
      bg: 'bg-pink-50 dark:bg-pink-900/20',
      titleKey: 'landing.whyUs.artStyles.title',
      descKey: 'landing.whyUs.artStyles.description',
    },
    {
      icon: Gamepad2,
      gradient: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      titleKey: 'landing.whyUs.gamification.title',
      descKey: 'landing.whyUs.gamification.description',
    },
    {
      icon: Heart,
      gradient: 'from-red-500 to-pink-500',
      bg: 'bg-red-50 dark:bg-red-900/20',
      titleKey: 'landing.whyUs.community.title',
      descKey: 'landing.whyUs.community.description',
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Zap className="h-4 w-4" />
            {t('landing.whyUs.badge')}
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
            {t('landing.whyUs.sectionTitle')}
          </h2>
          <div className="mx-auto w-24 h-1.5 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 rounded-full mb-6" />
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('landing.whyUs.sectionSubtitle')}
          </p>
        </motion.div>

        {/* Advantages Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {advantages.map((adv, index) => {
            const Icon = adv.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.03, y: -4 }}
                className="relative group"
              >
                <div className={`${adv.bg} rounded-2xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800 hover:shadow-xl transition-all duration-300 h-full`}>
                  {/* Icon */}
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${adv.gradient} text-white mb-4 shadow-lg`}>
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {t(adv.titleKey)}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {t(adv.descKey)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom comparison banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex flex-wrap items-center justify-center gap-4 sm:gap-6 bg-white dark:bg-gray-800 rounded-2xl px-6 sm:px-10 py-5 shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <BookOpen className="h-5 w-5 text-purple-500" />
              {t('landing.whyUs.compare1')}
            </div>
            <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-600" />
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Users className="h-5 w-5 text-emerald-500" />
              {t('landing.whyUs.compare2')}
            </div>
            <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-600" />
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Shield className="h-5 w-5 text-blue-500" />
              {t('landing.whyUs.compare3')}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default WhyUsSection;
