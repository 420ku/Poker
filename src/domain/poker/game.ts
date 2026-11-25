import { compareHands, evaluateBestHand } from './evaluator';
import type { Card, PlayerId, PlayerState, PokerAction, PokerGame, Street } from './types';

const SUITS: Card['suit'][] = ['spades', 'hearts', 'diamonds', 'clubs'];
const STARTING_STACK = 100;
const SMALL_BLIND = 1;
const BIG_BLIND = 2;
const MAX_COMPUTER_PLAYERS = 5;

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

function createPlayer(id: PlayerId, stack: number, seat: number): PlayerState {
  return {
    id,
    name: id === 'human' ? 'You' : 'Computer ' + seat,
    stack,
    holeCards: [],
    committedThisRound: 0,
    committedTotal: 0,
    folded: false,
    allIn: stack <= 0,
    actedThisRound: false,
    canRaiseThisRound: true,
  };
}

function nextPlayerIndex(
  players: PlayerState[],
  afterIndex: number,
  predicate: (player: PlayerState) => boolean,
): number | null {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (afterIndex + offset) % players.length;
    if (predicate(players[index])) return index;
  }

  return null;
}

function getLivePlayers(players: PlayerState[]): PlayerState[] {
  return players.filter(player => player.stack > 0);
}

function getPot(players: PlayerState[]): number {
  return players.reduce((total, player) => total + player.committedTotal, 0);
}

function postBlind(player: PlayerState, amount: number): void {
  const paid = Math.min(player.stack, amount);
  player.stack -= paid;
  player.committedThisRound += paid;
  player.committedTotal += paid;
  player.allIn = player.stack === 0;
}

function drawCards(deckInput: Card[], amount: number): { deck: Card[]; cards: Card[] } {
  const deck = [...deckInput];
  deck.pop();
  const cards: Card[] = [];

  for (let index = 0; index < amount; index += 1) {
    const card = deck.pop();
    if (card) cards.push(card);
  }

  return { deck, cards };
}

function runOutBoard(deckInput: Card[], communityInput: Card[]): { deck: Card[]; communityCards: Card[] } {
  const deck = [...deckInput];
  const communityCards = [...communityInput];

  while (communityCards.length < 5) {
    deck.pop();
    const cardsToDeal = communityCards.length === 0 ? 3 : 1;
    for (let index = 0; index < cardsToDeal && communityCards.length < 5; index += 1) {
      const card = deck.pop();
      if (card) communityCards.push(card);
    }
  }

  return { deck, communityCards };
}

function clockwiseWinnerOrder(winnerIndexes: number[], dealerIndex: number, seatCount: number): number[] {
  return [...winnerIndexes].sort((left, right) => {
    const leftDistance = (left - dealerIndex + seatCount) % seatCount || seatCount;
    const rightDistance = (right - dealerIndex + seatCount) % seatCount || seatCount;
    return leftDistance - rightDistance;
  });
}

interface Settlement {
  players: PlayerState[];
  winners: PlayerId[];
  contestedPot: number;
  winnerDescriptions: string[];
}

