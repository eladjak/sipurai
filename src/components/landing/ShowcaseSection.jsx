import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/i18n/i18nProvider';
import demoBooks from '@/data/demoBooks';
import DemoBookViewer from './DemoBookViewer';

const bookColors = [
  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
];

const genreLabels = {
  fantasy: { he: 'פנטזיה', en: 'Fantasy' },
  'science-fiction': { he: 'מדע בדיוני', en: 'Sci-Fi' },
  adventure: { he: 'הרפתקאות', en: 'Adventure' },
};

const ShowcaseSection = () => {
  const { t, isRTL, language } = useI18n();
  const [selectedBook, setSelectedBook] = useState(null);

  const sampleBooks = demoBooks.map((book, index) => ({
    ...book,
    displayTitle:
      language === 'en' ? book.title.en : book.title.he,
    displayGenre:
      language === 'en'
        ? genreLabels[book.genre]?.en || book.genre
        : genreLabels[book.genre]?.he || book.genre,
    color: bookColors[index],
  }));

  return (
    <section
      id="showcase"
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
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
            {t('landing.showcase.sectionTitle')}
          </h2>
          <div className="mx-auto w-24 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-full mb-6" />
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('landing.showcase.sectionSubtitle')}
          </p>
        </motion.div>

        {/* Books grid / horizontal scroll on mobile */}
        <div className="flex gap-6 sm:gap-8 overflow-x-auto pb-4 snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
          {sampleBooks.map((book, index) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              whileHover={{ y: -8 }}
              className="min-w-[280px] sm:min-w-0 snap-center group"
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700">
                {/* Book cover — real generated artwork when available, gradient fallback */}
                <div className="relative aspect-[4/5] overflow-hidden">
                  {book.cover_image ? (
                    <img
                      src={book.cover_image}
                      alt={book.displayTitle}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div
                      className={`w-full h-full bg-gradient-to-br ${book.cover_gradient} group-hover:scale-105 transition-transform duration-500`}
                    />
                  )}
                  {/* Title overlay */}
                  <div className={`absolute inset-0 flex flex-col items-center p-4 text-white ${book.cover_image ? 'justify-start pt-5' : 'justify-center'}`}>
                    {!book.cover_image && <BookOpen className="h-12 w-12 mb-3 opacity-80" />}
                    <p className="text-center font-bold text-base leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                      {book.displayTitle}
                    </p>
                  </div>
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/30 via-transparent ${book.cover_image ? 'to-black/35' : 'to-transparent'}`} />
                  {/* Genre badge */}
                  <div
                    className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'}`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${book.color} backdrop-blur-sm`}
                    >
                      <Sparkles className="h-3 w-3" />
                      {book.displayGenre}
                    </span>
                  </div>
                  {/* Age badge */}
                  <div
                    className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'}`}
                  >
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/80 text-gray-700 backdrop-blur-sm">
                      {t('showcase.ageRange', { range: book.age_range })}
                    </span>
                  </div>
                </div>

                {/* Book info */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {book.displayTitle}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-1 italic">
                    {book.moral}
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/30"
                      onClick={() => setSelectedBook(book)}
                    >
                      <BookOpen className="h-4 w-4" />
                      {t('landing.showcase.readSample')}
                    </Button>
                    {/* Fix 5: How it was made */}
                    <a
                      href="#how-it-works"
                      className={`flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors ${isRTL ? 'flex-row-reverse justify-end' : 'justify-center'}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <Info className="h-3 w-3" />
                      {t('showcase.howItWasMade')}
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Demo Book Viewer Modal */}
      <DemoBookViewer
        book={selectedBook}
        open={selectedBook !== null}
        onClose={() => setSelectedBook(null)}
      />
    </section>
  );
};

export default ShowcaseSection;
