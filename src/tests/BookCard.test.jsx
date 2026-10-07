/**
 * Frontend Component Tests — BookCard (Explore variant)
 * Tests the BookCard component renders correctly and handles interactions.
 * Uses the actual BookCard component interface:
 *   book: { id, title, authors[], thumbnail, description, pageCount, publishedDate, source, previewLink, averageRating }
 *   onAdd, isAdded, isAdding
 */
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BookCard from '../components/BookCard';

// Mock framer-motion to avoid animation issues in jsdom
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

const defaultBook = {
  id: 'gb-book123',
  title: 'Test Book Title',
  authors: ['Test Author', 'Co-Author'],
  thumbnail: 'https://example.com/cover.jpg',
  description: 'A test description.',
  pageCount: 250,
  publishedDate: '2023',
  source: 'google',
  averageRating: 4,
};

const defaultProps = {
  book: defaultBook,
  onAdd: vi.fn(),
  isAdded: false,
  isAdding: false,
};

describe('BookCard rendering', () => {
  test('renders book title', () => {
    render(<BookCard {...defaultProps} />);
    expect(screen.getByText('Test Book Title')).toBeInTheDocument();
  });

  test('renders book author(s)', () => {
    render(<BookCard {...defaultProps} />);
    // formatAuthors('Test Author', 'Co-Author') renders both names
    expect(document.body.textContent).toContain('Test Author');
  });

  test('renders book cover image or fallback', () => {
    render(<BookCard {...defaultProps} />);
    const images = document.querySelectorAll('img');
    const hasImg = Array.from(images).some(i => i.src.includes('example.com'));
    const hasFallback = document.body.textContent.includes('No cover');
    expect(hasImg || hasFallback).toBe(true);
  });

  test('renders without crashing when thumbnail is empty string', () => {
    const bookWithoutCover = { ...defaultBook, thumbnail: '' };
    render(<BookCard book={bookWithoutCover} onAdd={vi.fn()} />);
    expect(screen.getByText('Test Book Title')).toBeInTheDocument();
    expect(document.body.textContent).toContain('No cover');
  });

  test('renders without crashing when authors is empty array', () => {
    const bookNoAuthors = { ...defaultBook, authors: [] };
    render(<BookCard book={bookNoAuthors} onAdd={vi.fn()} />);
    expect(screen.getByText('Test Book Title')).toBeInTheDocument();
  });
});

describe('BookCard interactions', () => {
  test('calls onAdd when Add to Library button is clicked', () => {
    const onAdd = vi.fn();
    render(<BookCard book={defaultBook} onAdd={onAdd} isAdded={false} isAdding={false} />);

    const addBtn = screen.getByRole('button', { name: /Add to Library/i });
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  test('shows different state when isAdded is true', () => {
    render(<BookCard book={defaultBook} onAdd={vi.fn()} isAdded={true} isAdding={false} />);
    const btn = document.querySelector('button');
    expect(btn).toBeInTheDocument();
    // When isAdded=true the button text changes
    expect(document.body.textContent).toMatch(/Added|In Library|✓/i);
  });
});

describe('BookCard data contract', () => {
  test('title and authors are rendered correctly', () => {
    render(<BookCard {...defaultProps} />);
    expect(document.body.textContent).toContain('Test Book Title');
    expect(document.body.textContent).toContain('Test Author');
  });

  test('handles missing optional fields gracefully', () => {
    const minimalBook = {
      id: 'min123',
      title: 'Minimal Book',
    };
    expect(() =>
      render(<BookCard book={minimalBook} onAdd={vi.fn()} />)
    ).not.toThrow();
    expect(screen.getByText('Minimal Book')).toBeInTheDocument();
  });
});
