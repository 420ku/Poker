import React, { useEffect, useRef, useState } from 'react';
import { AppState, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { applyAction, chooseComputerAction, createGame, startNextHand } from './src/domain/poker/game';
import type { PokerAction, PokerGame } from './src/domain/poker/types';
import { HomeScreen } from './src/features/home/HomeScreen';
import { PokerTableScreen } from './src/features/game/PokerTableScreen';
import { PauseScreen } from './src/features/game/PauseScreen';
import {
  ensureAnonymousPlayer,
  loadSavedPokerSession,
  savePokerSession,
} from './src/services/pokerSessionRepository';
import { isSupabaseConfigured } from './src/lib/supabase/client';

type Screen = 'home' | 'game' | 'paused';
type CloudStatus = 'connecting' | 'connected' | 'offline' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Supabase error.';
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('home');
  const [computerPlayers, setComputerPlayers] = useState(1);
  const [game, setGame] = useState<PokerGame | null>(null);
  const [savedGame, setSavedGame] = useState<PokerGame | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('connecting');
  const [cloudMessage, setCloudMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveVersion = useRef(0);

  useEffect(() => {
    let active = true;

    async function initializeCloudSession() {
      if (!isSupabaseConfigured) {
        setCloudStatus('offline');
        setCloudMessage('Add Supabase URL and publishable key to .env to enable cloud saves.');
        setSaveStatus('offline');
        return;
      }

      try {
        const id = await ensureAnonymousPlayer();
        if (!active) return;
        setUserId(id);

        const saved = await loadSavedPokerSession(id);
        if (!active) return;
        setSavedGame(saved?.game ?? null);
        if (saved) setComputerPlayers(saved.game.computerCount);
        setCloudStatus('connected');
        setCloudMessage('');
        setSaveStatus(saved ? 'saved' : 'idle');
      } catch (error) {
        if (!active) return;
        setCloudStatus('error');
        setCloudMessage(describeError(error));
        setSaveStatus('error');
      }
    }

    void initializeCloudSession();
    return () => {
      active = false;
    };
  }, []);

  // Serialize writes so a slower earlier request cannot overwrite a newer chip snapshot.
  useEffect(() => {
    if (!game) return;

    if (!userId) {
      setSaveStatus('offline');
      return;
    }

    const version = ++saveVersion.current;
    const snapshot = game;
    const pausedSnapshot = isPaused;

    setSaveStatus('saving');
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        await savePokerSession(userId, snapshot, pausedSnapshot);
        if (version === saveVersion.current) {
          setSaveStatus('saved');
          setSavedGame(snapshot.status === 'match-over' ? null : snapshot);
          setCloudStatus('connected');
          setCloudMessage('');
        }
      })
      .catch(error => {
        if (version === saveVersion.current) {
          setSaveStatus('error');
          setCloudStatus('error');
          setCloudMessage(describeError(error));
        }
      });
  }, [game, isPaused, userId]);

  // Stop computer actions when the app is backgrounded; the next foreground visit resumes manually.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active' && screen === 'game' && game) {
        setSavedGame(game);
        setIsPaused(true);
        setScreen('paused');
      }
    });

    return () => subscription.remove();
  }, [game, screen]);

  useEffect(() => {
    if (
      screen !== 'game' ||
      isPaused ||
      !game ||
      game.status !== 'playing' ||
      game.currentPlayerIndex === null
    ) {
      return undefined;
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    if (currentPlayer.id === 'human') return undefined;

    const timer = setTimeout(() => {
      setGame(current => {
        if (
          !current ||
          current.status !== 'playing' ||
          current.currentPlayerIndex === null ||
          current.players[current.currentPlayerIndex].id === 'human'
        ) {
          return current;
        }

        return applyAction(
          current,
          chooseComputerAction(current, current.currentPlayerIndex),
        );
      });
    }, 650);

    return () => clearTimeout(timer);
  }, [game, screen, isPaused]);

  function startGame() {
    const nextGame = createGame(computerPlayers);
    setSavedGame(null);
    setGame(nextGame);
    setIsPaused(false);
    setScreen('game');
  }

  function resumeSavedGame() {
    if (!savedGame) return;
    setGame(savedGame);
    setIsPaused(false);
    setScreen('game');
  }

  function handleAction(action: PokerAction) {
    setGame(current => (current ? applyAction(current, action) : current));
  }

  function pauseGame() {
    if (game) setSavedGame(game);
    setIsPaused(true);
    setScreen('paused');
  }

  function resumeCurrentGame() {
    setIsPaused(false);
    setScreen('game');
  }

  function returnToHome() {
    setIsPaused(true);
    setScreen('home');
  }

  function handleNextHand() {
    setGame(current => (current ? startNextHand(current) : createGame(computerPlayers)));
  }

  function handleNewGame() {
    const count = game?.computerCount ?? computerPlayers;
    setSavedGame(null);
    setGame(createGame(count));
    setIsPaused(false);
    setScreen('game');
  }

  return (
    <View style={styles.container}>
      {screen === 'home' || !game ? (
        <HomeScreen
          computerPlayers={computerPlayers}
          onComputerPlayersChange={setComputerPlayers}
          onStartGame={startGame}
          hasSavedGame={Boolean(savedGame)}
          onResumeGame={resumeSavedGame}
          cloudStatus={cloudStatus}
          cloudMessage={cloudMessage}
        />
      ) : screen === 'paused' ? (
        <PauseScreen
          game={game}
          saveStatus={saveStatus}
          onResume={resumeCurrentGame}
          onReturnHome={returnToHome}
        />
      ) : (
        <PokerTableScreen
          game={game}
          saveStatus={saveStatus}
          onPause={pauseGame}
          onAction={handleAction}
          onNextHand={handleNextHand}
          onNewGame={handleNewGame}
        />
      )}
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="#071812" />
        <AppContent />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#071812' },
  container: { flex: 1 },
});

export default App;
