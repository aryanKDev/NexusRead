/**
 * Frontend Component Tests — AuthContext
 * Tests the AuthContext provider's state management.
 * All HTTP calls are mocked — no real backend needed.
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext, AuthProvider } from '../context/AuthContext';
import { useContext } from 'react';

// Access the mocked api module
import api, { setOnUnauthorized, setTokenHandlers } from '../api/axios';

// ── Test consumer component ────────────────────────────────────────────────────
function AuthConsumer() {
  const auth = useContext(AuthContext);
  return (
    <div>
      <span data-testid="loading">{auth.loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{auth.user ? auth.user.name : 'null'}</span>
      <span data-testid="error">{auth.error || 'none'}</span>
      <button onClick={async () => { try { await auth.login('test@example.com', 'password'); } catch (_) {} }} data-testid="login-btn">
        Login
      </button>
      <button onClick={() => auth.logout()} data-testid="logout-btn">
        Logout
      </button>
      <button
        onClick={async () => { try { await auth.register('New User', 'new@example.com', 'password'); } catch (_) {} }}
        data-testid="register-btn"
      >
        Register
      </button>
    </div>
  );
}

const renderWithAuth = () => {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
};

// ─── INITIAL MOUNT ─────────────────────────────────────────────────────────────
describe('AuthContext — initial state', () => {
  beforeEach(() => {
    // Default: refresh fails (no session), /auth/me not called
    api.post.mockRejectedValue({ response: { status: 401 } });
  });

  test('renders loading state initially then transitions to ready', async () => {
    renderWithAuth();
    // Initially loading
    expect(screen.getByTestId('loading').textContent).toBe('loading');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });
  });

  test('user is null when refresh fails (no active session)', async () => {
    renderWithAuth();
    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  test('user is set when refresh and /auth/me succeed', async () => {
    api.post.mockResolvedValueOnce({
      data: { data: { accessToken: 'test-access-token' } },
    });
    api.get.mockResolvedValueOnce({
      data: { data: { user: { _id: '123', name: 'Alice', email: 'alice@test.com', role: 'user' } } },
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Alice');
    });
  });
});

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
describe('AuthContext — login', () => {
  beforeEach(async () => {
    // Refresh fails (no initial session)
    api.post.mockRejectedValueOnce({ response: { status: 401 } });
  });

  test('login sets user on success', async () => {
    const user = userEvent.setup();

    // On login, post to /auth/login succeeds
    api.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'new-token',
          user: { _id: '456', name: 'Bob', email: 'bob@test.com', role: 'user' },
        },
      },
    });

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    await user.click(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Bob');
    });
  });

  test('login sets error on 401 response', async () => {
    const user = userEvent.setup();

    api.post.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Invalid email or password.' } },
    });

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    // Click login — AuthContext.login throws, consumer button catches nothing (error is set in context)
    await act(async () => {
      try { await user.click(screen.getByTestId('login-btn')); } catch (_) { /* swallowed */ }
    });

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toContain('Invalid');
    });
  });

  test('login sets banned error message on 403 banned response', async () => {
    const user = userEvent.setup();

    api.post.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { message: 'Your account has been banned. Please contact support.' },
      },
    });

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    await act(async () => {
      try { await user.click(screen.getByTestId('login-btn')); } catch (_) { /* swallowed */ }
    });

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toContain('banned');
    });
  });
});

// ─── LOGOUT ────────────────────────────────────────────────────────────────────
describe('AuthContext — logout', () => {
  test('logout clears user state', async () => {
    const user = userEvent.setup();

    // Initial auth: refresh succeeds
    api.post
      .mockResolvedValueOnce({
        data: { data: { accessToken: 'tok' } },
      })
      .mockResolvedValueOnce({}); // logout call

    api.get.mockResolvedValueOnce({
      data: { data: { user: { _id: '789', name: 'Carol', email: 'carol@test.com', role: 'user' } } },
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Carol');
    });

    await user.click(screen.getByTestId('logout-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null');
    });
  });
});

// ─── REGISTER ─────────────────────────────────────────────────────────────────
describe('AuthContext — register', () => {
  beforeEach(() => {
    // Initial refresh fails
    api.post.mockRejectedValueOnce({ response: { status: 401 } });
  });

  test('register sets user on success', async () => {
    const user = userEvent.setup();

    api.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'reg-token',
          user: { _id: 'r1', name: 'New User', email: 'new@example.com', role: 'user' },
        },
      },
    });

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    await user.click(screen.getByTestId('register-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('New User');
    });
  });

  test('register sets error message on failure', async () => {
    const user = userEvent.setup();

    api.post.mockRejectedValueOnce({
      response: { status: 400, data: { message: 'User with this email already exists.' } },
    });

    renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    await act(async () => {
      try { await user.click(screen.getByTestId('register-btn')); } catch (_) { /* swallowed */ }
    });

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toContain('already exists');
    });
  });
});

// ─── setOnUnauthorized AND setTokenHandlers ────────────────────────────────────
describe('AuthContext — API integration wiring', () => {
  test('setOnUnauthorized and setTokenHandlers are called on mount', async () => {
    api.post.mockRejectedValueOnce({ response: { status: 401 } });

    renderWithAuth();

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    expect(setOnUnauthorized).toHaveBeenCalled();
    expect(setTokenHandlers).toHaveBeenCalled();
  });
});
