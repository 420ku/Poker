import type { PokerGame } from '../domain/poker/types';
import { supabase } from '../lib/supabase/client';

export type SavedSessionStatus = 'active' | 'paused' | 'completed';

export interface SavedPokerSession {
  game: PokerGame;
  status: SavedSessionStatus;
  updatedAt: string;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to .env.',
    );
  }

  return supabase;
}

export async function ensureAnonymousPlayer(): Promise<string> {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();

  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user.id;

  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return an authenticated player.');

  return data.user.id;
}

function isPokerGameSnapshot(value: unknown): value is PokerGame {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<PokerGame>;
  return (
    Array.isArray(candidate.players) &&
    candidate.players.length >= 2 &&
    candidate.players.some(player => player?.id === 'human') &&
    Array.isArray(candidate.communityCards) &&
    Array.isArray(candidate.deck) &&
    typeof candidate.handNumber === 'number' &&
    typeof candidate.computerCount === 'number' &&
    typeof candidate.currentBet === 'number' &&
    typeof candidate.pot === 'number'
  );
}

export async function loadSavedPokerSession(userId: string): Promise<SavedPokerSession | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('poker_game_sessions')
    .select('game_state, session_status, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.session_status === 'completed') return null;

  if (!isPokerGameSnapshot(data.game_state)) {
    throw new Error('Saved poker session has an invalid game-state format.');
  }

  return {
    game: data.game_state,
    status: data.session_status as SavedSessionStatus,
    updatedAt: data.updated_at,
  };
}

export async function savePokerSession(
  userId: string,
  game: PokerGame,
  isPaused: boolean,
): Promise<void> {
  const client = requireSupabase();
  const sessionStatus: SavedSessionStatus =
    game.status === 'match-over' ? 'completed' : isPaused ? 'paused' : 'active';

  const chipStacks = game.players.map(player => ({
    player_id: player.id,
    player_name: player.name,
    chips: player.stack,
    committed_this_round: player.committedThisRound,
    committed_total: player.committedTotal,
    folded: player.folded,
    all_in: player.allIn,
  }));

  const { error } = await client
    .from('poker_game_sessions')
    .upsert(
      {
        user_id: userId,
        computer_count: game.computerCount,
        session_status: sessionStatus,
        game_state: game,
        chip_stacks: chipStacks,
      },
      { onConflict: 'user_id' },
    );

  if (error) throw error;
}
