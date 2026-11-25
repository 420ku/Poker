import { compareHands, evaluateBestHand } from './evaluator';
import type { Card, HandEvaluation, PlayerId } from './types';

export type ChinesePokerRow = 'front' | 'middle' | 'back';

export interface ChinesePokerArrangement {
  front: Card[];
  middle: Card[];
  back: Card[];
}

export interface ChinesePokerPlayer {
  id: PlayerId;
  name: string;
  hand: Card[];
  arrangement: ChinesePokerArrangement;
  handScore: number;
  totalScore: number;
}

export interface ChinesePokerComparison {
  leftPlayerId: PlayerId;
  rightPlayerId: PlayerId;
  rowWinners: Record<ChinesePokerRow, PlayerId | null>;
  scoopWinnerId: PlayerId | null;
}

export interface ChinesePokerGame {
  computerCount: number;
  handNumber: number;
  players: ChinesePokerPlayer[];
  status: 'arranging' | 'complete';
  comparisons: ChinesePokerComparison[];
  message: string;
}

const ROW_CAPACITY: Record<ChinesePokerRow, number> = {
  front: 3,
  middle: 5,
  back: 5,
};

const ROWS: ChinesePokerRow[] = ['front', 'middle', 'back'];

function createDeck(): Card[] {
  const suits: Card['suit'][] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const deck: Card[] = [];

  suits.forEach(suit => {
    for (let rank = 2; rank <= 14; rank += 1) {
      deck.push({ rank, suit });
    }
  });

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}

function emptyArrangement(): ChinesePokerArrangement {
  return { front: [], middle: [], back: [] };
}

function cardKey(card: Card): string {
  return card.rank + '-' + card.suit;
}

function sameCard(left: Card, right: Card): boolean {
  return left.rank === right.rank && left.suit === right.suit;
}

function combinations(cards: Card[], size: number): Card[][] {
  const result: Card[][] = [];

  function visit(start: number, selected: Card[]) {
    if (selected.length === size) {
      result.push(selected);
      return;
    }

    for (let index = start; index <= cards.length - (size - selected.length); index += 1) {
      visit(index + 1, [...selected, cards[index]]);
    }
  }

  visit(0, []);
  return result;
}

export function evaluateThreeCardHand(cards: Card[]): HandEvaluation {
  if (cards.length !== 3) {
    throw new Error('The Chinese Poker front row must contain exactly three cards.');
  }

  const ranks = cards.map(card => card.rank).sort((left, right) => right - left);
  const counts = new Map<number, number>();
  ranks.forEach(rank => counts.set(rank, (counts.get(rank) ?? 0) + 1));

  const groups = Array.from(counts.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((left, right) => right.count - left.count || right.rank - left.rank);

  if (groups[0].count === 3) {
    return {
      category: 3,
      name: 'Three of a kind',
      kickers: [groups[0].rank],
      cards,
    };
  }

  if (groups[0].count === 2) {
    return {
      category: 1,
      name: 'One pair',
      kickers: [groups[0].rank, groups[1].rank],
      cards,
    };
  }

  return { category: 0, name: 'High card', kickers: ranks, cards };
}

function evaluateRow(cards: Card[], row: ChinesePokerRow): HandEvaluation {
  return row === 'front' ? evaluateThreeCardHand(cards) : evaluateBestHand(cards);
}

function evaluationStrength(hand: HandEvaluation): number {
  return hand.kickers.reduce(
    (score, rank, index) => score + rank / Math.pow(15, index + 1),
    hand.category,
  );
}

/**
 * Finds a legal 3-5-5 arrangement. This exhaustive split search gives bots
 * consistent, valid layouts without relying on UI or network state.
 */
export function findBestChineseArrangement(hand: Card[]): ChinesePokerArrangement {
  if (hand.length !== 13) {
    throw new Error('Chinese Poker requires exactly thirteen cards per player.');
  }

  let best: ChinesePokerArrangement | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const front of combinations(hand, 3)) {
    const afterFront = hand.filter(card => !front.includes(card));
    const frontHand = evaluateThreeCardHand(front);

    for (const middle of combinations(afterFront, 5)) {
      const back = afterFront.filter(card => !middle.includes(card));
      const middleHand = evaluateBestHand(middle);
      const backHand = evaluateBestHand(back);

      if (
        compareHands(backHand, middleHand) < 0 ||
        compareHands(middleHand, frontHand) < 0
      ) {
        continue;
      }

      const score =
        evaluationStrength(backHand) * 100 +
        evaluationStrength(middleHand) * 10 +
        evaluationStrength(frontHand);

      if (score > bestScore) {
        bestScore = score;
        best = { front, middle, back };
      }
    }
  }

  if (!best) {
    throw new Error('Unable to find a legal Chinese Poker arrangement for this hand.');
  }

  return best;
}

