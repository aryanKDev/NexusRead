import React, { useState, useRef, useCallback, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, BookOpen, Type, HelpCircle, FileText, Lightbulb, Loader2, BookText } from 'lucide-react';
import api from '../api/axios';

const TABS = [
  { id: 'ask', label: 'Ask', icon: HelpCircle, placeholder: 'Ask a question about the book…', endpoint: '/ai/ask', field: 'answer', bodyKey: 'question' },
  { id: 'summarize', label: 'Summarize', icon: FileText, placeholder: 'Paste a passage to summarize…', endpoint: '/ai/summarize', field: 'summary', bodyKey: 'text' },
  { id: 'chapter-summary', label: 'Chapter', icon: BookText, placeholder: 'Paste chapter text for a structured summary…', endpoint: '/ai/chapter-summary', field: 'summary', bodyKey: 'text' },
  { id: 'explain', label: 'Explain', icon: Type, placeholder: 'Paste a paragraph to explain…', endpoint: '/ai/explain', field: 'explanation', bodyKey: 'text' },
  { id: 'define', label: 'Define', icon: BookOpen, placeholder: 'Enter a word to define…', endpoint: '/ai/define', field: 'definition', bodyKey: 'word' },
  { id: 'smart-notes', label: 'Notes', icon: Lightbulb, placeholder: 'Paste your highlights (one per line)…', endpoint: '/ai/smart-notes', field: 'notes', bodyKey: null },
];

function Message({ role, content }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${role === 'user' ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        role === 'user'
          ? 'bg-violet-600 text-white'
          : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
      }`}>
        {role === 'user' ? 'U' : <Sparkles className="w-3.5 h-3.5" />}
      </div>
      <div className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        role === 'user'
          ? 'bg-violet-600 text-white rounded-tr-sm'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-sm'
      }`}>
        {content}
      </div>
    </motion.div>
  );
}

export default function AIAssistant({
  open = true,
  onClose,
  bookTitle: bookTitleProp = '',
  context: contextProp = '',
  // New props from Reader.jsx
  book,
  selectedText = '',
  currentPage,
}) {
  // Derive bookTitle and context from whichever props are available
  const bookTitle = bookTitleProp || book?.title || '';
  const context = contextProp || (book ? `Book: "${book.title}" by ${book.author || 'Unknown'}${currentPage ? `, currently on page ${currentPage}` : ''}` : '');

  const [activeTab, setActiveTab] = useState('ask');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', content: `Hi! I'm your AI reading assistant${bookTitle ? ` for "${bookTitle}"` : ''}. I can:\n• Answer questions about the book\n• Summarize passages\n• Explain complex paragraphs\n• Define words\n• Generate smart notes from your highlights\n\nHow can I help?` }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-populate input when text is selected in the Reader
  const prevSelectedText = useRef('');
  React.useEffect(() => {
    if (selectedText && selectedText !== prevSelectedText.current && open) {
      setInput(selectedText);
      prevSelectedText.current = selectedText;
    }
  }, [selectedText, open]);

  const currentTab = TABS.find((t) => t.id === activeTab) || TABS[0];

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let body = {};
      if (activeTab === 'smart-notes') {
        const lines = text.split('\n').filter(Boolean);
        body = { highlights: lines.map((l) => ({ text: l })) };
      } else if (activeTab === 'ask') {
        body = { question: text, context: context || bookTitle };
      } else if (activeTab === 'define') {
        body = { word: text, context };
      } else if (activeTab === 'chapter-summary') {
        body = { text, bookTitle };
      } else {
        body = { text, bookTitle };
      }

      const { data } = await api.post(currentTab.endpoint, body);
      const aiText = data?.data?.[currentTab.field] || 'No response received.';
      setMessages((prev) => [...prev, { role: 'ai', content: aiText }]);
    } catch (err) {
      const errMsg = err?.response?.data?.message || 'AI assistant is unavailable. Please check your GEMINI_API_KEY.';
      setMessages((prev) => [...prev, { role: 'ai', content: `⚠️ ${errMsg}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [input, loading, activeTab, context, bookTitle, currentTab]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: 380 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 380 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          className="fixed right-0 top-0 h-full w-full max-w-sm z-50 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-violet-600 to-indigo-600">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white" />
              <span className="font-bold text-white text-sm">AI Reading Assistant</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 overflow-x-auto no-scrollbar">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <Message key={i} role={msg.role} content={msg.content} />
            ))}
            {loading && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-violet-400"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 dark:border-gray-800 p-4">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentTab.placeholder}
                rows={2}
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="self-end p-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Shift+Enter for new line · Enter to send</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
