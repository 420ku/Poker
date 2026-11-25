import { compareHands, evaluateBestHand } from './evaluator';
import type { Card, PlayerId, PlayerState, PokerAction, PokerGame, Street } from './types';

const SUITS: Card['suit'][] = ['spades', 'hearts', 'diamonds', 'clubs'];
const STARTING_STACK = 100;
const SMALL_BLIND = 1;
const BIG_BLIND = 2;

function createDeck(): Card[] {
  const cards: Card[] = [];
  SUITS.forEach(suit => {
    for (let rank = 2; rank <= 14; rank += 1) {
      cards.push({ rank, suit });
    }
  });

  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }

  return cards;
}

function createPlayer(id: PlayerId, stack: number): PlayerState {
  return {
    id,
    name: id === 'human' ? 'You' : 'Computer',
    stack,
    holeCards: [],
    committedThisRound: 0,
    committedTotal: 0,
    folded: false,
    allIn: false,
    actedThisRound: false,
    canRaiseThisRound: true,
  };
}

function postBlind(player: PlayerState, amount: number): void {
  const paid = Math.min(player.stack, amount);
  player.stack -= paid;
  player.committedThisRound += paid;
  player.committedTotal += paid;
  player.allIn = player.stack === 0;
}

function getPot(players: [PlayerState, PlayerState]): number {
  return players[0].committedTotal + players[1].committedTotal;
}

function nextActionablePlayer(players: [PlayerState, PlayerState], afterIndex: number): number | null {
  for (let offset = 1; offset <= 2; offset += 1) {
    const index = (afterIndex + offset) % 2;
    const player = players[index];
    if (!player.folded && !player.allIn) {
      return index;
    }
  }

  return null;
}

export function createGame(
  stacks: [number, number] = [STARTING_STACK, STARTING_STACK],
  handNumber = 1,
  dealerIndex: 0 | 1 = 0,
): PokerGame {
  const deck = createDeck();
  const players: [PlayerState, PlayerState] = [
    createPlayer('human', stacks[0]),
    createPlayer('computer', stacks[1]),
  ];

  for (let round = 0; round < 2; round += 1) {
    players[dealerIndex].holeCards.push(deck.pop() as Card);
    players[1 - dealerIndex].holeCards.push(deck.pop() as Card);
  }

  postBlind(players[dealerIndex], SMALL_BLIND);
  postBlind(players[1 - dealerIndex], BIG_BLIND);

  const currentBet = Math.max(players[0].committedThisRound, players[1].committedThisRound);
  const currentPlayerIndex = players[dealerIndex].allIn
    ? nextActionablePlayer(players, dealerIndex)
    : dealerIndex;

  const initialGame: PokerGame = {
    handNumber,
    dealerIndex,
    players,
    communityCards: [],
    deck,
    street: 'preflop',
    status: 'playing',
    pot: getPot(players),
    currentBet,
    minRaise: BIG_BLIND,
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    currentPlayerIndex,
    winners: [],
    message: currentPlayerIndex === 0 ? 'Your turn. Call, raise, or fold.' : 'Computer is deciding.',
  };

  return currentPlayerIndex === null ? runOutAndShowdown(initialGame) : initialGame;
}

export function getCallAmount(game: PokerGame, playerIndex: number): number {
  const player = game.players[playerIndex];
  return Math.min(player.stack, Math.max(0, game.currentBet - player.committedThisRound));
}

export function getMinimumRaiseTo(game: PokerGame): number {
  return game.currentBet + game.minRaise;
}

export function getMaximumRaiseTo(player: PlayerState): number {
  return player.committedThisRound + player.stack;
}

function settleHand(
  game: PokerGame,
  winnerIds: PlayerId[],
  message: string,
  handDescription?: string,
): PokerGame {
  const players: [PlayerState, PlayerState] = [
    { ...game.players[0] },
    { ...game.players[1] },
  ];

  const contributionDifference = Math.abs(players[0].committedTotal - players[1].committedTotal);
  const largerContributor = players[0].committedTotal >= players[1].committedTotal ? 0 : 1;
  const refund = contributionDifference;

  if (refund > 0) {
    players[largerContributor].stack += refund;
  }

  const contestedPot = Math.max(0, game.pot - refund);
  if (winnerIds.length === 1) {
    const winnerIndex = winnerIds[0] === 'human' ? 0 : 1;
    players[winnerIndex].stack += contestedPot;
  } else if (winnerIds.length === 2) {
    const share = Math.floor(contestedPot / 2);
    players[0].stack += share;
    players[1].stack += share;
    if (contestedPot % 2 === 1) {
      players[game.dealerIndex].stack += 1;
    }
  }

  const matchOver = players.some(player => player.stack <= 0);

  return {
    ...game,
    players,
    pot: contestedPot,
    currentPlayerIndex: null,
    status: matchOver ? 'match-over' : 'hand-over',
    winners: winnerIds,
    message,
    handDescription,
  };
}

