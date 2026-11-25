import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PokerGame } from '../../domain/poker/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

interface PauseScreenProps {
  game: PokerGame;
  saveStatus: SaveStatus;
  onResume: () => void;
  onReturnHome: () => void;
}

function ActionButton({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primaryButton,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.buttonText, primary && styles.primaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

function getSaveMessage(status: SaveStatus): string {
  if (status === 'saving') return 'Saving game and chip stacks…';
  if (status === 'saved') return 'Game and chip stacks saved to Supabase';
  if (status === 'error') return 'Cloud save failed. Check connection and Supabase setup.';
  if (status === 'offline') return 'Cloud saving is not configured.';
  return 'Game paused';
}

export function PauseScreen({
  game,
  saveStatus,
  onResume,
  onReturnHome,
}: PauseScreenProps) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>POKER ROOM</Text>
        <View style={styles.pauseIcon}><Text style={styles.pauseGlyph}>Ⅱ</Text></View>
        <Text style={styles.title}>Game paused</Text>
        <Text style={styles.subtitle}>
          Your current hand, cards, bets, and every player’s chip stack are saved together.
        </Text>

        <View style={styles.saveCard}>
          <View style={[styles.statusDot, saveStatus === 'saved' && styles.savedDot]} />
          <Text style={styles.saveText}>{getSaveMessage(saveStatus)}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>TABLE SNAPSHOT</Text>
            <Text style={styles.handNumber}>HAND {game.handNumber}</Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{'$' + game.pot}</Text>
              <Text style={styles.statLabel}>CURRENT POT</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{game.players.length}</Text>
              <Text style={styles.statLabel}>SEATS</Text>
            </View>
          </View>
          {game.players.map(player => (
            <View key={player.id} style={styles.playerRow}>
              <View style={styles.playerNameWrap}>
                <Text style={styles.playerName}>{player.name}</Text>
                {player.folded && <Text style={styles.playerState}>FOLDED</Text>}
                {player.allIn && <Text style={styles.playerState}>ALL-IN</Text>}
              </View>
              <Text style={styles.stack}>{'$' + player.stack}</Text>
            </View>
          ))}
        </View>

        <ActionButton label="Resume Game" primary onPress={onResume} />
        <ActionButton label="Return to Lobby" onPress={onReturnHome} />
        <Text style={styles.note}>Your saved game stays available from the home screen.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#071812' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  brand: { color: '#d5b36a', fontSize: 10, fontWeight: '900', letterSpacing: 2.5, textAlign: 'center' },
  pauseIcon: {
    alignSelf: 'center', width: 62, height: 62, borderRadius: 20, marginTop: 35,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#183426',
    borderWidth: 1, borderColor: '#496044',
  },
  pauseGlyph: { color: '#d5b36a', fontSize: 29, fontWeight: '900' },
  title: { marginTop: 19, color: '#f4efe5', fontSize: 32, fontWeight: '900', textAlign: 'center' },
  subtitle: { maxWidth: 310, alignSelf: 'center', marginTop: 10, color: '#a9b9ae', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  saveCard: {
    flexDirection: 'row', alignItems: 'center', marginTop: 25, padding: 13,
    borderRadius: 12, backgroundColor: '#11291f', borderWidth: 1, borderColor: '#284534',
  },
  statusDot: { width: 8, height: 8, borderRadius: 5, marginRight: 9, backgroundColor: '#d6a456' },
  savedDot: { backgroundColor: '#78bd8d' },
  saveText: { flex: 1, color: '#c3d0c6', fontSize: 11, fontWeight: '700' },
  summaryCard: { marginTop: 14, marginBottom: 19, padding: 16, borderRadius: 16, backgroundColor: '#11291f', borderWidth: 1, borderColor: '#284534' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { color: '#d5b36a', fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  handNumber: { color: '#8ea594', fontSize: 9, fontWeight: '800' },
  summaryStats: { flexDirection: 'row', paddingVertical: 14, marginBottom: 5, borderBottomWidth: 1, borderBottomColor: '#2c4536' },
  stat: { flex: 1 },
  statValue: { color: '#f4efe5', fontSize: 21, fontWeight: '900' },
  statLabel: { marginTop: 4, color: '#90a396', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  playerNameWrap: { flexDirection: 'row', alignItems: 'center' },
  playerName: { color: '#eae6db', fontSize: 12, fontWeight: '700' },
  playerState: { marginLeft: 7, color: '#d5b36a', fontSize: 7, fontWeight: '900' },
  stack: { color: '#f0e6cb', fontSize: 13, fontWeight: '900' },
  button: {
    minHeight: 52, borderRadius: 13, marginTop: 9, alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#203b2d', borderWidth: 1, borderColor: '#3b5a44',
  },
  primaryButton: { backgroundColor: '#d5b36a', borderColor: '#e3c783' },
  pressed: { opacity: 0.78 },
  buttonText: { color: '#e4eadf', fontSize: 13, fontWeight: '900' },
  primaryButtonText: { color: '#16251b' },
  note: { marginTop: 14, color: '#7f9284', fontSize: 10, textAlign: 'center' },
});
