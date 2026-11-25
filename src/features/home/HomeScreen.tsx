import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface HomeScreenProps {
  computerPlayers: number;
  onComputerPlayersChange: (count: number) => void;
  onStartGame: () => void;
}

const COMPUTER_OPTIONS = [1, 2, 3, 4, 5];

export function HomeScreen({
  computerPlayers,
  onComputerPlayersChange,
  onStartGame,
}: HomeScreenProps) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>♠</Text></View>
          <Text style={styles.brandName}>POKER ROOM</Text>
          <View style={styles.playMoneyTag}><Text style={styles.playMoneyText}>PLAY MONEY</Text></View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR SEAT IS WAITING</Text>
          <Text style={styles.title}>Make your{'\n'}next move.</Text>
          <Text style={styles.subtitle}>
            Build your table, take your seat, and play Texas Hold’em against computer opponents.
          </Text>
          <View style={styles.suitRow}>
            <Text style={[styles.suit, styles.redSuit]}>♥</Text>
            <Text style={styles.suit}>♠</Text>
            <Text style={[styles.suit, styles.redSuit]}>♦</Text>
            <Text style={styles.suit}>♣</Text>
          </View>
        </View>

        <View style={styles.gameCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardEyebrow}>QUICK PLAY</Text>
              <Text style={styles.gameTitle}>Texas Hold’em</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{computerPlayers + 1} PLAYERS</Text>
            </View>
          </View>
          <Text style={styles.description}>
            Choose how many computer opponents join your table.
          </Text>

          <Text style={styles.fieldLabel}>COMPUTER PLAYERS</Text>
          <View style={styles.optionRow}>
            {COMPUTER_OPTIONS.map(count => {
              const selected = computerPlayers === count;
              return (
                <Pressable
                  key={count}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={count + (count === 1 ? ' computer player' : ' computer players')}
                  onPress={() => onComputerPlayersChange(count)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.optionPressed,
                  ]}>
                  <Text style={[styles.optionValue, selected && styles.optionValueSelected]}>
                    {count}
                  </Text>
                  <Text style={[styles.optionCaption, selected && styles.optionCaptionSelected]}>
                    {count === 1 ? 'BOT' : 'BOTS'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.tableHint}>
            {computerPlayers + 1} seats total · You + {computerPlayers} computer
            {computerPlayers === 1 ? '' : 's'}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>$100</Text>
              <Text style={styles.statLabel}>STARTING STACK EACH</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>$1 / $2</Text>
              <Text style={styles.statLabel}>SMALL / BIG BLIND</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onStartGame}
            style={({ pressed }) => [styles.playButton, pressed && styles.buttonPressed]}>
            <Text style={styles.playButtonText}>Play with {computerPlayers} Computer
              {computerPlayers === 1 ? '' : 's'}
            </Text>
            <Text style={styles.playButtonArrow}>→</Text>
          </Pressable>
          <Text style={styles.note}>Free virtual chips · No real-money wagering</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>PLAY THE HAND</Text>
          <Text style={styles.footerText}>
            Fold, check, call, or raise. Best five-card hand wins at showdown.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#071812' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 30 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  brandMark: {
    width: 34, height: 34, borderRadius: 11, alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#d5b36a',
  },
  brandMarkText: { color: '#10241b', fontSize: 22, fontWeight: '900' },
  brandName: { marginLeft: 10, color: '#f2ead8', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  playMoneyTag: {
    marginLeft: 'auto', borderWidth: 1, borderColor: '#526e5c',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  playMoneyText: { color: '#b7c9b9', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  hero: { paddingTop: 42, paddingBottom: 28 },
  eyebrow: { color: '#d5b36a', fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },
  title: {
    marginTop: 16, color: '#f5f0e5', fontSize: 50,
    lineHeight: 54, fontWeight: '800', letterSpacing: -1.8,
  },
  subtitle: { maxWidth: 310, marginTop: 18, color: '#a9b9ae', fontSize: 15, lineHeight: 23 },
  suitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 12 },
  suit: { color: '#e4dfd3', fontSize: 26 },
  redSuit: { color: '#d66f68' },
  gameCard: {
    padding: 20, borderRadius: 22, backgroundColor: '#11291f',
    borderWidth: 1, borderColor: '#284534',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { color: '#d5b36a', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  gameTitle: { marginTop: 7, color: '#f4efe5', fontSize: 21, fontWeight: '800' },
  badge: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#203d2d' },
  badgeText: { color: '#d9c28e', fontSize: 10, fontWeight: '800' },
  description: { marginTop: 13, color: '#a9b9ae', fontSize: 13, lineHeight: 20 },
  fieldLabel: { marginTop: 22, color: '#d5b36a', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  optionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  option: {
    flex: 1, minHeight: 57, borderWidth: 1, borderColor: '#3a5946',
    borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a3527',
  },
  optionSelected: { backgroundColor: '#d5b36a', borderColor: '#e6c981' },
  optionPressed: { opacity: 0.78 },
  optionValue: { color: '#e6e9df', fontSize: 18, fontWeight: '900' },
  optionValueSelected: { color: '#16251b' },
  optionCaption: { marginTop: 2, color: '#9caf9f', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  optionCaptionSelected: { color: '#283722' },
  tableHint: { marginTop: 9, color: '#83988a', fontSize: 10 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 19, marginBottom: 19,
    paddingVertical: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#2c4536',
  },
  stat: { flex: 1 },
  statValue: { color: '#f4efe5', fontSize: 22, fontWeight: '800' },
  statLabel: { marginTop: 5, color: '#90a396', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  statDivider: { width: 1, height: 38, marginHorizontal: 15, backgroundColor: '#2c4536' },
  playButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 56, borderRadius: 14, paddingHorizontal: 18, backgroundColor: '#d5b36a',
  },
  buttonPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  playButtonText: { color: '#14251b', fontSize: 14, fontWeight: '900' },
  playButtonArrow: { marginLeft: 10, color: '#14251b', fontSize: 22, fontWeight: '700' },
  note: { marginTop: 12, color: '#83988a', fontSize: 10, textAlign: 'center' },
  footer: { marginTop: 'auto', paddingTop: 25 },
  footerTitle: { color: '#d5b36a', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  footerText: { marginTop: 8, color: '#83988a', fontSize: 12, lineHeight: 18 },
});
