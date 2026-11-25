import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getCallAmount, getMaximumRaiseTo, getMinimumRaiseTo } from '../../domain/poker/game';
import type { PlayerState, PokerAction, PokerGame } from '../../domain/poker/types';
import { PlayingCard } from './PlayingCard';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

interface PokerTableScreenProps {
  game: PokerGame;
  saveStatus: SaveStatus;
  onPause: () => void;
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

interface PlayerSeatProps {
  player: PlayerState;
  isDealer: boolean;
  isTurn: boolean;
  isWinner: boolean;
  isHuman?: boolean;
  revealCards: boolean;
}

function PlayerSeat({
  player,
  isDealer,
  isTurn,
  isWinner,
  isHuman = false,
  revealCards,
}: PlayerSeatProps) {
  const status = player.stack === 0 && player.holeCards.length === 0
    ? 'OUT'
    : player.folded
      ? 'FOLDED'
      : player.allIn
        ? 'ALL-IN'
        : isTurn
          ? 'ACTING'
          : 'IN';

  return (
    <View style={[
      styles.seat,
      isHuman && styles.humanSeat,
      isTurn && styles.activeSeat,
      player.folded && styles.foldedSeat,
      player.stack === 0 && player.holeCards.length === 0 && styles.outSeat,
    ]}>
      <View style={styles.seatTop}>
        <View style={[styles.avatar, isHuman && styles.humanAvatar]}>
          <Text style={[styles.avatarText, isHuman && styles.humanAvatarText]}>
            {isHuman ? 'YOU' : 'AI'}
          </Text>
        </View>
        <View style={styles.seatIdentity}>
          <View style={styles.seatNameLine}>
            <Text numberOfLines={1} style={styles.playerName}>{player.name.toUpperCase()}</Text>
            {isDealer && <Text style={styles.dealerBadge}>D</Text>}
          </View>
          <Text style={styles.stackText}>{'$' + player.stack}</Text>
        </View>
        {isWinner ? (
          <Text style={styles.winnerBadge}>WINNER</Text>
        ) : (
          <Text style={[styles.seatStatus, isTurn && styles.turnStatus]}>{status}</Text>
        )}
      </View>

      <View style={styles.seatBottom}>
        <View style={styles.seatCards}>
          {player.holeCards.length > 0 ? player.holeCards.map((card, index) => (
            <View key={index} style={index === 1 ? styles.cardOverlap : undefined}>
              <PlayingCard card={card} compact hidden={!isHuman && !revealCards} />
            </View>
          )) : (
            <Text style={styles.outText}>{player.stack === 0 ? 'BUSTED' : 'WAITING'}</Text>
          )}
        </View>
        {player.committedThisRound > 0 && (
          <Text style={styles.betText}>{'BET $' + player.committedThisRound}</Text>
        )}
      </View>
    </View>
  );
}

export function PokerTableScreen({
  game,
  saveStatus,
  onPause,
  onAction,
  onNextHand,
  onNewGame,
}: PokerTableScreenProps) {
  const [raiseTarget, setRaiseTarget] = useState(0);
  const humanIndex = game.players.findIndex(player => player.id === 'human');
  const human = game.players[humanIndex];
  const humanTurn = game.status === 'playing' && game.currentPlayerIndex === humanIndex;
  const callAmount = getCallAmount(game, humanIndex);
  const minRaiseTo = getMinimumRaiseTo(game);
  const maxRaiseTo = getMaximumRaiseTo(human);
  const canRaise = human.canRaiseThisRound && maxRaiseTo > game.currentBet;
  const canMakeMinimumRaise = maxRaiseTo >= minRaiseTo;
  const selectedRaiseTo = canMakeMinimumRaise
    ? Math.min(maxRaiseTo, Math.max(minRaiseTo, raiseTarget || minRaiseTo))
    : maxRaiseTo;
  const revealCards = game.status !== 'playing' && game.communityCards.length === 5;
  const opponents = game.players.filter(player => player.id !== 'human');
  const saveLabel =
    saveStatus === 'saving' ? 'SAVING' :
    saveStatus === 'saved' ? 'SAVED' :
    saveStatus === 'error' ? 'SAVE ERROR' :
    saveStatus === 'offline' ? 'OFFLINE' : 'LOCAL';

  useEffect(() => {
    setRaiseTarget(canMakeMinimumRaise ? minRaiseTo : maxRaiseTo);
  }, [
    game.handNumber,
    game.street,
    game.currentBet,
    human.committedThisRound,
    human.stack,
    minRaiseTo,
    maxRaiseTo,
    canMakeMinimumRaise,
  ]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onPause} style={styles.backButton}>
          <Text style={styles.pauseGlyph}>Ⅱ</Text>
          <Text style={styles.backText}>PAUSE</Text>
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>TEXAS HOLD’EM</Text>
          <Text style={styles.topSubTitle}>
            HAND {String(game.handNumber).padStart(2, '0')} · {game.players.length} SEATS
          </Text>
        </View>
        <View style={styles.topRight}>
          <Text style={[
            styles.saveStatus,
            saveStatus === 'saved' && styles.saveStatusSaved,
            saveStatus === 'error' && styles.saveStatusError,
          ]}>{saveLabel}</Text>
          <View style={styles.blindsPill}><Text style={styles.blindsText}>$1 / $2</Text></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.opponentsHeader}>
          <Text style={styles.sectionLabel}>YOUR OPPONENTS</Text>
          <Text style={styles.sectionMeta}>
            {opponents.filter(player => player.stack > 0).length} IN GAME
          </Text>
        </View>

