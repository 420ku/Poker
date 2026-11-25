import { compareHands, evaluateBestHand } from '../src/domain/poker/evaluator';
import { applyAction, createGame, startNextHand } from '../src/domain/poker/game';
import type { Card } from '../src/domain/poker/types';

describe('Texas Hold’em table setup', () => {
  test('starts heads-up with $100 stacks and correct button/blind positions', () => {
    const game = createGame(1);

    expect(game.players).toHaveLength(2);
    expect(game.players[0].stack).toBe(99);
    expect(game.players[1].stack).toBe(98);
    expect(game.players[0].committedThisRound).toBe(1);
    expect(game.players[1].committedThisRound).toBe(2);
    expect(game.pot).toBe(3);
    expect(game.dealerIndex).toBe(0);
    expect(game.currentPlayerIndex).toBe(0);
  });

  test('creates a six-seat table with two hole cards each', () => {
    const game = createGame(5);

    expect(game.players).toHaveLength(6);
    expect(game.players.every(player => player.holeCards.length === 2)).toBe(true);
    expect(game.deck).toHaveLength(40);
  });

  test('posts multiway blinds and starts action left of the big blind', () => {
    const game = createGame(3);

    expect(game.players).toHaveLength(4);
    expect(game.players[0].committedThisRound).toBe(0);
    expect(game.players[1].committedThisRound).toBe(1);
    expect(game.players[2].committedThisRound).toBe(2);
    expect(game.currentPlayerIndex).toBe(3);
    expect(game.pot).toBe(3);
  });
});

describe('Texas Hold’em betting', () => {
  test('completes a four-player preflop round and deals the flop', () => {
    let game = createGame(3);

    game = applyAction(game, { type: 'call' });
    game = applyAction(game, { type: 'call' });
    game = applyAction(game, { type: 'call' });
    game = applyAction(game, { type: 'check' });

    expect(game.street).toBe('flop');
    expect(game.communityCards).toHaveLength(3);
    expect(game.pot).toBe(8);
    expect(game.currentPlayerIndex).toBe(1);
  });

  test('supports raise sizes above the minimum', () => {
    const raised = applyAction(createGame(1), { type: 'raise', amount: 8 });

    expect(raised.currentBet).toBe(8);
    expect(raised.minRaise).toBe(6);
    expect(raised.players[0].committedThisRound).toBe(8);
    expect(raised.players[0].stack).toBe(92);
    expect(raised.currentPlayerIndex).toBe(1);
  });

  test('splits main and side pots without losing chips in an all-in hand', () => {
    let game = createGame(2, [100, 30, 100]);

    game = applyAction(game, { type: 'raise', amount: 100 });
    game = applyAction(game, { type: 'call' });
    game = applyAction(game, { type: 'call' });

    expect(['hand-over', 'match-over']).toContain(game.status);
    expect(game.communityCards).toHaveLength(5);
    expect(game.players.reduce((total, player) => total + player.stack, 0)).toBe(230);
    expect(game.pot).toBe(230);
    expect(game.players[1].stack).toBeGreaterThanOrEqual(0);
  });

  test('returns unmatched chips and rotates the dealer for next hand', () => {
    const folded = applyAction(createGame(1), { type: 'fold' });
    const next = startNextHand(folded);

    expect(folded.players[0].stack).toBe(99);
    expect(folded.players[1].stack).toBe(101);
    expect(next.handNumber).toBe(2);
    expect(next.dealerIndex).toBe(1);
  });
});

describe('Texas Hold’em hand evaluator', () => {
  test('recognizes an ace-high straight flush', () => {
    const cards: Card[] = [
      { rank: 10, suit: 'hearts' },
      { rank: 11, suit: 'hearts' },
      { rank: 12, suit: 'hearts' },
      { rank: 13, suit: 'hearts' },
      { rank: 14, suit: 'hearts' },
      { rank: 2, suit: 'clubs' },
      { rank: 7, suit: 'spades' },
    ];

    const hand = evaluateBestHand(cards);
    expect(hand.category).toBe(8);
    expect(hand.name).toBe('Straight flush');
    expect(hand.kickers).toEqual([14]);
  });

  test('recognizes the ace-low wheel straight', () => {
    const cards: Card[] = [
      { rank: 14, suit: 'spades' },
      { rank: 2, suit: 'hearts' },
      { rank: 3, suit: 'clubs' },
      { rank: 4, suit: 'diamonds' },
      { rank: 5, suit: 'spades' },
      { rank: 9, suit: 'hearts' },
      { rank: 11, suit: 'clubs' },
    ];

    const hand = evaluateBestHand(cards);
    expect(hand.category).toBe(4);
    expect(hand.kickers).toEqual([5]);
  });

  test('uses kickers to break equal pairs', () => {
    const pairOfAcesWithKing: Card[] = [
      { rank: 14, suit: 'spades' },
      { rank: 14, suit: 'hearts' },
      { rank: 13, suit: 'clubs' },
      { rank: 9, suit: 'diamonds' },
      { rank: 7, suit: 'spades' },
      { rank: 4, suit: 'hearts' },
      { rank: 2, suit: 'clubs' },
    ];
    const pairOfAcesWithJack: Card[] = [
      { rank: 14, suit: 'clubs' },
      { rank: 14, suit: 'diamonds' },
      { rank: 11, suit: 'clubs' },
      { rank: 10, suit: 'diamonds' },
      { rank: 7, suit: 'hearts' },
      { rank: 4, suit: 'clubs' },
      { rank: 2, suit: 'diamonds' },
    ];

    expect(compareHands(
      evaluateBestHand(pairOfAcesWithKing),
      evaluateBestHand(pairOfAcesWithJack),
    )).toBe(1);
  });
});
