import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Quote, Shield, ShieldCheck, Ban } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/components/i18n/i18nProvider';

const TestimonialsSection = () => {
  const { t, isRTL } = useI18n();

  // ageBadge: child age range shown on each card (null = no badge for that testimonial)
  const ageBadges = [
    { label: t('testimonials.age7'), color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
    { label: t('testimonials.ages5to9'), color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
    { label: t('testimonials.age6'), color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    { label: t('testimonials.age4'), color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    { label: t('testimonials.ages4to10'), color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
    null, // kindergarten teacher — no child age badge
  ];

  const testimonials = [
    {
      name: t('landing.testimonials.t1.name'),
      role: t('landing.testimonials.t1.role'),
      quote: t('landing.testimonials.t1.quote'),
      initials: t('landing.testimonials.t1.initials'),
      gradient: 'from-purple-400 to-indigo-500',
      stars: 5,
      ageBadge: ageBadges[0],
    },
    {
      name: t('landing.testimonials.t2.name'),
      role: t('landing.testimonials.t2.role'),
      quote: t('landing.testimonials.t2.quote'),
      initials: t('landing.testimonials.t2.initials'),
      gradient: 'from-pink-400 to-rose-500',
      stars: 5,
      ageBadge: ageBadges[1],
    },
    {
      name: t('landing.testimonials.t3.name'),
      role: t('landing.testimonials.t3.role'),
      quote: t('landing.testimonials.t3.quote'),
      initials: t('landing.testimonials.t3.initials'),
      gradient: 'from-amber-400 to-orange-500',
      stars: 5,
      ageBadge: ageBadges[2],
    },
    {
      name: t('landing.testimonials.t4.name'),
      role: t('landing.testimonials.t4.role'),
      quote: t('landing.testimonials.t4.quote'),
      initials: t('landing.testimonials.t4.initials'),
      gradient: 'from-emerald-400 to-green-500',
      stars: 5,
      ageBadge: ageBadges[3],
    },
    {
      name: t('landing.testimonials.t5.name'),
      role: t('landing.testimonials.t5.role'),
      quote: t('landing.testimonials.t5.quote'),
      initials: t('landing.testimonials.t5.initials'),
      gradient: 'from-cyan-400 to-blue-500',
      stars: 5,
      ageBadge: ageBadges[4],
    },
    {
      name: t('landing.testimonials.t6.name'),
      role: t('landing.testimonials.t6.role'),
      quote: t('landing.testimonials.t6.quote'),
      initials: t('landing.testimonials.t6.initials'),
      gradient: 'from-violet-400 to-purple-500',
      stars: 4,
      ageBadge: ageBadges[5],
    },
  ];

  const trustBadges = [
    {
      icon: ShieldCheck,
      label: t('landing.testimonials.trustCoppa'),
      color: 'text-green-600 dark:text-green-400',
      href: '/privacy#coppa',
      tooltip: t('testimonials.coppaTooltip'),
    },
    { icon: Shield, label: t('landing.testimonials.trustChildSafe'), color: 'text-blue-600 dark:text-blue-400' },
    { icon: Ban, label: t('landing.testimonials.trustNoAds'), color: 'text-purple-600 dark:text-purple-400' },
  ];

  return (
    <section
      className="py-20 sm:py-28 bg-white dark:bg-gray-950"
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
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
            {t('landing.testimonials.sectionTitle')}
          </h2>
          <div className="mx-auto w-24 h-1.5 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 rounded-full mb-6" />
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('landing.testimonials.sectionSubtitle')}
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -4 }}
            >
              <Card className="h-full border-0 shadow-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                {/* Gradient top border */}
                <div className={`absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${testimonial.gradient}`} />
                <CardContent className="p-6 sm:p-8">
                  {/* Quote icon */}
                  <Quote className="h-8 w-8 text-purple-200 dark:text-purple-800 mb-4" />

                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${star <= testimonial.stars ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
                      />
                    ))}
                  </div>

                  {/* Quote */}
                  <blockquote className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed text-sm sm:text-base min-h-[80px]">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full bg-gradient-to-br ${testimonial.gradient} flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0`}
                    >
                      {testimonial.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {testimonial.name}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>

                  {/* Age-range badge */}
                  {testimonial.ageBadge && (
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${testimonial.ageBadge.color}`}
                      >
                        👶 {testimonial.ageBadge.label}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Testimonials disclaimer */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600"
        >
          {t('testimonials.disclaimer')}
        </motion.p>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10"
        >
          {trustBadges.map((badge, index) => {
            const Icon = badge.icon;
            const inner = (
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-full bg-gray-100 dark:bg-gray-800 ${badge.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                    {badge.label}
                  </span>
                  {badge.tooltip && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 block leading-tight">
                      {badge.tooltip}
                    </span>
                  )}
                </div>
              </div>
            );
            return badge.href ? (
              <Link
                key={index}
                to={badge.href}
                className="hover:opacity-80 transition-opacity"
                title={badge.tooltip}
              >
                {inner}
              </Link>
            ) : (
              <div key={index}>{inner}</div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
