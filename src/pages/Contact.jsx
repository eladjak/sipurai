import React, { useState, useEffect } from 'react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { updateMeta, resetMeta } from '@/lib/seo';
import { motion } from 'framer-motion';
import { Mail, MessageSquare, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

const SUPPORT_EMAIL = 'support@sipurai.ai';

export default function Contact() {
  const { t, isRTL } = useI18n();

  useEffect(() => {
    const title = t('contact.meta.title') || (isRTL ? 'צור קשר · Sipurai' : 'Contact — Sipurai');
    const description = t('contact.meta.description') || (isRTL ? 'יצירת קשר עם צוות סיפוראי לתמיכה, משוב ושאלות.' : 'Contact the Sipurai team for support, feedback, or questions.');
    updateMeta({ title, description });
    return () => resetMeta();
  }, [t, isRTL]);

  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // `errors` is only ever populated by a submit attempt — the form must not
  // scold anyone for a field they have not finished typing yet.
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear this field's error as soon as the user starts correcting it.
    setErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  // Deliberately permissive: a contact form has no business rejecting an
  // address that is merely unusual. It only catches "this cannot be an email".
  const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t('contact.errors.name');
    if (!form.email.trim() || !looksLikeEmail(form.email)) next.email = t('contact.errors.email');
    if (!form.subject) next.subject = t('contact.errors.subject');
    if (!form.message.trim()) next.message = t('contact.errors.message');
    return next;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Move focus to the first invalid control, in DOM order. Without this a
      // keyboard or screen-reader user gets no signal at all that submit failed.
      const first = ['name', 'email', 'subject', 'message'].find(f => found[f]);
      requestAnimationFrame(() => {
        const el = first === 'subject'
          ? document.getElementById('contact-subject')
          : document.getElementById(`contact-${first}`);
        el?.focus();
      });
      return;
    }

    setSubmitting(true);

    // Build a mailto link as the fallback submission mechanism
    const subjectLabel = t(`contact.subjects.${form.subject}`) || form.subject;
    const body = `Name: ${form.name}\nEmail: ${form.email}\nSubject: ${subjectLabel}\n\n${form.message}`;
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[Sipurai] ${subjectLabel}`)}&body=${encodeURIComponent(body)}`;

    // Open mailto — this launches the user's email client
    window.open(mailtoUrl, '_blank');

    // Show confirmation that mailto was opened (not that email was sent)
    setSubmitting(false);
    setSubmitted(true);
  };

  const handleReset = () => {
    setForm({ name: '', email: '', subject: '', message: '' });
    setErrors({});
    setSubmitted(false);
  };

  // One error renderer so every field is announced the same way. The leading
  // icon plus the word "שגיאה"/"Error" in the string means the failure is never
  // carried by the red colour alone.
  const FieldError = ({ id, children }) =>
    children ? (
      <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-red-700 dark:text-red-300">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>{children}</span>
      </p>
    ) : null;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-purple-950/20"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white py-14 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-5 backdrop-blur-sm">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{t("contact.title")}</h1>
          <p className="text-purple-100 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            {t("contact.subtitle")}
          </p>
        </motion.div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-5 gap-8">

          {/* Left: Direct email card */}
          <motion.div
            className="md:col-span-2 space-y-4"
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="rounded-2xl border-0 shadow-md bg-white dark:bg-gray-900 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t("contact.emailLabel")}</h3>
                </div>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-purple-600 dark:text-purple-400 font-medium hover:underline break-all text-sm"
                >
                  {SUPPORT_EMAIL}
                </a>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {t("contact.responseTime")}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right: Contact form */}
          <motion.div
            className="md:col-span-3"
            initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Card className="rounded-2xl border-0 shadow-md bg-white dark:bg-gray-900 overflow-hidden">
              <CardContent className="p-6">
                {submitted ? (
                  <motion.div
                    className="text-center py-8"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                      <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {t("contact.successTitle")}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm leading-relaxed">
                      {t("contact.successText")}
                    </p>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/20"
                    >
                      {t("contact.sendAnother")}
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                    <h2 className={`text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t("contact.formTitle")}
                    </h2>

                    {/* Announced the moment a submit fails. role="alert" is an
                        implicit live region, so a screen reader reads it
                        without the user having to go looking. */}
                    <div role="alert" aria-live="assertive">
                      {Object.keys(errors).length > 0 && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{t("contact.errors.summary")}</span>
                        </div>
                      )}
                    </div>

                    {/* Name + Email row */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-name" className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'text-right block' : ''}`}>
                          {t("contact.name")}
                        </Label>
                        <Input
                          id="contact-name"
                          value={form.name}
                          onChange={e => handleChange('name', e.target.value)}
                          placeholder={t("contact.namePlaceholder")}
                          required
                          aria-required="true"
                          aria-invalid={errors.name ? 'true' : undefined}
                          aria-describedby={errors.name ? 'contact-name-error' : undefined}
                          className={`rounded-xl focus:ring-purple-400/20 ${errors.name ? 'border-red-500 dark:border-red-400 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-purple-400'}`}
                        />
                        <FieldError id="contact-name-error">{errors.name}</FieldError>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="contact-email" className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'text-right block' : ''}`}>
                          {t("contact.email")}
                        </Label>
                        <Input
                          id="contact-email"
                          type="email"
                          value={form.email}
                          onChange={e => handleChange('email', e.target.value)}
                          placeholder={t("contact.emailPlaceholder")}
                          required
                          aria-required="true"
                          aria-invalid={errors.email ? 'true' : undefined}
                          aria-describedby={errors.email ? 'contact-email-error' : undefined}
                          className={`rounded-xl focus:ring-purple-400/20 ${errors.email ? 'border-red-500 dark:border-red-400 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-purple-400'}`}
                          dir="ltr"
                        />
                        <FieldError id="contact-email-error">{errors.email}</FieldError>
                      </div>
                    </div>

                    {/* Subject */}
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-subject" className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'text-right block' : ''}`}>
                        {t("contact.subject")}
                      </Label>
                      <Select
                        value={form.subject}
                        onValueChange={val => handleChange('subject', val)}
                        required
                      >
                        <SelectTrigger
                          id="contact-subject"
                          aria-label={t("contact.subject")}
                          aria-required="true"
                          aria-invalid={errors.subject ? 'true' : undefined}
                          aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
                          className={`rounded-xl focus:ring-purple-400/20 ${errors.subject ? 'border-red-500 dark:border-red-400 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-purple-400'}`}
                        >
                          <SelectValue placeholder={t("contact.subjectPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">{t("contact.subjects.general")}</SelectItem>
                          <SelectItem value="bug">{t("contact.subjects.bug")}</SelectItem>
                          <SelectItem value="billing">{t("contact.subjects.billing")}</SelectItem>
                          <SelectItem value="feature">{t("contact.subjects.feature")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError id="contact-subject-error">{errors.subject}</FieldError>
                    </div>

                    {/* Message */}
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-message" className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${isRTL ? 'text-right block' : ''}`}>
                        {t("contact.message")}
                      </Label>
                      <Textarea
                        id="contact-message"
                        value={form.message}
                        onChange={e => handleChange('message', e.target.value)}
                        placeholder={t("contact.messagePlaceholder")}
                        required
                        aria-required="true"
                        aria-invalid={errors.message ? 'true' : undefined}
                        aria-describedby={errors.message ? 'contact-message-error' : undefined}
                        rows={5}
                        className={`rounded-xl focus:ring-purple-400/20 resize-none ${errors.message ? 'border-red-500 dark:border-red-400 focus:border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-purple-400'}`}
                      />
                      <FieldError id="contact-message-error">{errors.message}</FieldError>
                    </div>

                    {/* Deliberately NOT disabled-until-valid: a disabled submit
                        is unreachable by keyboard and explains nothing. Let it
                        be pressed, then say what is wrong. */}
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl py-5 font-semibold shadow-md transition-all"
                    >
                      {submitting ? (
                        <span className="flex items-center gap-2 justify-center">
                          <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          {t("contact.sending")}
                        </span>
                      ) : (
                        <span className={`flex items-center gap-2 justify-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Send className="h-4 w-4" />
                          {t("contact.send")}
                        </span>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