function settleFold(game: PokerGame, winnerId: PlayerId): PokerGame {
  const winner = winnerId === 'human' ? 'You' : 'Computer';
  return settleHand(
    game,
    [winnerId],
    winner + ' wins the hand. ' + (winnerId === 'human' ? 'Your opponent folded.' : 'You folded.'),
  );
}

function settleShowdown(game: PokerGame): PokerGame {
  const human = game.players[0];
  const computer = game.players[1];
  const humanHand = evaluateBestHand([...human.holeCards, ...game.communityCards]);
  const computerHand = evaluateBestHand([...computer.holeCards, ...game.communityCards]);
  const comparison = compareHands(humanHand, computerHand);

  if (comparison > 0) {
    return settleHand(game, ['human'], 'You win with ' + humanHand.name + '.', humanHand.name);
  }

  if (comparison < 0) {
    return settleHand(game, ['computer'], 'Computer wins with ' + computerHand.name + '.', computerHand.name);
  }

  return settleHand(game, ['human', 'computer'], 'Split pot. Both players have ' + humanHand.name + '.', humanHand.name);
}

function drawCards(game: PokerGame, amount: number): { deck: Card[]; cards: Card[] } {
  const deck = [...game.deck];
  deck.pop();
  const cards: Card[] = [];
  for (let index = 0; index < amount; index += 1) {
    const card = deck.pop();
    if (card) cards.push(card);
  }
  return { deck, cards };
}

function runOutAndShowdown(game: PokerGame): PokerGame {
  const deck = [...game.deck];
  const communityCards = [...game.communityCards];

  while (communityCards.length < 5) {
    deck.pop();
    const cardsToDeal = communityCards.length === 0 ? 3 : 1;
    for (let index = 0; index < cardsToDeal && communityCards.length < 5; index += 1) {
      const card = deck.pop();
      if (card) communityCards.push(card);
    }
  }

  return settleShowdown({
    ...game,
    deck,
    communityCards,
    street: 'showdown',
  });
}

function firstPostFlopActor(game: PokerGame, players: [PlayerState, PlayerState]): number | null {
  if (!players[game.dealerIndex].folded && !players[game.dealerIndex].allIn) {
    return game.dealerIndex;
  }
  return nextActionablePlayer(players, game.dealerIndex);
}

function advanceStreet(game: PokerGame): PokerGame {
  if (game.street === 'river') {
    return settleShowdown({ ...game, street: 'showdown' });
  }

  const nextStreet: Street =
    game.street === 'preflop' ? 'flop' : game.street === 'flop' ? 'turn' : 'river';
  const cardsToDeal = nextStreet === 'flop' ? 3 : 1;
  const draw = drawCards(game, cardsToDeal);
  const players: [PlayerState, PlayerState] = [
    {
      ...game.players[0],
      committedThisRound: 0,
      actedThisRound: false,
      canRaiseThisRound: true,
    },
    {
      ...game.players[1],
      committedThisRound: 0,
      actedThisRound: false,
      canRaiseThisRound: true,
    },
  ];

  const nextGame: PokerGame = {
    ...game,
    players,
    deck: draw.deck,
    communityCards: [...game.communityCards, ...draw.cards],
    street: nextStreet,
    currentBet: 0,
    minRaise: BIG_BLIND,
    currentPlayerIndex: null,
    message: nextStreet.charAt(0).toUpperCase() + nextStreet.slice(1) + ' dealt.',
  };

  const currentPlayerIndex = firstPostFlopActor(nextGame, players);
  if (currentPlayerIndex === null) {
    return runOutAndShowdown(nextGame);
  }

  return { ...nextGame, currentPlayerIndex };
}

function isBettingRoundComplete(game: PokerGame): boolean {
  const actionablePlayers = game.players.filter(player => !player.folded && !player.allIn);
  return actionablePlayers.every(
    player => player.actedThisRound && player.committedThisRound === game.currentBet,
  );
}

function progressAfterAction(game: PokerGame): PokerGame {
  const remainingPlayers = game.players.filter(player => !player.folded);
  if (remainingPlayers.length === 1) {
    return settleFold(game, remainingPlayers[0].id);
  }

  if (game.players.some(player => player.allIn)) {
    return runOutAndShowdown(game);
  }

  return advanceStreet(game);
}

