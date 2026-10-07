/**
 * Vitest frontend test setup.
 * - Imports @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
 * - Mocks GSAP to prevent animation side effects in tests
 * - Mocks react-pdf to avoid worker/canvas errors in jsdom
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ── Mock GSAP globally (AddBookModal, etc. use it for animations) ──────────────
vi.mock('gsap', () => ({
  default: {
    fromTo: vi.fn(),
    to: vi.fn(),
    from: vi.fn(),
    set: vi.fn(),
    timeline: vi.fn(() => ({
      to: vi.fn(),
      from: vi.fn(),
      fromTo: vi.fn(),
      play: vi.fn(),
    })),
  },
  gsap: {
    fromTo: vi.fn(),
    to: vi.fn(),
    from: vi.fn(),
    set: vi.fn(),
  },
}));

// ── Mock react-pdf (PDF.js requires canvas which isn't available in jsdom) ────
vi.mock('react-pdf', () => {
  const React = require('react');
  return {
    Document: ({ children, onLoadSuccess }) => {
      if (onLoadSuccess) onLoadSuccess({ numPages: 10 });
      return React.createElement('div', { 'data-testid': 'pdf-document' }, children);
    },
    Page: ({ pageNumber }) =>
      React.createElement('div', { 'data-testid': `pdf-page-${pageNumber}` }),
    pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  };
});

// ── Mock axios api module (prevent real HTTP in component tests) ───────────────
vi.mock('../api/axios', () => {
  const mockApi = {
    post: vi.fn(() => Promise.resolve({ data: {} })),
    get: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: mockApi,
    setOnUnauthorized: vi.fn(),
    setTokenHandlers: vi.fn(),
  };
});

// ── Suppress console.error for expected React test warnings ──────────────────
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = (...args) => {
    // Suppress known act() warnings and prop type errors in tests
    const msg = args[0]?.toString() || '';
    if (
      msg.includes('Warning: An update to') ||
      msg.includes('ReactDOM.render') ||
      msg.includes('act(')
    ) return;
    originalConsoleError(...args);
  };
});

afterEach(() => {
  console.error = originalConsoleError;
  vi.clearAllMocks();
});
