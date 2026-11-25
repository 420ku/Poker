import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getCallAmount, getMaximumRaiseTo, getMinimumRaiseTo } from '../../domain/poker/game';
import type { PokerAction, PokerGame } from '../../domain/poker/types';
import { PlayingCard } from './PlayingCard';

interface PokerTableScreenProps {
  game: PokerGame;
  onBack: () => void;
  onAction: (action: PokerAction) => void;
  onNextHand: () => void;
  onNewGame: () => void;
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

function ActionButton({ label, onPress, variant = 'secondary' }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'primary' && styles.primaryAction,
        variant === 'danger' && styles.dangerAction,
        pressed && styles.pressedAction,
      ]}>
      <Text style={[
        styles.actionText,
        variant === 'primary' && styles.primaryActionText,
        variant === 'danger' && styles.dangerActionText,
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PokerTableScreen({
  game,
  onBack,
  onAction,
  onNextHand,
  onNewGame,
}: PokerTableScreenProps) {
  const human = game.players[0];
  const computer = game.players[1];
  const humanTurn = game.status === 'playing' && game.currentPlayerIndex === 0;
  const computerTurn = game.status === 'playing' && game.currentPlayerIndex === 1;
  const callAmount = getCallAmount(game, 0);
  const minRaiseTo = getMinimumRaiseTo(game);
  const maxRaiseTo = getMaximumRaiseTo(human);
  const canRaise = maxRaiseTo > game.currentBet;
  const canMakeMinimumRaise = maxRaiseTo >= minRaiseTo;
  const revealComputer = game.status !== 'playing' && game.communityCards.length === 5;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>LOBBY</Text>
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>TEXAS HOLD’EM</Text>
          <Text style={styles.topSubTitle}>HAND {String(game.handNumber).padStart(2, '0')}</Text>
        </View>
        <View style={styles.blindsPill}><Text style={styles.blindsText}>$1 / $2</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.playerRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>AI</Text></View>
          <View style={styles.playerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName}>COMPUTER</Text>
              {computerTurn && <View style={styles.turnDot} />}
              {game.dealerIndex === 1 && <Text style={styles.dealerBadge}>D</Text>}
            </View>
            <Text style={styles.stackText}>{'$' + computer.stack + ' stack'}</Text>
          </View>
          <View style={styles.opponentCards}>
            {computer.holeCards.map((card, index) => (
              <View key={index} style={index === 1 ? styles.cardOverlap : undefined}>
                <PlayingCard card={card} hidden={!revealComputer} compact />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.tableOuter}>
          <View style={styles.table}>
            <View style={styles.tableTopLine}>
              <Text style={styles.tableLabel}>{game.street.toUpperCase()}</Text>
              <Text style={styles.potLabel}>POT <Text style={styles.potValue}>{game.pot}</Text></Text>
            </View>
            <View style={styles.communityCards}>
              {Array.from({ length: 5 }).map((_, index) => (
                <PlayingCard key={index} card={game.communityCards[index]} compact />
              ))}
            </View>
            <Text style={styles.tableHint}>
              {game.status === 'playing'
                ? game.currentPlayerIndex === 0 ? 'YOUR MOVE' : 'COMPUTER THINKING'
                : game.status === 'match-over' ? 'SESSION COMPLETE' : 'HAND COMPLETE'}
            </Text>
          </View>
        </View>

        <View style={styles.playerRow}>
          <View style={[styles.avatar, styles.humanAvatar]}>
            <Text style={[styles.avatarText, styles.humanAvatarText]}>YOU</Text>
          </View>
          <View style={styles.playerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName}>YOUR SEAT</Text>
              {humanTurn && <View style={styles.turnDot} />}
              {game.dealerIndex === 0 && <Text style={styles.dealerBadge}>D</Text>}
            </View>
            <Text style={styles.stackText}>{'$' + human.stack + ' stack'}</Text>
          </View>
          <View style={styles.holeCards}>
            {human.holeCards.map((card, index) => (
              <View key={index} style={index === 1 ? styles.cardOverlap : undefined}>
                <PlayingCard card={card} compact />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>TABLE UPDATE</Text>
          <Text style={styles.statusMessage}>{game.message}</Text>
          {game.handDescription && <Text style={styles.handDescription}>{game.handDescription}</Text>}
        </View>

        {game.status === 'playing' ? (
          <View style={styles.actionArea}>
            {humanTurn ? (
              <>
                <View style={styles.actionMeta}>
                  <Text style={styles.actionMetaText}>{callAmount > 0 ? 'TO CALL' : 'YOUR ACTION'}</Text>
                  <Text style={styles.actionMetaValue}>
                    {callAmount > 0 ? '$' + callAmount : 'No bet to call'}
                  </Text>
                </View>
                <View style={styles.actionGrid}>
                  <ActionButton label="Fold" variant="danger" onPress={() => onAction({ type: 'fold' })} />
                  {callAmount > 0 ? (
                    <ActionButton label={'Call $' + callAmount} onPress={() => onAction({ type: 'call' })} />
                  ) : (
                    <ActionButton label="Check" onPress={() => onAction({ type: 'check' })} />
                  )}
                  {canRaise && (
                    <ActionButton
                      label={canMakeMinimumRaise
                        ? (game.currentBet === 0 ? 'Bet $' : 'Raise to $') + minRaiseTo
                        : 'All-in $' + maxRaiseTo}
                      variant="primary"
                      onPress={() => onAction({
                        type: 'raise',
                        amount: canMakeMinimumRaise ? minRaiseTo : maxRaiseTo,
                      })}
                    />
                  )}
                </View>
              </>
            ) : (
              <View style={styles.waitingPanel}>
                <View style={styles.waitingDot} />
                <Text style={styles.waitingText}>Computer is thinking…</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.endPanel}>
            <Text style={styles.endTitle}>
              {game.status === 'match-over' ? 'MATCH OVER' : 'HAND SETTLED'}
            </Text>
            <Text style={styles.endSubtitle}>
              {game.status === 'match-over'
                ? 'One player has run out of chips.'
                : 'Blinds stay at $1 / $2. Dealer button moves next hand.'}
            </Text>
            <ActionButton
              label={game.status === 'match-over' ? 'Start New Game' : 'Deal Next Hand'}
              variant="primary"
              onPress={game.status === 'match-over' ? onNewGame : onNextHand}
            />
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Play chips only · Starting stack $100 each · Small blind $1 · Big blind $2
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#071812' },
  topBar: {
    minHeight: 62, paddingHorizontal: 18, flexDirection: 'row',
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1b3528',
  },
  backButton: { minWidth: 72, flexDirection: 'row', alignItems: 'center' },
  backArrow: { color: '#d5b36a', fontSize: 28, lineHeight: 30 },
  backText: { marginLeft: 4, color: '#c7d0c8', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#f0eadc', fontSize: 11, fontWeight: '900', letterSpacing: 1.7 },
  topSubTitle: { marginTop: 4, color: '#90a497', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  blindsPill: { minWidth: 72, alignItems: 'center', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#183426' },
  blindsText: { color: '#dfc584', fontSize: 10, fontWeight: '900' },
  content: { paddingHorizontal: 17, paddingTop: 17, paddingBottom: 24 },
  playerRow: { minHeight: 69, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  avatar: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#27445e', borderWidth: 1, borderColor: '#53718a' },
  avatarText: { color: '#dbe8f4', fontSize: 10, fontWeight: '900' },
  humanAvatar: { backgroundColor: '#d5b36a', borderColor: '#f0d99f' },
  humanAvatarText: { color: '#1b2b20', fontSize: 8 },
  playerInfo: { flex: 1, marginLeft: 11 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  playerName: { color: '#eae6db', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  stackText: { marginTop: 5, color: '#a0b2a5', fontSize: 12, fontWeight: '700' },
  turnDot: { width: 6, height: 6, marginLeft: 7, borderRadius: 4, backgroundColor: '#d5b36a' },
  dealerBadge: {
    marginLeft: 7, width: 16, height: 16, borderRadius: 8, overflow: 'hidden',
    color: '#14251b', backgroundColor: '#e7e1d2', textAlign: 'center',
    textAlignVertical: 'center', fontSize: 9, fontWeight: '900',
  },
  opponentCards: { flexDirection: 'row', alignItems: 'center' },
  holeCards: { flexDirection: 'row', alignItems: 'center' },
  cardOverlap: { marginLeft: -9 },
  tableOuter: { marginVertical: 10, padding: 7, borderRadius: 33, backgroundColor: '#13291e', borderWidth: 1, borderColor: '#36503c' },
  table: {
    minHeight: 205, borderRadius: 27, paddingHorizontal: 12, paddingTop: 15,
    paddingBottom: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#126247', borderWidth: 2, borderColor: '#2d8666',
  },
  tableTopLine: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableLabel: { color: '#c7e0cc', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  potLabel: { color: '#c7e0cc', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  potValue: { color: '#fff2c8', fontSize: 15, fontWeight: '900', letterSpacing: 0 },
  communityCards: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 19 },
  tableHint: { marginTop: 16, color: '#c2dfce', fontSize: 8, fontWeight: '900', letterSpacing: 2 },
  statusCard: { marginTop: 10, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#11291f', borderWidth: 1, borderColor: '#284534' },
  statusLabel: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 1.7 },
  statusMessage: { marginTop: 6, color: '#e7e8df', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  handDescription: { marginTop: 5, color: '#d5b36a', fontSize: 11, fontWeight: '800' },
  actionArea: { marginTop: 14 },
  actionMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  actionMetaText: { color: '#94a99a', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  actionMetaValue: { color: '#f0e6cb', fontSize: 12, fontWeight: '800' },
  actionGrid: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, minHeight: 48, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#203b2d', borderWidth: 1, borderColor: '#3b5a44' },
  primaryAction: { backgroundColor: '#d5b36a', borderColor: '#e3c783' },
  dangerAction: { backgroundColor: '#392322', borderColor: '#75413c' },
  pressedAction: { opacity: 0.78 },
  actionText: { color: '#e4eadf', fontSize: 11, fontWeight: '900' },
  primaryActionText: { color: '#16251b' },
  dangerActionText: { color: '#edaaa2' },
  waitingPanel: { minHeight: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#11291f' },
  waitingDot: { width: 7, height: 7, marginRight: 9, borderRadius: 4, backgroundColor: '#d5b36a' },
  waitingText: { color: '#bdc9bf', fontSize: 12, fontWeight: '700' },
  endPanel: { marginTop: 14, padding: 15, borderRadius: 15, backgroundColor: '#11291f', borderWidth: 1, borderColor: '#52633f' },
  endTitle: { color: '#d5b36a', fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  endSubtitle: { marginTop: 7, marginBottom: 13, color: '#aab9ad', fontSize: 12, lineHeight: 18 },
  footer: { paddingTop: 18 },
  footerText: { color: '#728779', fontSize: 9, lineHeight: 14, textAlign: 'center' },
});
