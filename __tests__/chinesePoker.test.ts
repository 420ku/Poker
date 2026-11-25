import {
  createChinesePokerGame,
  findBestChineseArrangement,
  getChineseArrangementError,
  submitChinesePokerArrangement,
} from '../src/domain/poker/chinesePoker';

describe('Chinese Poker deal and computer arrangements', () => {
  test('deals thirteen unique cards to each player', () => {
    const game = createChinesePokerGame(3);
    const cards = game.players.flatMap(player => player.hand);
    const keys = cards.map(card => playerCardKey(card));

    expect(game.players).toHaveLength(4);
    expect(game.players.every(player => player.hand.length === 13)).toBe(true);
    expect(new Set(keys).size).toBe(52);
  });

  test('creates valid 3-5-5 arrangements for every computer player', () => {
    const game = createChinesePokerGame(3);

    game.players.slice(1).forEach(player => {
      expect(player.arrangement.front).toHaveLength(3);
      expect(player.arrangement.middle).toHaveLength(5);
      expect(player.arrangement.back).toHaveLength(5);
      expect(getChineseArrangementError(player.hand, player.arrangement)).toBeNull();
    });
  });

  test('supports two, three, and four total players', () => {
    expect(createChinesePokerGame(1).players).toHaveLength(2);
    expect(createChinesePokerGame(2).players).toHaveLength(3);
    expect(createChinesePokerGame(3).players).toHaveLength(4);
    expect(createChinesePokerGame(5).players).toHaveLength(4);
  });

  test('finds a legal arrangement for any thirteen-card hand', () => {
    const hand = createChinesePokerGame(1).players[0].hand;
    const arrangement = findBestChineseArrangement(hand);

    expect(getChineseArrangementError(hand, arrangement)).toBeNull();
  });
});

describe('Chinese Poker scoring', () => {
  test('scores a completed deal and keeps pairwise scoring zero-sum', () => {
    const game = createChinesePokerGame(2);
    const human = game.players[0];
    const arrangement = findBestChineseArrangement(human.hand);
    const ready = {
      ...game,
      players: game.players.map(player =>
        player.id === 'human' ? { ...player, arrangement } : player,
      ),
    };

    const completed = submitChinesePokerArrangement(ready);

    expect(completed.status).toBe('complete');
    expect(completed.comparisons).toHaveLength(3);
    expect(completed.players.reduce((sum, player) => sum + player.handScore, 0)).toBe(0);
    expect(completed.players.every(player => player.totalScore === player.handScore)).toBe(true);
  });

  test('rejects arrangements with incorrect row sizes', () => {
    const game = createChinesePokerGame(1);

    expect(() => submitChinesePokerArrangement(game)).toThrow(
      'Front row needs exactly 3 cards.',
    );
  });
});

function playerCardKey(card: { rank: number; suit: string }): string {
  return card.rank + '-' + card.suit;
}
