import type { Card, HandEvaluation } from './types';

const HAND_NAMES = [
  'High card',
  'One pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush',
];

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

function getStraightHigh(ranks: number[]): number {
  const unique = Array.from(new Set(ranks)).sort((a, b) => b - a);
  if (unique.includes(14)) {
    unique.push(1);
  }

  for (let index = 0; index <= unique.length - 5; index += 1) {
    const window = unique.slice(index, index + 5);
    if (window[0] - window[4] === 4) {
      return window[0];
    }
  }

  return 0;
}

function evaluateFive(cards: Card[]): HandEvaluation {
  const ranks = cards.map(card => card.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();

  ranks.forEach(rank => counts.set(rank, (counts.get(rank) ?? 0) + 1));

  const groups = Array.from(counts.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const isFlush = cards.every(card => card.suit === cards[0].suit);
  const straightHigh = getStraightHigh(ranks);

  if (isFlush && straightHigh > 0) {
    return { category: 8, name: HAND_NAMES[8], kickers: [straightHigh], cards };
  }

  if (groups[0].count === 4) {
    return {
      category: 7,
      name: HAND_NAMES[7],
      kickers: [groups[0].rank, groups[1].rank],
      cards,
    };
  }

  if (groups[0].count === 3 && groups[1].count >= 2) {
    return {
      category: 6,
      name: HAND_NAMES[6],
      kickers: [groups[0].rank, groups[1].rank],
      cards,
    };
  }

  if (isFlush) {
    return { category: 5, name: HAND_NAMES[5], kickers: ranks, cards };
  }

  if (straightHigh > 0) {
    return { category: 4, name: HAND_NAMES[4], kickers: [straightHigh], cards };
  }

  if (groups[0].count === 3) {
    return {
      category: 3,
      name: HAND_NAMES[3],
      kickers: [groups[0].rank, ...groups.slice(1).map(group => group.rank)],
      cards,
    };
  }

  const pairs = groups.filter(group => group.count === 2).map(group => group.rank);
  if (pairs.length >= 2) {
    const highPairs = pairs.slice(0, 2);
    const kicker = groups.find(group => group.count === 1)?.rank ?? 0;
    return {
      category: 2,
      name: HAND_NAMES[2],
      kickers: [...highPairs, kicker],
      cards,
    };
  }

  if (pairs.length === 1) {
    return {
      category: 1,
      name: HAND_NAMES[1],
      kickers: [pairs[0], ...groups.filter(group => group.count === 1).map(group => group.rank)],
      cards,
    };
  }

  return { category: 0, name: HAND_NAMES[0], kickers: ranks, cards };
}

export function compareHands(left: HandEvaluation, right: HandEvaluation): number {
  if (left.category !== right.category) {
    return left.category > right.category ? 1 : -1;
  }

  const length = Math.max(left.kickers.length, right.kickers.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left.kickers[index] ?? 0;
    const rightValue = right.kickers[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
}

export function evaluateBestHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5) {
    throw new Error('At least five cards are required to evaluate a poker hand.');
  }

  const candidates = combinations(cards, 5);
  let best = evaluateFive(candidates[0]);

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = evaluateFive(candidates[index]);
    if (compareHands(candidate, best) > 0) {
      best = candidate;
    }
  }

  return best;
}

export function getRankLabel(rank: number): string {
  if (rank === 14) return 'A';
  if (rank === 13) return 'K';
  if (rank === 12) return 'Q';
  if (rank === 11) return 'J';
  return String(rank);
}

export function getSuitSymbol(suit: Card['suit']): string {
  switch (suit) {
    case 'spades':
      return '♠';
    case 'hearts':
      return '♥';
    case 'diamonds':
      return '♦';
    case 'clubs':
      return '♣';
  }
}

export function isRedSuit(suit: Card['suit']): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}