export function getChineseArrangementError(
  hand: Card[],
  arrangement: ChinesePokerArrangement,
): string | null {
  if (arrangement.front.length !== 3) return 'Front row needs exactly 3 cards.';
  if (arrangement.middle.length !== 5) return 'Middle row needs exactly 5 cards.';
  if (arrangement.back.length !== 5) return 'Back row needs exactly 5 cards.';

  const arrangedCards = ROWS.flatMap(row => arrangement[row]);
  const uniqueCards = new Set(arrangedCards.map(cardKey));
  const handCards = new Set(hand.map(cardKey));

  if (
    arrangedCards.length !== 13 ||
    uniqueCards.size !== 13 ||
    arrangedCards.some(card => !handCards.has(cardKey(card)))
  ) {
    return 'Each dealt card must appear in exactly one row.';
  }

  const front = evaluateThreeCardHand(arrangement.front);
  const middle = evaluateBestHand(arrangement.middle);
  const back = evaluateBestHand(arrangement.back);

  if (compareHands(back, middle) < 0) {
    return 'Back row must be at least as strong as middle row.';
  }

  if (compareHands(middle, front) < 0) {
    return 'Middle row must be at least as strong as front row.';
  }

  return null;
}

export function createChinesePokerGame(
  computerCount = 2,
  handNumber = 1,
  previousScores: Record<string, number> = {},
): ChinesePokerGame {
  const safeComputerCount = Math.max(1, Math.min(3, Math.floor(computerCount) || 1));
  const deck = createDeck();
  const players: ChinesePokerPlayer[] = [
    {
      id: 'human',
      name: 'You',
      hand: [],
      arrangement: emptyArrangement(),
      handScore: 0,
      totalScore: previousScores.human ?? 0,
    },
    ...Array.from({ length: safeComputerCount }, (_, index) => ({
      id: 'computer-' + (index + 1),
      name: 'Computer ' + (index + 1),
      hand: [],
      arrangement: emptyArrangement(),
      handScore: 0,
      totalScore: previousScores['computer-' + (index + 1)] ?? 0,
    })),
  ];

  for (let cardIndex = 0; cardIndex < 13; cardIndex += 1) {
    players.forEach(player => {
      const card = deck.pop();
      if (card) player.hand.push(card);
    });
  }

  players.slice(1).forEach(player => {
    player.arrangement = findBestChineseArrangement(player.hand);
  });

  return {
    computerCount: safeComputerCount,
    handNumber,
    players,
    status: 'arranging',
    comparisons: [],
    message: 'Arrange your thirteen cards into front, middle, and back rows.',
  };
}

export function placeChineseCard(
  game: ChinesePokerGame,
  card: Card,
  targetRow: ChinesePokerRow,
): ChinesePokerGame {
  if (game.status !== 'arranging') return game;

  const human = game.players.find(player => player.id === 'human');
  if (!human || !human.hand.some(candidate => sameCard(candidate, card))) return game;

  const arrangement: ChinesePokerArrangement = {
    front: human.arrangement.front.filter(candidate => !sameCard(candidate, card)),
    middle: human.arrangement.middle.filter(candidate => !sameCard(candidate, card)),
    back: human.arrangement.back.filter(candidate => !sameCard(candidate, card)),
  };

  if (arrangement[targetRow].length >= ROW_CAPACITY[targetRow]) return game;
  arrangement[targetRow] = [...arrangement[targetRow], card];

  return {
    ...game,
    players: game.players.map(player =>
      player.id === 'human' ? { ...player, arrangement } : player,
    ),
    message: 'Card moved to ' + targetRow + ' row.',
  };
}

