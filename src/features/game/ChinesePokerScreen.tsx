import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getChineseArrangementError,
  type ChinesePokerGame,
  type ChinesePokerPlayer,
  type ChinesePokerRow,
} from '../../domain/poker/chinesePoker';
import type { Card } from '../../domain/poker/types';
import { PlayingCard } from './PlayingCard';

interface ChinesePokerScreenProps {
  game: ChinesePokerGame;
  onBackToLobby: () => void;
  onPlaceCard: (card: Card, row: ChinesePokerRow) => void;
  onRemoveCard: (card: Card, row: ChinesePokerRow) => void;
  onSubmit: () => void;
  onNextDeal: () => void;
}

const ROWS: ChinesePokerRow[] = ['front', 'middle', 'back'];

const ROW_LABELS: Record<ChinesePokerRow, string> = {
  front: 'FRONT',
  middle: 'MIDDLE',
  back: 'BACK',
};

const ROW_HINTS: Record<ChinesePokerRow, string> = {
  front: '3 cards · High card / pair / trips',
  middle: '5 cards · Standard poker hand',
  back: '5 cards · Strongest five-card hand',
};

const ROW_LIMITS: Record<ChinesePokerRow, number> = {
  front: 3,
  middle: 5,
  back: 5,
};

function cardKey(card: Card): string {
  return card.rank + '-' + card.suit;
}

function ArrangementRow({
  player,
  row,
  editable,
  selected,
  onSelect,
  onRemoveCard,
}: {
  player: ChinesePokerPlayer;
  row: ChinesePokerRow;
  editable: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onRemoveCard?: (card: Card) => void;
}) {
  const cards = player.arrangement[row];
  const placeholders = Math.max(0, ROW_LIMITS[row] - cards.length);

  return (
    <View style={[styles.rowCard, selected && styles.rowCardSelected]}>
      <Pressable
        accessibilityRole={editable ? 'button' : undefined}
        accessibilityState={editable ? { selected } : undefined}
        disabled={!editable}
        onPress={onSelect}
        style={styles.rowHeader}>
        <View>
          <Text style={styles.rowTitle}>{ROW_LABELS[row]} ROW</Text>
          <Text style={styles.rowHint}>{ROW_HINTS[row]}</Text>
        </View>
        <Text style={[styles.rowCount, selected && styles.rowCountSelected]}>
          {cards.length}/{ROW_LIMITS[row]}
        </Text>
      </Pressable>
      <View style={styles.rowCards}>
        {cards.map(card => (
          <Pressable
            key={cardKey(card)}
            accessibilityRole={editable ? 'button' : undefined}
            accessibilityLabel={editable ? 'Remove card from ' + row + ' row' : undefined}
            disabled={!editable}
            onPress={() => onRemoveCard?.(card)}
            style={styles.arrangedCard}>
            <PlayingCard card={card} compact />
          </Pressable>
        ))}
        {Array.from({ length: placeholders }).map((_, index) => (
          <View key={'empty-' + index} style={styles.emptySlot}>
            <Text style={styles.emptySlotText}>+</Text>
          </View>
        ))}
      </View>
      {editable && selected && (
        <Text style={styles.selectedRowHint}>Selected row · tap a card below to place it here</Text>
      )}
    </View>
  );
}