export function applyAction(game: PokerGame, action: PokerAction): PokerGame {
  if (game.status !== 'playing' || game.currentPlayerIndex === null) {
    throw new Error('No player action is available right now.');
  }

  const playerIndex = game.currentPlayerIndex;
  const players: [PlayerState, PlayerState] = [
    { ...game.players[0] },
    { ...game.players[1] },
  ];
  const player = players[playerIndex];
  const toCall = Math.max(0, game.currentBet - player.committedThisRound);
  let currentBet = game.currentBet;
  let minRaise = game.minRaise;
  let actionMessage = '';

  if (action.type === 'fold') {
    player.folded = true;
    const foldedGame = { ...game, players, pot: getPot(players) };
    return settleFold(foldedGame, players[1 - playerIndex].id);
  }

  if (action.type === 'check') {
    if (toCall > 0) {
      throw new Error('Cannot check while facing a bet.');
    }
    player.actedThisRound = true;
    actionMessage = player.name + ' checks.';
  }

  if (action.type === 'call') {
    if (toCall <= 0) {
      throw new Error('There is no bet to call.');
    }
    const paid = Math.min(player.stack, toCall);
    player.stack -= paid;
    player.committedThisRound += paid;
    player.committedTotal += paid;
    player.allIn = player.stack === 0;
    player.actedThisRound = true;
    actionMessage = player.name + (player.allIn ? ' calls all-in.' : ' calls $' + paid + '.');
  }

  if (action.type === 'raise') {
    const maximumRaiseTo = getMaximumRaiseTo(player);
    const raiseSize = action.amount - currentBet;
    const isAllInRaise = action.amount === maximumRaiseTo;
    const isFullRaise = raiseSize >= minRaise;

    if (!player.canRaiseThisRound) {
      throw new Error('A short all-in did not reopen raising for this player.');
    }
    if (action.amount <= currentBet || action.amount > maximumRaiseTo) {
      throw new Error('Raise amount is outside the legal range.');
    }
    if (raiseSize < minRaise && !isAllInRaise) {
      throw new Error('Raise does not meet the minimum raise.');
    }

    const paid = action.amount - player.committedThisRound;
    player.stack -= paid;
    player.committedThisRound += paid;
    player.committedTotal += paid;
    player.allIn = player.stack === 0;
    player.actedThisRound = true;
    currentBet = action.amount;
    if (isFullRaise) {
      minRaise = raiseSize;
    }

    players.forEach((otherPlayer, index) => {
      if (index !== playerIndex && !otherPlayer.folded && !otherPlayer.allIn) {
        const hadActed = otherPlayer.actedThisRound;
        otherPlayer.actedThisRound = false;
        otherPlayer.canRaiseThisRound = isFullRaise || !hadActed;
      }
    });

    actionMessage = player.name + ' raises to $' + currentBet + (player.allIn ? ' all-in.' : '.');
  }

  const updated: PokerGame = {
    ...game,
    players,
    currentBet,
    minRaise,
    pot: getPot(players),
    message: actionMessage,
  };

  if (isBettingRoundComplete(updated)) {
    return progressAfterAction(updated);
  }

  const nextIndex = nextActionablePlayer(players, playerIndex);
  if (nextIndex === null) {
    return progressAfterAction(updated);
  }

  return { ...updated, currentPlayerIndex: nextIndex };
}

export function startNextHand(game: PokerGame): PokerGame {
  if (game.status === 'match-over') {
    return createGame();
  }

  return createGame(
    [game.players[0].stack, game.players[1].stack],
    game.handNumber + 1,
    game.dealerIndex === 0 ? 1 : 0,
  );
}

function preflopStrength(cards: Card[]): number {
  const first = cards[0];
  const second = cards[1];
  const high = Math.max(first.rank, second.rank);
  const low = Math.min(first.rank, second.rank);
  const gap = high - low;

  if (high === low) {
    return 2.6 + high / 20;
  }
  if (first.suit === second.suit && high >= 11 && gap <= 3) {
    return 2.25;
  }
  if (high >= 13 && low >= 11) {
    return 2.5;
  }
  if (high >= 12 && low >= 9) {
    return 1.8;
  }
  if (first.suit === second.suit && gap <= 2 && high >= 9) {
    return 1.6;
  }
  return high >= 10 ? 1.25 : 0.8;
}

export function chooseComputerAction(game: PokerGame): PokerAction {
  const playerIndex = 1;
  const player = game.players[playerIndex];
  const toCall = getCallAmount(game, playerIndex);
  const cards = [...player.holeCards, ...game.communityCards];
  const evaluation = game.communityCards.length >= 3 ? evaluateBestHand(cards) : null;
  const strength = evaluation
    ? evaluation.category + (evaluation.kickers[0] ?? 0) / 100
    : preflopStrength(player.holeCards);

  const minimumRaiseTo = getMinimumRaiseTo(game);
  const maximumRaiseTo = getMaximumRaiseTo(player);
  const canRaise = player.canRaiseThisRound && maximumRaiseTo > game.currentBet;
  const canMakeMinimumRaise = maximumRaiseTo >= minimumRaiseTo;

  if (toCall > 0) {
    if (strength < 1 && toCall > game.bigBlind * 2 && Math.random() < 0.75) {
      return { type: 'fold' };
    }

    if (strength >= 2.8 && canRaise && canMakeMinimumRaise && Math.random() < 0.22) {
      return { type: 'raise', amount: minimumRaiseTo };
    }

    return { type: 'call' };
  }

  if (strength >= 2.8 && canRaise && canMakeMinimumRaise && Math.random() < 0.35) {
    return { type: 'raise', amount: minimumRaiseTo };
  }

  if (canRaise && maximumRaiseTo < minimumRaiseTo && strength >= 2.5) {
    return { type: 'raise', amount: maximumRaiseTo };
  }

  return { type: 'check' };
}
