import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, Sparkles } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';

/**
 * Interactive FAQ chat — Wave-12 (replaces accordion).
 * Powered by /api/chat-faq endpoint (Gemini Flash).
 *
 * Quick-pick suggestions appear initially. Free-form input always available.
 */

const SUGGESTED_HE = [
  'כמה זה עולה?',
  'אילו שפות נתמכות?',
  'כמה ספרים אפשר לעשות בחינם?',
  'האם אפשר להדפיס את הספר?',
  'כמה זמן לוקח לייצר ספר?',
  'מי מחזיק את זכויות הספר?',
];
const SUGGESTED_EN = [
  'How much does it cost?',
  'Which languages are supported?',
  'How many free books per month?',
  'Can I print the book?',
  'How long does generation take?',
  'Who owns the book rights?',
];

const FAQChat = () => {
  const { t, isRTL } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const suggested = isRTL ? SUGGESTED_HE : SUGGESTED_EN;

  useEffect(() => {
    if (messages.length > 0) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    const next = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const r = await fetch('/api/chat-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await r.json();
      const assistantMsg = data?.content || (isRTL ? 'סליחה, נסה שוב.' : 'Sorry, try again.');
      setMessages((m) => [...m, { role: 'assistant', content: assistantMsg }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: isRTL ? 'בעיה בחיבור. נסה שוב.' : 'Connection issue. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="faq"
      className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 rounded-full px-4 py-1.5 mb-4">
            <MessageCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              {isRTL ? 'שאלות ותשובות' : 'Q & A'}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
            {isRTL ? 'יש לך שאלה? תשאל אותנו!' : 'Got a question? Ask us!'}
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400">
            {isRTL ? 'צ׳אט חכם — תשובות תוך שניות' : 'AI chat — instant answers'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Messages */}
          <div className="px-5 py-4 max-h-96 overflow-y-auto space-y-3" style={{ minHeight: '300px' }}>
            {messages.length === 0 && !loading && (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                <Sparkles className="h-6 w-6 mx-auto mb-2 text-purple-400" />
                {isRTL ? 'בחר שאלה למטה או כתוב את שלך' : 'Pick a question below or type your own'}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-purple-600 text-white rounded-bl-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-br-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2.5 rounded-2xl rounded-br-sm">
                  <div className="flex gap-1">
                    <div className="size-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="size-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="size-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggested questions (only shown when no conversation yet) */}
          {messages.length === 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3 flex flex-wrap gap-2">
              {suggested.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={loading}
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-gray-100 dark:border-gray-700 px-5 py-3 flex gap-2 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRTL ? 'כתוב שאלה...' : 'Type a question...'}
              disabled={loading}
              className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label={isRTL ? 'שלח' : 'Send'}
              className="size-9 rounded-full bg-purple-600 text-white grid place-items-center disabled:opacity-40 hover:bg-purple-700 transition-colors"
            >
              <Send className="size-4" />
            </button>
          </form>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQChat;
