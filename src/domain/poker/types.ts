export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface Card {
  rank: number;
  suit: Suit;
}

export type PlayerId = 'human' | 'computer';
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type GameStatus = 'playing' | 'hand-over' | 'match-over';

export interface PlayerState {
  id: PlayerId;
  name: string;
  stack: number;
  holeCards: Card[];
  committedThisRound: number;
  committedTotal: number;
  folded: boolean;
  allIn: boolean;
  actedThisRound: boolean;
  canRaiseThisRound: boolean;
}

export interface PokerGame {
  handNumber: number;
  dealerIndex: 0 | 1;
  players: [PlayerState, PlayerState];
  communityCards: Card[];
  deck: Card[];
  street: Street;
  status: GameStatus;
  pot: number;
  currentBet: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  currentPlayerIndex: number | null;
  winners: PlayerId[];
  message: string;
  handDescription?: string;
}

export type PokerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; amount: number };

export interface HandEvaluation {
  category: number;
  name: string;
  kickers: number[];
  cards: Card[];
}
