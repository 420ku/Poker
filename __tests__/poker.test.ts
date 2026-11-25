import { compareHands, evaluateBestHand } from '../src/domain/poker/evaluator';
import { applyAction, createGame } from '../src/domain/poker/game';
import type { Card } from '../src/domain/poker/types';

describe('Texas Hold’em game', () => {
  test('starts heads-up with $100 stacks and posts $1/$2 blinds', () => {
    const game = createGame();

    expect(game.players[0].stack).toBe(99);
    expect(game.players[1].stack).toBe(98);
    expect(game.players[0].committedThisRound).toBe(1);
    expect(game.players[1].committedThisRound).toBe(2);
    expect(game.pot).toBe(3);
    expect(game.currentPlayerIndex).toBe(0);
  });

  test('calls and checks through to the flop', () => {
    const preflop = createGame();
    const called = applyAction(preflop, { type: 'call' });
    const flop = applyAction(called, { type: 'check' });

    expect(flop.street).toBe('flop');
    expect(flop.communityCards).toHaveLength(3);
    expect(flop.pot).toBe(4);
    expect(flop.players[0].stack).toBe(98);
    expect(flop.players[1].stack).toBe(98);
    expect(flop.currentPlayerIndex).toBe(0);
  });

  test('settles a fold and returns the unmatched blind', () => {
    const result = applyAction(createGame(), { type: 'fold' });

    expect(result.status).toBe('hand-over');
    expect(result.winners).toEqual(['computer']);
    expect(result.players[0].stack).toBe(99);
    expect(result.players[1].stack).toBe(101);
    expect(result.pot).toBe(2);
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
