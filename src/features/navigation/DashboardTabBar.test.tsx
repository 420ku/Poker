/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Pressable } from 'react-native';
import { DashboardTabBar } from './DashboardTabBar';

test('renders Play, Wallet, and Profile tabs', () => {
  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <DashboardTabBar activeTab="play" onTabPress={jest.fn()} />,
    );
  });

  const screen = JSON.stringify(renderer?.toJSON());

  expect(screen).toContain('PLAY');
  expect(screen).toContain('WALLET');
  expect(screen).toContain('PROFILE');
  expect(renderer?.root.findAllByType(Pressable)).toHaveLength(3);
});

test('marks active tab and reports tab selection', () => {
  const onTabPress = jest.fn();
  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;

  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <DashboardTabBar activeTab="wallet" onTabPress={onTabPress} />,
    );
  });

  const tabs = renderer?.root.findAllByType(Pressable) ?? [];

  expect(tabs[1].props.accessibilityState).toEqual({ selected: true });
  expect(tabs[0].props.accessibilityState).toEqual({ selected: false });

  ReactTestRenderer.act(() => {
    tabs[2].props.onPress();
  });

  expect(onTabPress).toHaveBeenCalledWith('profile');
});
