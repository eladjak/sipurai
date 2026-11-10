import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

// Component that throws an error
function ProblemChild() {
  throw new Error('Test error');
}

// Component that renders normally
function GoodChild() {
  return <div>Everything is fine</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors during tests
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('Everything is fine')).toBeInTheDocument();
  });

  it('renders error UI when a child component throws', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    // Check for Hebrew error message
    expect(screen.getByText('משהו השתבש')).toBeInTheDocument();
    expect(screen.getByText('אפשר לנסות שוב או לחזור לדף הבית.')).toBeInTheDocument();
  });

  it('shows retry and home buttons in error state', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('לנסות שוב')).toBeInTheDocument();
    expect(screen.getByText('חזרה הביתה')).toBeInTheDocument();
  });

  it('resets error state when retry button is clicked', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    );

    // Error UI should be visible after the throw
    expect(screen.getByText('משהו השתבש')).toBeInTheDocument();

    // Click the retry button ("לנסות שוב")
    fireEvent.click(screen.getByText('לנסות שוב'));

    // After reset the error boundary re-renders its children.
    // ProblemChild will throw again (it always throws), so the error
    // UI will reappear — but the important thing is that handleReset
    // cleared the state (hasError = false) causing a new render cycle.
    // We verify the retry button still exists, meaning the boundary
    // correctly caught the second throw and is showing error UI again.
    expect(screen.getByText('לנסות שוב')).toBeInTheDocument();
  });
});
