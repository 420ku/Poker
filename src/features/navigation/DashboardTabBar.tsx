import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type DashboardTab = 'play' | 'wallet' | 'profile';

interface DashboardTabBarProps {
  activeTab: DashboardTab;
  onTabPress: (tab: DashboardTab) => void;
}

const TABS: { id: DashboardTab; label: string; icon: string }[] = [
  { id: 'play', label: 'PLAY', icon: '▶' },
  { id: 'wallet', label: 'WALLET', icon: '▣' },
  { id: 'profile', label: 'PROFILE', icon: '●' },
];

export function DashboardTabBar({ activeTab, onTabPress }: DashboardTabBarProps) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {TABS.map(tab => {
        const selected = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => onTabPress(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              selected && styles.tabSelected,
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.icon, selected && styles.iconSelected]}>{tab.icon}</Text>
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 66, flexDirection: 'row', alignItems: 'stretch',
    paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4,
    backgroundColor: '#0b2117', borderTopWidth: 1, borderTopColor: '#284534',
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, gap: 3,
  },
  tabSelected: { backgroundColor: '#173426' },
  icon: { color: '#789082', fontSize: 17, fontWeight: '900' },
  iconSelected: { color: '#d5b36a' },
  label: { color: '#789082', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  labelSelected: { color: '#e6d095' },
  pressed: { opacity: 0.72 },
});