function settlePotLayers(
  game: PokerGame,
  evaluations: Map<PlayerId, ReturnType<typeof evaluateBestHand>> | null,
  forcedWinnerId?: PlayerId,
): Settlement {
  const players = game.players.map(player => ({ ...player }));
  const contributionLevels = Array.from(
    new Set(players.map(player => player.committedTotal).filter(amount => amount > 0)),
  ).sort((a, b) => a - b);

  const winnerIds = new Set<PlayerId>();
  const winnerDescriptions: string[] = [];
  let previousLevel = 0;
  let contestedPot = 0;

  contributionLevels.forEach(level => {
    const contributors = players.filter(player => player.committedTotal >= level);
    const layerAmount = (level - previousLevel) * contributors.length;
    previousLevel = level;

    if (layerAmount <= 0) return;

    if (contributors.length === 1) {
      contributors[0].stack += layerAmount;
      return;
    }

    const eligible = contributors.filter(player => !player.folded);
    if (eligible.length === 0) return;

    let layerWinners: PlayerState[];
    let winningDescription = '';

    if (forcedWinnerId) {
      const forcedWinner = eligible.find(player => player.id === forcedWinnerId);
      layerWinners = forcedWinner ? [forcedWinner] : [eligible[0]];
    } else {
      const ranked = eligible
        .map(player => ({ player, hand: evaluations?.get(player.id) }))
        .filter((entry): entry is { player: PlayerState; hand: NonNullable<typeof entry.hand> } =>
          Boolean(entry.hand),
        )
        .sort((left, right) => compareHands(right.hand, left.hand));

      if (ranked.length === 0) return;
      const bestHand = ranked[0].hand;
      layerWinners = ranked
        .filter(entry => compareHands(entry.hand, bestHand) === 0)
        .map(entry => entry.player);
      winningDescription = bestHand.name;
    }

    const orderedIndexes = clockwiseWinnerOrder(
      layerWinners.map(winner => players.findIndex(player => player.id === winner.id)),
      game.dealerIndex,
      players.length,
    );
    const share = Math.floor(layerAmount / layerWinners.length);
    let remainder = layerAmount % layerWinners.length;

    layerWinners.forEach(winner => {
      winner.stack += share;
      winnerIds.add(winner.id);
    });

    let oddChipIndex = 0;
    while (remainder > 0) {
      players[orderedIndexes[oddChipIndex % orderedIndexes.length]].stack += 1;
      oddChipIndex += 1;
      remainder -= 1;
    }

    contestedPot += layerAmount;
    const names = layerWinners.map(winner => winner.name).join(', ');
    winnerDescriptions.push(winningDescription ? names + ' (' + winningDescription + ')' : names);
  });

  return {
    players,
    winners: Array.from(winnerIds),
    contestedPot,
    winnerDescriptions: Array.from(new Set(winnerDescriptions)),
  };
}

function settleHand(
  game: PokerGame,
  message: string,
  evaluations: Map<PlayerId, ReturnType<typeof evaluateBestHand>> | null,
  forcedWinnerId?: PlayerId,
): PokerGame {
  const settlement = settlePotLayers(game, evaluations, forcedWinnerId);
  const matchOver = getLivePlayers(settlement.players).length <= 1;

  return {
    ...game,
    players: settlement.players,
    pot: settlement.contestedPot,
    currentPlayerIndex: null,
    status: matchOver ? 'match-over' : 'hand-over',
    winners: settlement.winners,
    message,
    handDescription: settlement.winnerDescriptions.join(' · ') || undefined,
  };
}

function settleFold(game: PokerGame, winnerIndex: number): PokerGame {
  const winner = game.players[winnerIndex];
  return settleHand(
    game,
    winner.name + ' wins the hand. All other players folded.',
    null,
    winner.id,
  );
}

function settleShowdown(game: PokerGame): PokerGame {
  const evaluations = new Map<PlayerId, ReturnType<typeof evaluateBestHand>>();
  game.players
    .filter(player => !player.folded && player.holeCards.length === 2)
    .forEach(player => {
      evaluations.set(player.id, evaluateBestHand([...player.holeCards, ...game.communityCards]));
    });

  const ranked = game.players
    .filter(player => !player.folded)
    .map(player => ({ player, hand: evaluations.get(player.id) }))
    .filter((entry): entry is { player: PlayerState; hand: NonNullable<typeof entry.hand> } =>
      Boolean(entry.hand),
    )
    .sort((left, right) => compareHands(right.hand, left.hand));

  const best = ranked[0];
  const tied = best ? ranked.filter(entry => compareHands(entry.hand, best.hand) === 0) : [];
  const message = tied.length > 1
    ? 'Split pot at showdown.'
    : best
      ? best.player.name + ' wins with ' + best.hand.name + '.'
      : 'Showdown complete.';

  return settleHand({ ...game, street: 'showdown' }, message, evaluations);
}

function firstPostFlopActor(game: PokerGame, players: PlayerState[]): number | null {
  return nextPlayerIndex(
    players,
    game.dealerIndex,
    player => !player.folded && !player.allIn,
  );
}

function runOutAndShowdown(game: PokerGame): PokerGame {
  const board = runOutBoard(game.deck, game.communityCards);
  return settleShowdown({
    ...game,
    deck: board.deck,
    communityCards: board.communityCards,
    street: 'showdown',
  });
}

