/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Pressable } from 'react-native';
import { ProfileScreen } from './ProfileScreen';

test('shows Google account details and sign-out action', () => {
  const onSignOut = jest.fn();
  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ProfileScreen
        email="player@example.com"
        fullName="Poker Player"
        avatarUrl={null}
        userId="12345678-1234-1234-1234-123456789abc"
        createdAt="2026-01-15T08:00:00.000Z"
        signOutLoading={false}
        error=""
        onSignOut={onSignOut}
      />,
    );
  });

  const screen = JSON.stringify(renderer?.toJSON());

  expect(screen).toContain('Poker Player');
  expect(screen).toContain('player@example.com');
  expect(screen).toContain('GOOGLE ACCOUNT');
  expect(screen).toContain('ACCOUNT DETAILS');
  expect(screen).toContain('SIGN OUT');

  const signOutButton = renderer?.root.findAllByType(Pressable)[0];
  ReactTestRenderer.act(() => {
    signOutButton?.props.onPress();
  });

  expect(onSignOut).toHaveBeenCalledTimes(1);
});