        <View style={styles.opponentsGrid}>
          {opponents.map(player => {
            const playerIndex = game.players.findIndex(candidate => candidate.id === player.id);
            return (
              <PlayerSeat
                key={player.id}
                player={player}
                isDealer={game.dealerIndex === playerIndex}
                isTurn={game.status === 'playing' && game.currentPlayerIndex === playerIndex}
                isWinner={game.winners.includes(player.id)}
                revealCards={revealCards}
              />
            );
          })}
        </View>

        <View style={styles.tableOuter}>
          <View style={styles.table}>
            <View style={styles.tableTopLine}>
              <Text style={styles.tableLabel}>{game.street.toUpperCase()}</Text>
              <Text style={styles.potLabel}>POT <Text style={styles.potValue}>{'$' + game.pot}</Text></Text>
            </View>
            <View style={styles.communityCards}>
              {Array.from({ length: 5 }).map((_, index) => (
                <PlayingCard key={index} card={game.communityCards[index]} compact />
              ))}
            </View>
            <Text style={styles.tableHint}>
              {game.status === 'playing'
                ? humanTurn ? 'YOUR MOVE' : 'COMPUTER TURN'
                : game.status === 'match-over' ? 'MATCH COMPLETE' : 'HAND COMPLETE'}
            </Text>
          </View>
        </View>

