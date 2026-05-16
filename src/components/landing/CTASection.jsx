import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n/i18nProvider';

const CTASection = () => {
  const { t, isRTL } = useI18n();

  return (
    <section
      className="relative py-24 sm:py-32 overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img
          src="/images/welcome-portal.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-purple-700/85 to-indigo-900/90" />
      </div>

      {/* Floating sparkles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            top: `${15 + Math.random() * 70}%`,
            left: `${5 + Math.random() * 90}%`,
          }}
          animate={{
            y: [0, -15, 0],
            opacity: [0.2, 0.5, 0.2],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 3 + Math.random() * 3,
            delay: i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-300/40" />
        </motion.div>
      ))}

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-6 leading-tight">
            {t('landing.cta.headline')}
          </h2>
          <p className="text-lg sm:text-xl text-purple-200 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('landing.cta.subheadline')}
          </p>

          <Link to="/sign-up">
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-block"
            >
              <Button
                size="lg"
                className="bg-white text-purple-700 hover:bg-gray-100 shadow-2xl text-lg sm:text-xl px-12 py-8 rounded-2xl font-bold"
              >
                <Wand2 className="h-6 w-6" />
                {t('landing.cta.button')}
                <Sparkles className="h-5 w-5 text-yellow-500" />
              </Button>
            </motion.div>
          </Link>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-6 text-sm text-purple-300"
          >
            {t('landing.cta.note')}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