function OpponentSummary({ player, revealed }: { player: ChinesePokerPlayer; revealed: boolean }) {
  return (
    <View style={styles.opponentCard}>
      <View style={styles.opponentHeading}>
        <View style={styles.opponentAvatar}>
          <Text style={styles.opponentAvatarText}>AI</Text>
        </View>
        <View style={styles.opponentIdentity}>
          <Text style={styles.opponentName}>{player.name.toUpperCase()}</Text>
          <Text style={styles.opponentSub}>{revealed ? 'HAND COMPLETE' : '13 CARDS ARRANGED'}</Text>
        </View>
        <View style={styles.opponentScore}>
          <Text style={styles.opponentScoreValue}>
            {player.totalScore > 0 ? '+' : ''}{player.totalScore}
          </Text>
          <Text style={styles.opponentScoreLabel}>TOTAL</Text>
        </View>
      </View>
      {revealed ? (
        <View style={styles.opponentRows}>
          {ROWS.map(row => (
            <View key={row} style={styles.opponentRow}>
              <Text style={styles.opponentRowLabel}>{ROW_LABELS[row]}</Text>
              <View style={styles.opponentRowCards}>
                {player.arrangement[row].map(card => (
                  <View key={cardKey(card)} style={styles.opponentCardItem}>
                    <PlayingCard card={card} compact />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.hiddenHandText}>Computer arrangement ready · cards hidden until scoring</Text>
      )}
    </View>
  );
}

export function ChinesePokerScreen({
  game,
  onBackToLobby,
  onPlaceCard,
  onRemoveCard,
  onSubmit,
  onNextDeal,
}: ChinesePokerScreenProps) {
  const [selectedRow, setSelectedRow] = useState<ChinesePokerRow>('back');
  const [interactionMessage, setInteractionMessage] = useState('');
  const human = game.players.find(player => player.id === 'human')!;
  const opponents = game.players.filter(player => player.id !== 'human');
  const isComplete = game.status === 'complete';
  const arrangementError = useMemo(
    () => getChineseArrangementError(human.hand, human.arrangement),
    [human.hand, human.arrangement],
  );
  const assignedCards = useMemo(
    () => new Set(ROWS.flatMap(row => human.arrangement[row].map(cardKey))),
    [human.arrangement],
  );
  const availableCards = human.hand.filter(card => !assignedCards.has(cardKey(card)));

  function handlePlaceCard(card: Card) {
    if (human.arrangement[selectedRow].length >= ROW_LIMITS[selectedRow]) {
      setInteractionMessage(ROW_LABELS[selectedRow] + ' row is full. Select another row.');
      return;
    }

    onPlaceCard(card, selectedRow);
    setInteractionMessage('');
  }

  function handleRemoveCard(card: Card, row: ChinesePokerRow) {
    onRemoveCard(card, row);
    setInteractionMessage('Card returned to your hand.');
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to lobby"
          onPress={onBackToLobby}
          style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>LOBBY</Text>
        </Pressable>
        <View style={styles.topTitleWrap}>
          <Text style={styles.topTitle}>CHINESE POKER</Text>
          <Text style={styles.topSubtitle}>HAND {String(game.handNumber).padStart(2, '0')} · 13 CARDS</Text>
        </View>
        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>{game.players.length} PLAYERS</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introRow}>
          <View>
            <Text style={styles.eyebrow}>THIRTEEN-CARD POKER</Text>
            <Text style={styles.title}>{isComplete ? 'Hand revealed.' : 'Build your three rows.'}</Text>
          </View>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsBadgeTitle}>SCORING</Text>
            <Text style={styles.pointsBadgeValue}>+1 / ROW</Text>
            <Text style={styles.pointsBadgeHint}>+3 SWEEP</Text>
          </View>
        </View>

        <View style={styles.opponentsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>COMPUTER OPPONENTS</Text>
            <Text style={styles.sectionMeta}>{opponents.length} SEATED</Text>
          </View>
          {opponents.map(player => (
            <OpponentSummary key={player.id} player={player} revealed={isComplete} />
          ))}
        </View>

        <View style={styles.arrangementSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>YOUR ARRANGEMENT</Text>
            <Text style={styles.sectionMeta}>
              {human.arrangement.front.length +
                human.arrangement.middle.length +
                human.arrangement.back.length}/13 PLACED
            </Text>
          </View>

          {ROWS.map(row => (
            <ArrangementRow
              key={row}
              player={human}
              row={row}
              editable={!isComplete}
              selected={!isComplete && selectedRow === row}
              onSelect={() => setSelectedRow(row)}
              onRemoveCard={card => handleRemoveCard(card, row)}
            />
          ))}

          {!isComplete && (
            <View style={styles.handPanel}>
              <View style={styles.handHeading}>
                <Text style={styles.sectionLabel}>YOUR CARDS</Text>
                <Text style={styles.sectionMeta}>{availableCards.length} UNPLACED</Text>
              </View>
              {availableCards.length > 0 ? (
                <View style={styles.handGrid}>
                  {availableCards.map(card => (
                    <Pressable
                      key={cardKey(card)}
                      accessibilityRole="button"
                      accessibilityLabel={'Place ' + card.rank + ' of ' + card.suit + ' in ' + selectedRow + ' row'}
                      onPress={() => handlePlaceCard(card)}
                      style={({ pressed }) => [styles.handCard, pressed && styles.cardPressed]}>
                      <PlayingCard card={card} compact />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.allPlacedText}>All thirteen cards placed. Review rows before submitting.</Text>
              )}
              {!!interactionMessage && (
                <Text style={styles.interactionMessage}>{interactionMessage}</Text>
              )}
              {!!arrangementError && (
                <Text style={styles.validationMessage}>{arrangementError}</Text>
              )}
              <Pressable
                accessibilityRole="button"
                disabled={Boolean(arrangementError)}
                onPress={onSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  Boolean(arrangementError) && styles.disabledButton,
                  pressed && !arrangementError && styles.cardPressed,
                ]}>
                <Text style={styles.submitButtonText}>REVEAL HANDS & SCORE</Text>
                <Text style={styles.submitArrow}>→</Text>
              </Pressable>
            </View>
          )}
        </View>

        {isComplete && (
          <View style={styles.resultsPanel}>
            <Text style={styles.resultsEyebrow}>HAND {game.handNumber} RESULTS</Text>
            <Text style={styles.resultsTitle}>{game.message}</Text>
            <View style={styles.resultsScoreRow}>
              <View style={styles.resultScoreBlock}>
                <Text style={styles.resultScoreValue}>
                  {human.handScore > 0 ? '+' : ''}{human.handScore}
                </Text>
                <Text style={styles.resultScoreLabel}>THIS HAND</Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultScoreBlock}>
                <Text style={styles.resultScoreValue}>
                  {human.totalScore > 0 ? '+' : ''}{human.totalScore}
                </Text>
                <Text style={styles.resultScoreLabel}>TOTAL SCORE</Text>
              </View>
            </View>
            {game.comparisons
              .filter(comparison => comparison.leftPlayerId === 'human' || comparison.rightPlayerId === 'human')
              .map(comparison => {
                const opponentId = comparison.leftPlayerId === 'human'
                  ? comparison.rightPlayerId
                  : comparison.leftPlayerId;
                const opponent = game.players.find(player => player.id === opponentId);
                const wins = ROWS.filter(row => comparison.rowWinners[row] === 'human').length;
                const losses = ROWS.filter(row => comparison.rowWinners[row] === opponentId).length;
                return (
                  <View key={opponentId} style={styles.comparisonLine}>
                    <Text style={styles.comparisonName}>{opponent?.name ?? 'Opponent'}</Text>
                    <Text style={styles.comparisonValue}>
                      {wins} won · {losses} lost
                      {comparison.scoopWinnerId === 'human' ? ' · SWEEP +3' : ''}
                      {comparison.scoopWinnerId === opponentId ? ' · SWEPT' : ''}
                    </Text>
                  </View>
                );
              })}
            <Pressable
              accessibilityRole="button"
              onPress={onNextDeal}
              style={({ pressed }) => [styles.submitButton, pressed && styles.cardPressed]}>
              <Text style={styles.submitButtonText}>DEAL NEXT HAND</Text>
              <Text style={styles.submitArrow}>→</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.rulesFooter}>
          <Text style={styles.rulesFooterTitle}>ARRANGEMENT RULE</Text>
          <Text style={styles.rulesFooterText}>
            Back must be strongest, middle second, and front weakest. Each row scores one point.
            Winning all three rows against an opponent adds a three-point sweep bonus.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#071812' },
  topBar: {
    minHeight: 62, paddingHorizontal: 16, flexDirection: 'row',
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1b3528',
  },
  backButton: { minWidth: 64, flexDirection: 'row', alignItems: 'center' },
  backArrow: { color: '#d5b36a', fontSize: 28, lineHeight: 30 },
  backText: { marginLeft: 3, color: '#c7d0c8', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#f0eadc', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  topSubtitle: { marginTop: 4, color: '#90a497', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  topBadge: { minWidth: 65, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 14, backgroundColor: '#183426' },
  topBadgeText: { color: '#dfc584', fontSize: 8, fontWeight: '900', textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 28 },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 1.7 },
  title: { marginTop: 7, color: '#f4efe5', fontSize: 23, fontWeight: '900', letterSpacing: -0.5 },
  pointsBadge: { alignItems: 'flex-end', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, backgroundColor: '#11291f', borderWidth: 1, borderColor: '#284534' },
  pointsBadgeTitle: { color: '#94a99a', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  pointsBadgeValue: { marginTop: 3, color: '#e7d39f', fontSize: 10, fontWeight: '900' },
  pointsBadgeHint: { marginTop: 2, color: '#9aab9f', fontSize: 7, fontWeight: '800' },
  opponentsSection: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9, marginHorizontal: 2 },
  sectionLabel: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  sectionMeta: { color: '#83988a', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  opponentCard: { marginBottom: 8, padding: 11, borderRadius: 14, backgroundColor: '#11291f', borderWidth: 1, borderColor: '#284534' },
  opponentHeading: { flexDirection: 'row', alignItems: 'center' },
  opponentAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#27445e' },
  opponentAvatarText: { color: '#dbe8f4', fontSize: 8, fontWeight: '900' },
  opponentIdentity: { flex: 1, marginLeft: 9 },
  opponentName: { color: '#eae6db', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  opponentSub: { marginTop: 3, color: '#83988a', fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  opponentScore: { alignItems: 'flex-end' },
  opponentScoreValue: { color: '#e5cf91', fontSize: 15, fontWeight: '900' },
  opponentScoreLabel: { marginTop: 2, color: '#83988a', fontSize: 7, fontWeight: '800' },
  hiddenHandText: { marginTop: 9, color: '#87998d', fontSize: 9 },
  opponentRows: { marginTop: 9, gap: 7 },
  opponentRow: { flexDirection: 'row', alignItems: 'center' },
  opponentRowLabel: { width: 48, color: '#d5b36a', fontSize: 7, fontWeight: '900' },
  opponentRowCards: { flex: 1, flexDirection: 'row', gap: 3 },
  opponentCardItem: { flex: 1, alignItems: 'center' },
  arrangementSection: { marginBottom: 18 },
  rowCard: { marginBottom: 8, padding: 11, borderRadius: 14, backgroundColor: '#11291f', borderWidth: 1, borderColor: '#284534' },
  rowCardSelected: { borderColor: '#d5b36a', backgroundColor: '#172f23' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  rowTitle: { color: '#e8e4d9', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  rowHint: { marginTop: 3, color: '#83988a', fontSize: 8 },
  rowCount: { color: '#95a99a', fontSize: 10, fontWeight: '900' },
  rowCountSelected: { color: '#e5cc8d' },
  rowCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, minHeight: 58, alignItems: 'center' },
  arrangedCard: { padding: 1 },
  emptySlot: { width: 39, height: 56, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c2118', borderWidth: 1, borderStyle: 'dashed', borderColor: '#45604b' },
  emptySlotText: { color: '#617a68', fontSize: 19 },
  selectedRowHint: { marginTop: 8, color: '#d5b36a', fontSize: 8, fontWeight: '700' },
  handPanel: { marginTop: 6, padding: 12, borderRadius: 15, backgroundColor: '#0d2118', borderWidth: 1, borderColor: '#284534' },
  handHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  handGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  handCard: { padding: 1 },
  cardPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  allPlacedText: { color: '#a8baac', fontSize: 10, lineHeight: 16 },
  interactionMessage: { marginTop: 9, color: '#d5b36a', fontSize: 9 },
  validationMessage: { marginTop: 10, color: '#e39a8e', fontSize: 10, fontWeight: '700', lineHeight: 15 },
  submitButton: { minHeight: 49, marginTop: 13, paddingHorizontal: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d5b36a' },
  submitButtonText: { color: '#14251b', fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  submitArrow: { marginLeft: 9, color: '#14251b', fontSize: 18, fontWeight: '900' },
  disabledButton: { opacity: 0.35 },
  resultsPanel: { marginBottom: 16, padding: 15, borderRadius: 16, backgroundColor: '#11291f', borderWidth: 1, borderColor: '#52633f' },
  resultsEyebrow: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  resultsTitle: { marginTop: 7, color: '#f0eadc', fontSize: 16, lineHeight: 22, fontWeight: '900' },
  resultsScoreRow: { flexDirection: 'row', marginTop: 15, marginBottom: 12, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#2c4536' },
  resultScoreBlock: { flex: 1 },
  resultScoreValue: { color: '#e5cf91', fontSize: 25, fontWeight: '900' },
  resultScoreLabel: { marginTop: 4, color: '#8fa394', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  resultDivider: { width: 1, marginHorizontal: 13, backgroundColor: '#2c4536' },
  comparisonLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#233d2e' },
  comparisonName: { color: '#e6e5dc', fontSize: 9, fontWeight: '800' },
  comparisonValue: { color: '#9dad9f', fontSize: 8, fontWeight: '700' },
  rulesFooter: { paddingTop: 17, borderTopWidth: 1, borderColor: '#1b3528' },
  rulesFooterTitle: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  rulesFooterText: { marginTop: 7, color: '#83988a', fontSize: 10, lineHeight: 16 },
});