function advanceStreet(game: PokerGame): PokerGame {
  if (game.street === 'river') return settleShowdown({ ...game, street: 'showdown' });

  const nextStreet: Street =
    game.street === 'preflop' ? 'flop' : game.street === 'flop' ? 'turn' : 'river';
  const draw = drawCards(game.deck, nextStreet === 'flop' ? 3 : 1);
  const players = game.players.map(player => ({
    ...player,
    committedThisRound: 0,
    actedThisRound: false,
    canRaiseThisRound: true,
  }));

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

  if (players.filter(player => !player.folded && !player.allIn).length <= 1) {
    return runOutAndShowdown(nextGame);
  }

  const currentPlayerIndex = firstPostFlopActor(nextGame, players);
  return currentPlayerIndex === null
    ? runOutAndShowdown(nextGame)
    : { ...nextGame, currentPlayerIndex };
}

function isBettingRoundComplete(game: PokerGame): boolean {
  const actionable = game.players.filter(player => !player.folded && !player.allIn);
  return actionable.every(
    player => player.actedThisRound && player.committedThisRound === game.currentBet,
  );
}

function progressAfterAction(game: PokerGame): PokerGame {
  const remaining = game.players.filter(player => !player.folded);
  if (remaining.length === 1) {
    return settleFold(game, game.players.findIndex(player => !player.folded));
  }

  if (game.players.some(player => player.allIn)) return runOutAndShowdown(game);
  return advanceStreet(game);
}

