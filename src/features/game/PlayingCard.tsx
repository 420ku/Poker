import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getRankLabel, getSuitSymbol, isRedSuit } from '../../domain/poker/evaluator';
import type { Card } from '../../domain/poker/types';

interface PlayingCardProps {
  card?: Card;
  hidden?: boolean;
  compact?: boolean;
}

export function PlayingCard({ card, hidden = false, compact = false }: PlayingCardProps) {
  if (hidden) {
    return (
      <View style={[styles.card, compact && styles.compactCard, styles.cardBack]}>
        <View style={styles.backInner}>
          <Text style={[styles.backSuit, compact && styles.compactBackSuit]}>♠</Text>
        </View>
      </View>
    );
  }

  if (!card) {
    return <View style={[styles.card, compact && styles.compactCard, styles.emptyCard]} />;
  }

  const red = isRedSuit(card.suit);
  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <Text style={[styles.rank, compact && styles.compactRank, red && styles.red]}>
        {getRankLabel(card.rank)}
      </Text>
      <Text style={[styles.suit, compact && styles.compactSuit, red && styles.red]}>
        {getSuitSymbol(card.suit)}
      </Text>
      <Text style={[styles.corner, compact && styles.compactCorner, red && styles.red]}>
        {getSuitSymbol(card.suit)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 48, height: 68, borderRadius: 8, padding: 6,
    backgroundColor: '#fffdf8', borderWidth: 1, borderColor: '#dedbd2',
    alignItems: 'flex-start', justifyContent: 'flex-start',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  compactCard: { width: 39, height: 56, padding: 5, borderRadius: 7 },
  rank: { color: '#18251f', fontSize: 15, lineHeight: 17, fontWeight: '900' },
  compactRank: { fontSize: 12, lineHeight: 14 },
  suit: { marginTop: -1, color: '#18251f', fontSize: 16, lineHeight: 17 },
  compactSuit: { fontSize: 13, lineHeight: 15 },
  corner: { position: 'absolute', right: 5, bottom: 3, color: '#18251f', fontSize: 11 },
  compactCorner: { right: 4, bottom: 2, fontSize: 9 },
  red: { color: '#c74448' },
  cardBack: { padding: 4, backgroundColor: '#1a3151', borderColor: '#c7a65f' },
  backInner: {
    flex: 1, width: '100%', borderWidth: 1, borderColor: '#8e7748',
    borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#234369',
  },
  backSuit: { color: '#e0c989', fontSize: 25 },
  compactBackSuit: { fontSize: 19 },
  emptyCard: {
    backgroundColor: 'rgba(5, 30, 20, 0.16)', borderStyle: 'dashed',
    borderColor: 'rgba(231, 231, 205, 0.33)', shadowOpacity: 0, elevation: 0,
  },
});
