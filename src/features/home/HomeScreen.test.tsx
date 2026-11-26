/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { HomeScreen } from './HomeScreen';

function createProps(isGoogleAccount: boolean) {
  return {
    gameMode: 'holdem' as const,
    onGameModeChange: jest.fn(),
    computerPlayers: 1,
    onComputerPlayersChange: jest.fn(),
    onStartGame: jest.fn(),
    hasSavedGame: true,
    onResumeGame: jest.fn(),
    cloudStatus: 'connected' as const,
    cloudMessage: '',
    isGoogleAccount,
    authLoading: false,
    authError: '',
    canSignInWithGoogle: true,
    onGoogleSignIn: jest.fn(),
  };
}

test('shows only Google sign-in while user is not Google-authenticated', () => {
  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<HomeScreen {...createProps(false)} />);
  });

  const screen = JSON.stringify(renderer?.toJSON());

  expect(screen).toContain('CONTINUE WITH GOOGLE');
  expect(screen).toContain('GOOGLE SIGN-IN REQUIRED');
  expect(screen).not.toContain('CHOOSE GAME MODE');
  expect(screen).not.toContain('TEXAS HOLD’EM');
  expect(screen).not.toContain('CHINESE POKER');
  expect(screen).not.toContain('DEMO WALLET');
  expect(screen).not.toContain('Resume Saved Game');
});

test('shows poker lobby only after Google authentication', () => {
  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<HomeScreen {...createProps(true)} />);
  });

  const screen = JSON.stringify(renderer?.toJSON());

  expect(screen).toContain('CHOOSE GAME MODE');
  expect(screen).toContain('TEXAS HOLD’EM');
  expect(screen).toContain('CHINESE POKER');
  expect(screen).not.toContain('DEMO WALLET');
  expect(screen).not.toContain('player@example.com');
  expect(screen).not.toContain('CONTINUE WITH GOOGLE');
});