export function removeChineseCard(
  game: ChinesePokerGame,
  targetRow: ChinesePokerRow,
  card: Card,
): ChinesePokerGame {
  if (game.status !== 'arranging') return game;

  return {
    ...game,
    players: game.players.map(player =>
      player.id === 'human'
        ? {
            ...player,
            arrangement: {
              ...player.arrangement,
              [targetRow]: player.arrangement[targetRow].filter(
                candidate => !sameCard(candidate, card),
              ),
            },
          }
        : player,
    ),
  };
}

export function submitChinesePokerArrangement(game: ChinesePokerGame): ChinesePokerGame {
  if (game.status !== 'arranging') return game;

  const human = game.players.find(player => player.id === 'human');
  if (!human) throw new Error('Human player is missing from this Chinese Poker game.');

  const arrangementError = getChineseArrangementError(human.hand, human.arrangement);
  if (arrangementError) throw new Error(arrangementError);

  const scores = new Map(game.players.map(player => [player.id, 0]));
  const comparisons: ChinesePokerComparison[] = [];

  for (let leftIndex = 0; leftIndex < game.players.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < game.players.length; rightIndex += 1) {
      const left = game.players[leftIndex];
      const right = game.players[rightIndex];
      const rowWinners = {} as Record<ChinesePokerRow, PlayerId | null>;
      let leftRowsWon = 0;
      let rightRowsWon = 0;

      ROWS.forEach(row => {
        const comparison = compareHands(
          evaluateRow(left.arrangement[row], row),
          evaluateRow(right.arrangement[row], row),
        );
        const winnerId = comparison > 0
          ? left.id
          : comparison < 0
            ? right.id
            : null;

        rowWinners[row] = winnerId;
        if (winnerId === left.id) {
          leftRowsWon += 1;
          scores.set(left.id, (scores.get(left.id) ?? 0) + 1);
          scores.set(right.id, (scores.get(right.id) ?? 0) - 1);
        } else if (winnerId === right.id) {
          rightRowsWon += 1;
          scores.set(right.id, (scores.get(right.id) ?? 0) + 1);
          scores.set(left.id, (scores.get(left.id) ?? 0) - 1);
        }
      });

      const scoopWinnerId = leftRowsWon === 3
        ? left.id
        : rightRowsWon === 3
          ? right.id
          : null;

      if (scoopWinnerId) {
        const loserId = scoopWinnerId === left.id ? right.id : left.id;
        scores.set(scoopWinnerId, (scores.get(scoopWinnerId) ?? 0) + 3);
        scores.set(loserId, (scores.get(loserId) ?? 0) - 3);
      }

      comparisons.push({
        leftPlayerId: left.id,
        rightPlayerId: right.id,
        rowWinners,
        scoopWinnerId,
      });
    }
  }

  const players = game.players.map(player => {
    const handScore = scores.get(player.id) ?? 0;
    return {
      ...player,
      handScore,
      totalScore: player.totalScore + handScore,
    };
  });
  const humanScore = players.find(player => player.id === 'human')?.handScore ?? 0;

  return {
    ...game,
    players,
    status: 'complete',
    comparisons,
    message: humanScore > 0
      ? 'You scored +' + humanScore + ' points this hand.'
      : humanScore < 0
        ? 'You lost ' + Math.abs(humanScore) + ' points this hand.'
        : 'This hand ended even for you.',
  };
}

export function startNextChineseDeal(game: ChinesePokerGame): ChinesePokerGame {
  if (game.status !== 'complete') return game;

  const previousScores = Object.fromEntries(
    game.players.map(player => [player.id, player.totalScore]),
  );

  return createChinesePokerGame(
    game.computerCount,
    game.handNumber + 1,
    previousScores,
  );
}