export function createGame(
  computerCount = 1,
  stacks?: number[],
  handNumber = 1,
  dealerIndex = 0,
  playerIds?: PlayerId[],
): PokerGame {
  const safeComputerCount = Math.max(1, Math.min(MAX_COMPUTER_PLAYERS, Math.floor(computerCount)));
  const ids = playerIds ?? [
    'human',
    ...Array.from({ length: safeComputerCount }, (_, index) => 'computer-' + (index + 1)),
  ];
  const players = ids.map((id, index) =>
    createPlayer(id, stacks?.[index] ?? STARTING_STACK, index),
  );
  const deck = createDeck();

  if (players.length < 2 || getLivePlayers(players).length < 2) {
    return {
      computerCount: safeComputerCount,
      handNumber,
      dealerIndex: Math.max(0, Math.min(dealerIndex, players.length - 1)),
      players,
      communityCards: [],
      deck,
      street: 'preflop',
      status: 'match-over',
      pot: 0,
      currentBet: 0,
      minRaise: BIG_BLIND,
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      currentPlayerIndex: null,
      winners: [],
      message: 'Not enough players with chips to start a hand.',
    };
  }

  const liveIndexes = players
    .map((player, index) => player.stack > 0 ? index : -1)
    .filter(index => index >= 0);
  const normalizedDealer = players[dealerIndex]?.stack > 0
    ? dealerIndex
    : nextPlayerIndex(players, dealerIndex, player => player.stack > 0) ?? liveIndexes[0];

  const dealOrder: number[] = [];
  let cursor = normalizedDealer;
  for (let index = 0; index < liveIndexes.length; index += 1) {
    const next = nextPlayerIndex(
      players,
      cursor,
      player => player.stack > 0 && !dealOrder.includes(players.indexOf(player)),
    );
    if (next === null) break;
    dealOrder.push(next);
    cursor = next;
  }

  for (let round = 0; round < 2; round += 1) {
    dealOrder.forEach(index => {
      const card = deck.pop();
      if (card) players[index].holeCards.push(card);
    });
  }

  const smallBlindIndex = liveIndexes.length === 2
    ? normalizedDealer
    : nextPlayerIndex(players, normalizedDealer, player => player.stack > 0);
  const bigBlindIndex = smallBlindIndex === null
    ? null
    : nextPlayerIndex(players, smallBlindIndex, player => player.stack > 0);

  if (smallBlindIndex !== null) postBlind(players[smallBlindIndex], SMALL_BLIND);
  if (bigBlindIndex !== null) postBlind(players[bigBlindIndex], BIG_BLIND);

  const currentBet = Math.max(...players.map(player => player.committedThisRound));
  const firstActor = bigBlindIndex === null
    ? null
    : nextPlayerIndex(players, bigBlindIndex, player => !player.folded && !player.allIn);
  const actionable = players.filter(player => !player.folded && !player.allIn);
  const currentPlayerIndex = actionable.length <= 1 &&
    actionable.every(player => player.committedThisRound >= currentBet)
    ? null
    : firstActor;

  const initialGame: PokerGame = {
    computerCount: safeComputerCount,
    handNumber,
    dealerIndex: normalizedDealer,
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
    message: currentPlayerIndex === null
      ? 'All remaining players are all-in. Running out the board.'
      : players[currentPlayerIndex].id === 'human'
        ? 'Your turn. Call, raise, or fold.'
        : players[currentPlayerIndex].name + ' is deciding.',
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

export function applyAction(game: PokerGame, action: PokerAction): PokerGame {
  if (game.status !== 'playing' || game.currentPlayerIndex === null) {
    throw new Error('No player action is available right now.');
  }

  const playerIndex = game.currentPlayerIndex;
  const players = game.players.map(player => ({ ...player }));
  const player = players[playerIndex];
  const toCall = Math.max(0, game.currentBet - player.committedThisRound);
  let currentBet = game.currentBet;
  let minRaise = game.minRaise;
  let actionMessage = '';

  if (action.type === 'fold') {
    player.folded = true;
    const foldedGame = { ...game, players, pot: getPot(players) };
    return settleFold(foldedGame, players.findIndex(candidate => !candidate.folded));
  }

  if (action.type === 'check') {
    if (toCall > 0) throw new Error('Cannot check while facing a bet.');
    player.actedThisRound = true;
    actionMessage = player.name + ' checks.';
  }

  if (action.type === 'call') {
    if (toCall <= 0) throw new Error('There is no bet to call.');
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
    if (isFullRaise) minRaise = raiseSize;

    players.forEach((otherPlayer, index) => {
      if (index !== playerIndex && !otherPlayer.folded && !otherPlayer.allIn) {
        const hadActed = otherPlayer.actedThisRound;
        otherPlayer.actedThisRound = false;
        otherPlayer.canRaiseThisRound =
          isFullRaise || (!hadActed && otherPlayer.canRaiseThisRound);
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

  if (isBettingRoundComplete(updated)) return progressAfterAction(updated);

  const nextIndex = nextPlayerIndex(
    players,
    playerIndex,
    candidate => !candidate.folded && !candidate.allIn,
  );

  return nextIndex === null
    ? progressAfterAction(updated)
    : { ...updated, currentPlayerIndex: nextIndex };
}

export function startNextHand(game: PokerGame): PokerGame {
  if (game.status === 'match-over') return createGame(game.computerCount);

  const activePlayers = game.players.filter(player => player.stack > 0);
  const nextDealerIndex = nextPlayerIndex(
    game.players,
    game.dealerIndex,
    player => player.stack > 0,
  );
  const nextDealerId = nextDealerIndex === null
    ? activePlayers[0]?.id
    : game.players[nextDealerIndex]?.id;
  const playerIds = activePlayers.map(player => player.id);
  const newDealerIndex = Math.max(0, playerIds.findIndex(id => id === nextDealerId));

  return createGame(
    game.computerCount,
    activePlayers.map(player => player.stack),
    game.handNumber + 1,
    newDealerIndex,
    playerIds,
  );
}

function preflopStrength(cards: Card[]): number {
  const first = cards[0];
  const second = cards[1];
  const high = Math.max(first.rank, second.rank);
  const low = Math.min(first.rank, second.rank);
  const gap = high - low;

  if (high === low) return 2.6 + high / 20;
  if (first.suit === second.suit && high >= 11 && gap <= 3) return 2.25;
  if (high >= 13 && low >= 11) return 2.5;
  if (high >= 12 && low >= 9) return 1.8;
  if (first.suit === second.suit && gap <= 2 && high >= 9) return 1.6;
  return high >= 10 ? 1.25 : 0.8;
}

export function chooseComputerAction(game: PokerGame, playerIndex = game.currentPlayerIndex): PokerAction {
  if (playerIndex === null || game.players[playerIndex]?.id === 'human') {
    throw new Error('It is not a computer player’s turn.');
  }

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
    if (toCall >= player.stack) return { type: 'call' };
    if (strength < 1 && toCall > game.bigBlind * 2 && Math.random() < 0.7) {
      return { type: 'fold' };
    }
    if (strength >= 2.8 && canRaise && canMakeMinimumRaise && Math.random() < 0.18) {
      return { type: 'raise', amount: minimumRaiseTo };
    }
    return { type: 'call' };
  }

  if (strength >= 2.8 && canRaise && canMakeMinimumRaise && Math.random() < 0.25) {
    return { type: 'raise', amount: minimumRaiseTo };
  }
  if (canRaise && maximumRaiseTo < minimumRaiseTo && strength >= 2.5) {
    return { type: 'raise', amount: maximumRaiseTo };
  }
  return { type: 'check' };
}
