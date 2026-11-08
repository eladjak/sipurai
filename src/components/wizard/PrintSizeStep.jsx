import { PRINT_PRESETS } from '@/lib/printSpec';
import { pageCountFor } from '@/lib/bookRecipe';

export default function PrintSizeStep({ value, onChange, length, isRTL }) {
  const he = isRTL;
  return <section dir={he ? 'rtl' : 'ltr'} className="space-y-6">
    <div className="space-y-2"><h2 className="text-2xl font-bold text-gray-900 dark:text-white">{he ? 'איזה גודל יהיה לספר?' : 'Choose your book size'}</h2>
      <p className="text-gray-600 dark:text-gray-300">{he ? 'הבחירה קובעת את צורת האיורים שניצור. אפשר לחזור ולשנות לפני יצירת הספר.' : 'Your choice guides the shape of the illustrations. You can change it before creating the book.'}</p></div>
    <fieldset><legend className="sr-only">{he ? 'גודל הספר' : 'Book size'}</legend>
      <div className="grid gap-3 sm:grid-cols-3">{PRINT_PRESETS.map((preset, index) => <label key={preset.id} className={`relative flex min-h-[180px] cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 p-4 text-center transition-colors focus-within:ring-2 focus-within:ring-purple-600 focus-within:ring-offset-2 ${value === preset.id ? 'border-purple-600 bg-purple-50 dark:bg-purple-950' : 'border-gray-200 dark:border-gray-600'}`}>
        <input className="absolute top-4 right-4 h-5 w-5 accent-purple-700" type="radio" name="print-size" value={preset.id} checked={value === preset.id} onChange={() => onChange(preset.id)} />
        <span aria-hidden="true" className="flex h-20 items-end justify-center"><span className="block rounded-sm border-2 border-purple-500 bg-purple-100 shadow-sm" style={{ width: `${preset.widthMm / 3}px`, height: `${preset.heightMm / 3}px` }} /></span>
        <span className="font-bold text-gray-900 dark:text-white" dir="ltr">{preset.widthMm / 10} × {preset.heightMm / 10} {he ? 'ס״מ' : 'cm'}</span>
        <span className="text-sm text-gray-600 dark:text-gray-300">{index === 0 ? (he ? 'מומלץ' : 'Recommended') : index === 1 ? (he ? 'ריבועי וקומפקטי' : 'Compact square') : (he ? 'לאורך' : 'Portrait')}</span>
      </label>)}</div>
    </fieldset>
    <p className="text-sm text-gray-700 dark:text-gray-200">{he ? `בספר מתוכננים ${pageCountFor(length)} עמודים. מחיר ללקוח עדיין לא זמין.` : `${pageCountFor(length)} pages are planned. Customer pricing is not available yet.`}</p>
    <details className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200"><summary className="min-h-11 cursor-pointer font-semibold">{he ? 'איך בוחרים גודל?' : 'How do I choose?'}</summary><p>{he ? 'הריבועי מתאים לספר תמונות מאוזן; הפורמט הארוך מתאים לקומפוזיציה אנכית. פורמט התמונה נבחר לפי האפשרויות של מחולל האיורים, ולכן ייתכנו שוליים בהתאמה לדף. ההדפסה והמחיר כפופים לאימות.' : 'Square works well for a balanced picture book; portrait suits vertical compositions. Image generators use their nearest supported ratio, so a page may have margins. Printing and pricing require verification.'}</p></details>
  </section>;
}
