import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { BookOpen, Image, Palette, Globe } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';

const AnimatedCounter = ({ end, duration = 2, suffix = '', inView }) => {
  const [count, setCount] = useState(0);
  const numericEnd = parseInt(String(end).replace(/[^0-9]/g, ''), 10) || 0;

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.max(1, Math.floor(numericEnd / (duration * 60)));
    const timer = setInterval(() => {
      start += step;
      if (start >= numericEnd) {
        setCount(numericEnd);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, numericEnd, duration]);

  const formatted = count >= 1000 ? count.toLocaleString() : count;
  return <span>{formatted}{suffix}</span>;
};

const StatsSection = () => {
  const { t, isRTL } = useI18n();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const stats = [
    {
      icon: BookOpen,
      image: '/images/stats-books.jpg',
      value: 18,
      suffix: '',
      label: t('landing.stats.artStyles'),
      color: 'from-purple-400 to-indigo-500',
    },
    {
      icon: Image,
      image: '/images/stats-pages.jpg',
      value: 5,
      suffix: '',
      label: t('landing.stats.freeBooks'),
      color: 'from-pink-400 to-rose-500',
    },
    {
      icon: Palette,
      image: '/images/stats-styles.jpg',
      value: 18,
      suffix: '',
      label: t('landing.stats.artStyles'),
      color: 'from-amber-400 to-orange-500',
    },
    {
      icon: Globe,
      image: '/images/stats-languages.jpg',
      value: 3,
      suffix: '',
      label: t('landing.stats.languages'),
      color: 'from-emerald-400 to-green-500',
    },
  ];

  return (
    <section
      ref={ref}
      className="relative py-20 sm:py-24 overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Purple gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-700" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.1)_0%,_transparent_60%)]" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            {t('landing.stats.sectionTitle')}
          </h2>
          <p className="text-purple-200 text-lg max-w-lg mx-auto">
            {t('landing.stats.sectionSubtitle')}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-white/10 hover:bg-white/15 transition-colors duration-300">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <img
                      src={stat.image}
                      alt=""
                      aria-hidden="true"
                      className={`w-14 h-14 rounded-xl object-cover ring-2 ring-white/30 shadow-md`}
                    />
                  </div>
                  <div className="text-4xl sm:text-5xl font-extrabold text-white mb-2">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} inView={inView} />
                  </div>
                  <div className="text-sm sm:text-base text-purple-200 font-medium">
                    {stat.label}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