        <View style={styles.playerHeading}>
          <Text style={styles.sectionLabel}>YOUR SEAT</Text>
          {game.dealerIndex === humanIndex && <Text style={styles.buttonLabel}>DEALER BUTTON</Text>}
        </View>
        <PlayerSeat
          player={human}
          isHuman
          isDealer={game.dealerIndex === humanIndex}
          isTurn={humanTurn}
          isWinner={game.winners.includes(human.id)}
          revealCards
        />

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
                {canRaise && canMakeMinimumRaise && (
                  <View style={styles.raiseSizer}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Decrease raise"
                      disabled={selectedRaiseTo <= minRaiseTo}
                      onPress={() => setRaiseTarget(Math.max(minRaiseTo, selectedRaiseTo - 1))}
                      style={[styles.sizeButton, selectedRaiseTo <= minRaiseTo && styles.disabledButton]}>
                      <Text style={styles.sizeButtonText}>−</Text>
                    </Pressable>
                    <View style={styles.raiseAmount}>
                      <Text style={styles.raiseAmountLabel}>RAISE TO</Text>
                      <Text style={styles.raiseAmountValue}>{'$' + selectedRaiseTo}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Increase raise"
                      disabled={selectedRaiseTo >= maxRaiseTo}
                      onPress={() => setRaiseTarget(Math.min(maxRaiseTo, selectedRaiseTo + 1))}
                      style={[styles.sizeButton, selectedRaiseTo >= maxRaiseTo && styles.disabledButton]}>
                      <Text style={styles.sizeButtonText}>+</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setRaiseTarget(maxRaiseTo)}
                      style={styles.maxButton}>
                      <Text style={styles.maxButtonText}>MAX</Text>
                    </Pressable>
                  </View>
                )}
                <View style={styles.actionGrid}>
                  <ActionButton label="Fold" variant="danger" onPress={() => onAction({ type: 'fold' })} />
                  {callAmount > 0 ? (
                    <ActionButton label={'Call $' + callAmount} onPress={() => onAction({ type: 'call' })} />
                  ) : (
                    <ActionButton label="Check" onPress={() => onAction({ type: 'check' })} />
                  )}
                  {canRaise && (
                    <ActionButton
                      label={canMakeMinimumRaise ? 'Raise to $' + selectedRaiseTo : 'All-in $' + maxRaiseTo}
                      variant="primary"
                      onPress={() => onAction({
                        type: 'raise',
                        amount: canMakeMinimumRaise ? selectedRaiseTo : maxRaiseTo,
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
                ? 'Only one player has chips remaining.'
                : 'The dealer button moves next hand. Blinds remain $1 / $2.'}
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
            Play chips only · $100 starting stack · $1 small blind · $2 big blind
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
  pauseGlyph: { color: '#d5b36a', fontSize: 17, fontWeight: '900' },
  backText: { marginLeft: 4, color: '#c7d0c8', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#f0eadc', fontSize: 11, fontWeight: '900', letterSpacing: 1.7 },
  topSubTitle: { marginTop: 4, color: '#90a497', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  topRight: { alignItems: 'flex-end', gap: 5 },
  saveStatus: { color: '#91a397', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  saveStatusSaved: { color: '#82bd90' },
  saveStatusError: { color: '#e38a82' },
  blindsPill: { minWidth: 72, alignItems: 'center', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#183426' },
  blindsText: { color: '#dfc584', fontSize: 10, fontWeight: '900' },
  content: { paddingHorizontal: 17, paddingTop: 15, paddingBottom: 24 },
  opponentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 3, marginBottom: 9 },
  sectionLabel: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  sectionMeta: { color: '#83988a', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  opponentsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  seat: {
    width: '48.5%', minHeight: 88, padding: 9, borderRadius: 12,
    backgroundColor: '#11291f', borderWidth: 1, borderColor: '#284534',
  },
  humanSeat: { width: '100%', minHeight: 86, borderColor: '#52633f', backgroundColor: '#172f23' },
  activeSeat: { borderColor: '#d5b36a', backgroundColor: '#203929' },
  foldedSeat: { opacity: 0.55 },
  outSeat: { opacity: 0.4 },
  seatTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 29, height: 29, borderRadius: 15, alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#27445e', borderWidth: 1, borderColor: '#53718a',
  },
  avatarText: { color: '#dbe8f4', fontSize: 8, fontWeight: '900' },
  humanAvatar: { backgroundColor: '#d5b36a', borderColor: '#f0d99f' },
  humanAvatarText: { color: '#1b2b20' },
  seatIdentity: { flex: 1, marginLeft: 7 },
  seatNameLine: { flexDirection: 'row', alignItems: 'center' },
  playerName: { color: '#eae6db', fontSize: 8, fontWeight: '900', letterSpacing: 0.5, flexShrink: 1 },
  stackText: { marginTop: 3, color: '#a0b2a5', fontSize: 11, fontWeight: '800' },
  dealerBadge: {
    marginLeft: 4, width: 14, height: 14, borderRadius: 7, overflow: 'hidden',
    color: '#14251b', backgroundColor: '#e7e1d2', textAlign: 'center',
    textAlignVertical: 'center', fontSize: 8, fontWeight: '900',
  },
  seatStatus: { color: '#8da092', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  turnStatus: { color: '#d5b36a' },
  winnerBadge: { color: '#d5b36a', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  seatBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  seatCards: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  cardOverlap: { marginLeft: -8 },
  outText: { color: '#819386', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  betText: { color: '#d5b36a', fontSize: 8, fontWeight: '800' },
  tableOuter: { marginVertical: 13, padding: 7, borderRadius: 31, backgroundColor: '#13291e', borderWidth: 1, borderColor: '#36503c' },
  table: {
    minHeight: 184, borderRadius: 25, paddingHorizontal: 12, paddingTop: 14,
    paddingBottom: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#126247', borderWidth: 2, borderColor: '#2d8666',
  },
  tableTopLine: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableLabel: { color: '#c7e0cc', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  potLabel: { color: '#c7e0cc', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  potValue: { color: '#fff2c8', fontSize: 15, fontWeight: '900', letterSpacing: 0 },
  communityCards: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 18 },
  tableHint: { marginTop: 14, color: '#c2dfce', fontSize: 8, fontWeight: '900', letterSpacing: 2 },
  playerHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 3, marginBottom: 8 },
  buttonLabel: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  statusCard: { marginTop: 11, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#11291f', borderWidth: 1, borderColor: '#284534' },
  statusLabel: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 1.7 },
  statusMessage: { marginTop: 6, color: '#e7e8df', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  handDescription: { marginTop: 5, color: '#d5b36a', fontSize: 10, lineHeight: 15, fontWeight: '800' },
  actionArea: { marginTop: 14 },
  actionMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  actionMetaText: { color: '#94a99a', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  actionMetaValue: { color: '#f0e6cb', fontSize: 12, fontWeight: '800' },
  raiseSizer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, padding: 7, borderRadius: 12, backgroundColor: '#11291f' },
  sizeButton: { width: 36, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#294735' },
  sizeButtonText: { color: '#f1eadb', fontSize: 20, fontWeight: '700' },
  disabledButton: { opacity: 0.35 },
  raiseAmount: { flex: 1, alignItems: 'center' },
  raiseAmountLabel: { color: '#8ea594', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  raiseAmountValue: { marginTop: 2, color: '#f0e6cb', fontSize: 14, fontWeight: '900' },
  maxButton: { marginLeft: 7, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 8, backgroundColor: '#3a4b34' },
  maxButtonText: { color: '#e5d095', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  actionGrid: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, minHeight: 48, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#203b2d', borderWidth: 1, borderColor: '#3b5a44' },
  primaryAction: { backgroundColor: '#d5b36a', borderColor: '#e3c783' },
  dangerAction: { backgroundColor: '#392322', borderColor: '#75413c' },
  pressedAction: { opacity: 0.78 },
  actionText: { color: '#e4eadf', fontSize: 10, fontWeight: '900', textAlign: 'center' },
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
