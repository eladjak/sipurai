import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, BookOpen, Star, Wand2, Palette, Heart, Feather, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n/i18nProvider';

const FloatingShape = ({ className, delay = 0, duration = 6, children }) => (
  <motion.div
    className={`absolute pointer-events-none ${className}`}
    animate={{
      y: [0, -20, 0],
      rotate: [0, 10, -10, 0],
      opacity: [0.3, 0.6, 0.3],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  >
    {children}
  </motion.div>
);

const AnimatedStat = ({ value, label, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 1.2 + delay, duration: 0.5 }}
    className="text-center"
  >
    <div className="text-2xl sm:text-3xl font-extrabold text-white">{value}</div>
    <div className="text-xs sm:text-sm text-purple-200 mt-1">{label}</div>
  </motion.div>
);

const HeroSection = () => {
  const { t, isRTL } = useI18n();

  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-label={t('landing.hero.sectionLabel') || 'Hero'}
    >
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img
          src="/images/hero-banner.jpg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/85 via-purple-700/80 to-indigo-800/85" />
      </div>

      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0 opacity-20"
        animate={{
          background: [
            'radial-gradient(circle at 20% 50%, rgba(120,60,200,0.5) 0%, transparent 50%)',
            'radial-gradient(circle at 80% 50%, rgba(120,60,200,0.5) 0%, transparent 50%)',
            'radial-gradient(circle at 50% 20%, rgba(120,60,200,0.5) 0%, transparent 50%)',
            'radial-gradient(circle at 20% 50%, rgba(120,60,200,0.5) 0%, transparent 50%)',
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating decorative shapes — purely decorative, hidden from AT */}
      <div aria-hidden="true">
      <FloatingShape className="top-20 start-[10%]" delay={0} duration={7}>
        <BookOpen className="h-12 w-12 text-white/20" />
      </FloatingShape>
      <FloatingShape className="top-40 end-[15%]" delay={1} duration={5}>
        <Star className="h-10 w-10 text-yellow-300/30" />
      </FloatingShape>
      <FloatingShape className="bottom-32 start-[20%]" delay={2} duration={6}>
        <Sparkles className="h-8 w-8 text-purple-300/30" />
      </FloatingShape>
      <FloatingShape className="top-60 start-[60%]" delay={0.5} duration={8}>
        <Wand2 className="h-9 w-9 text-white/15" />
      </FloatingShape>
      <FloatingShape className="bottom-40 end-[25%]" delay={1.5} duration={6}>
        <Star className="h-6 w-6 text-yellow-200/25" />
      </FloatingShape>
      <FloatingShape className="top-32 start-[45%]" delay={3} duration={7}>
        <BookOpen className="h-7 w-7 text-white/10" />
      </FloatingShape>
      <FloatingShape className="top-16 end-[40%]" delay={2.5} duration={9}>
        <Palette className="h-10 w-10 text-pink-300/20" />
      </FloatingShape>
      <FloatingShape className="bottom-48 start-[5%]" delay={1.8} duration={7}>
        <Heart className="h-6 w-6 text-rose-300/25" />
      </FloatingShape>
      <FloatingShape className="top-72 end-[8%]" delay={0.8} duration={6}>
        <Feather className="h-8 w-8 text-white/15" />
      </FloatingShape>
      <FloatingShape className="bottom-20 end-[50%]" delay={3.5} duration={8}>
        <PenTool className="h-7 w-7 text-purple-200/20" />
      </FloatingShape>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className={`text-center lg:text-start ${isRTL ? 'lg:order-1' : ''}`}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2 mb-6 border border-white/10"
            >
              <Sparkles className="h-4 w-4 text-yellow-300" />
              <span className="text-sm text-white/90 font-medium">{t('landing.hero.badge')}</span>
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6">
              <span className="text-white">{t('landing.hero.titleLine1')}</span>
              <br />
              <span className="bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
                {t('landing.hero.titleLine2')}
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-purple-100 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              {t('landing.hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link to="/sign-up">
                <motion.div
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Button
                    size="lg"
                    className="bg-white text-purple-700 hover:bg-gray-100 shadow-2xl text-lg px-10 py-7 rounded-2xl font-bold w-full sm:w-auto"
                  >
                    <Wand2 className="h-6 w-6" />
                    {t('landing.hero.primaryCta')}
                  </Button>
                </motion.div>
              </Link>
              <a
                href="#showcase"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Button
                  size="lg"
                  variant="ghost"
                  className="bg-white/15 border-2 border-white/50 text-white hover:bg-white/25 hover:border-white/70 hover:text-white backdrop-blur-sm text-lg px-10 py-7 rounded-2xl font-medium w-full sm:w-auto transition-all duration-200"
                >
                  <BookOpen className="h-6 w-6" />
                  {t('landing.hero.secondaryCta')}
                </Button>
              </a>
            </div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-8 flex items-center gap-4 justify-center lg:justify-start text-white/70 text-sm"
            >
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-300 to-indigo-400 border-2 border-white/30 flex items-center justify-center text-xs text-white font-bold"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span>{t('landing.hero.socialProof')}</span>
            </motion.div>
          </motion.div>

          {/* Right side — Hero image with stats */}
          <div className={`flex flex-col items-center gap-8 ${isRTL ? 'lg:order-0' : ''}`}>
            {/* Hero illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
              className="relative w-72 sm:w-80 md:w-96 mx-auto"
            >
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20">
                <img
                  src="/images/book-wizard.jpg"
                  alt={t('landing.hero.illustrationAlt') || 'Child creating a personalized storybook with AI'}
                  className="w-full h-auto object-cover aspect-[3/4]"
                />
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                  animate={{ x: [-300, 500] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
                />
              </div>
              {/* Shadow */}
              <div className="absolute -bottom-4 inset-x-8 h-8 bg-black/15 rounded-full blur-xl" />
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="flex gap-6 sm:gap-10 bg-white/10 backdrop-blur-md rounded-2xl px-6 sm:px-8 py-4 border border-white/10"
            >
              <AnimatedStat value={t('landing.hero.stat1Value')} label={t('landing.hero.stat1Label')} delay={0} />
              <div className="w-px bg-white/20" />
              <AnimatedStat value={t('landing.hero.stat2Value')} label={t('landing.hero.stat2Label')} delay={0.15} />
              <div className="w-px bg-white/20" />
              <AnimatedStat value={t('landing.hero.stat3Value')} label={t('landing.hero.stat3Label')} delay={0.3} />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 inset-x-0">
        <svg viewBox="0 0 1440 120" fill="none" className="w-full">
          <path
            d="M0,80 C360,120 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z"
            fill="white"
            className="dark:fill-gray-950"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
