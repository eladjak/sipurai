import { motion } from 'framer-motion';
import { Palette, Globe, UserCircle, Trophy, Smartphone, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/components/i18n/i18nProvider';

const featureImages = [
  '/images/feature-art-styles.jpg',
  '/images/feature-trilingual.jpg',
  '/images/feature-characters.jpg',
  '/images/feature-gamification.jpg',
  '/images/feature-devices.jpg',
  '/images/feature-community.jpg',
];

const FeaturesSection = () => {
  const { t, isRTL } = useI18n();

  const features = [
    {
      icon: Palette,
      title: t('landing.features.artStyles.title'),
      description: t('landing.features.artStyles.description'),
      color: 'from-pink-500 to-rose-500',
      bgColor: 'bg-pink-50 dark:bg-pink-950/20',
      image: featureImages[0],
    },
    {
      icon: Globe,
      title: t('landing.features.trilingual.title'),
      description: t('landing.features.trilingual.description'),
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      image: featureImages[1],
    },
    {
      icon: UserCircle,
      title: t('landing.features.characters.title'),
      description: t('landing.features.characters.description'),
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50 dark:bg-amber-950/20',
      image: featureImages[2],
    },
    {
      icon: Trophy,
      title: t('landing.features.gamification.title'),
      description: t('landing.features.gamification.description'),
      color: 'from-emerald-500 to-green-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
      image: featureImages[3],
    },
    {
      icon: Smartphone,
      title: t('landing.features.pwa.title'),
      description: t('landing.features.pwa.description'),
      color: 'from-purple-500 to-violet-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      image: featureImages[4],
    },
    {
      icon: Users,
      title: t('landing.features.community.title'),
      description: t('landing.features.community.description'),
      color: 'from-indigo-500 to-blue-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/20',
      image: featureImages[5],
    },
  ];

  return (
    <section
      id="features"
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
            {t('landing.features.sectionTitle')}
          </h2>
          <div className="mx-auto w-24 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-full mb-6" />
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('landing.features.sectionSubtitle')}
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                whileHover={{ scale: 1.03, y: -4 }}
                className="group"
              >
                <Card className="h-full border-0 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
                  {/* Feature image */}
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={feature.image}
                      alt={feature.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${feature.color} opacity-30`} />
                    <div
                      className={`absolute bottom-3 ${isRTL ? 'right-3' : 'left-3'} w-12 h-12 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm flex items-center justify-center shadow-lg`}
                    >
                      <div className={`bg-gradient-to-br ${feature.color} rounded-lg p-2`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Decorative divider illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 flex justify-center"
        >
          <div className="flex items-center gap-4 text-purple-300 dark:text-purple-700">
            <div className="w-16 h-px bg-purple-200 dark:bg-purple-800" />
            <Palette className="h-5 w-5" />
            <div className="w-16 h-px bg-purple-200 dark:bg-purple-800" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
