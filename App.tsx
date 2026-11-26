import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { applyAction, chooseComputerAction, createGame, startNextHand } from './src/domain/poker/game';
import {
  createChinesePokerGame,
  placeChineseCard,
  removeChineseCard,
  startNextChineseDeal,
  submitChinesePokerArrangement,
} from './src/domain/poker/chinesePoker';
import type {
  ChinesePokerGame,
  ChinesePokerRow,
} from './src/domain/poker/chinesePoker';
import type { Card, PokerAction, PokerGame } from './src/domain/poker/types';
import { HomeScreen } from './src/features/home/HomeScreen';
import { PokerTableScreen } from './src/features/game/PokerTableScreen';
import { ChinesePokerScreen } from './src/features/game/ChinesePokerScreen';
import { PauseScreen } from './src/features/game/PauseScreen';
import { WalletScreen } from './src/features/wallet/WalletScreen';
import { createWalletTopup, loadWalletSummary, type WalletTopupHistoryItem } from './src/services/walletRepository';
import {
  ensureAnonymousPlayer,
  loadSavedPokerSession,
  savePokerSession,
} from './src/services/pokerSessionRepository';
import { isSupabaseConfigured, supabase } from './src/lib/supabase/client';
import {
  beginGoogleSignIn,
  completeGoogleOAuth,
  GOOGLE_OAUTH_REDIRECT_URL,
} from './src/services/authRepository';

type Screen = 'home' | 'game' | 'paused' | 'chinese' | 'wallet';
type GameMode = 'holdem' | 'chinese';
type CloudStatus = 'connecting' | 'connected' | 'offline' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Supabase error.';
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('home');
  const [gameMode, setGameMode] = useState<GameMode>('holdem');
  const [computerPlayers, setComputerPlayers] = useState(1);
  const [game, setGame] = useState<PokerGame | null>(null);
  const [chineseGame, setChineseGame] = useState<ChinesePokerGame | null>(null);
  const [savedGame, setSavedGame] = useState<PokerGame | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('connecting');
  const [cloudMessage, setCloudMessage] = useState('');
  const [isGoogleAccount, setIsGoogleAccount] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [walletBalanceCredits, setWalletBalanceCredits] = useState(0);
  const [walletTopups, setWalletTopups] = useState<WalletTopupHistoryItem[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveVersion = useRef(0);
  currentGameRef.current = game;
  const lastAuthUserId = useRef<string | null>(null);
  const currentGameRef = useRef<PokerGame | null>(null);
  const skipNextSaveForUserId = useRef<string | null>(null);

  const refreshWallet = useCallback(async (id: string, showLoading = true) => {
    if (showLoading) setWalletLoading(true);
    try {
      const summary = await loadWalletSummary(id);
      setWalletBalanceCredits(summary.balanceCredits);
      setWalletTopups(summary.topups);
      setWalletError('');
    } catch (error) {
      setWalletError(describeError(error));
    } finally {
      if (showLoading) setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      const identities = user?.identities ?? [];
      const providers = user?.app_metadata?.providers;
      const linkedToGoogle =
        identities.some(identity => identity.provider === 'google') ||
        user?.app_metadata?.provider === 'google' ||
        (Array.isArray(providers) && providers.includes('google'));

      setUserId(user?.id ?? null);
      setAuthEmail(user?.email ?? null);
      setIsGoogleAccount(linkedToGoogle);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    let mounted = true;
    const handledUrls = new Set<string>();

    async function handleAuthUrl(url: string) {
      if (!url.startsWith(GOOGLE_OAUTH_REDIRECT_URL) || handledUrls.has(url)) return;
      handledUrls.add(url);

      try {
        await completeGoogleOAuth(url);
        if (mounted) setAuthError('');
      } catch (error) {
        const message = describeError(error);
        if (/identity_already_exists|already linked|identity.*exists/i.test(message)) {
          Alert.alert(
            'Google account already exists',
            'This Google account is already connected to another Poker profile. Sign in to that profile instead? Guest wallet and game data on this device will not be merged automatically.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign in', onPress: () => void handleGoogleSignIn(true) },
            ],
          );
          return;
        }

        if (mounted) setAuthError(message);
      }
    }

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url);
    });

    void Linking.getInitialURL()
      .then(url => {
        if (url) return handleAuthUrl(url);
        return undefined;
      })
      .catch(error => {
        if (mounted) setAuthError(describeError(error));
      });

    return () => {
      mounted = false;
      linkingSubscription.remove();
    };
  }, []);

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

        setCloudStatus('connected');
        setCloudMessage('');
        setSaveStatus('idle');
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

  useEffect(() => {
    if (!userId) return undefined;

    let active = true;
    setSavedGame(null);

    async function restoreUserSession() {
      try {
        const saved = await loadSavedPokerSession(userId);
        if (!active) return;

        setSavedGame(saved?.game ?? null);
        if (saved) setComputerPlayers(saved.game.computerCount);
        setSaveStatus(saved ? 'saved' : 'idle');
      } catch (error) {
        if (!active) return;
        setCloudStatus('error');
        setCloudMessage(describeError(error));
        setSaveStatus('error');
      }
    }

    void restoreUserSession();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const previousUserId = lastAuthUserId.current;
    lastAuthUserId.current = userId;

    if (previousUserId !== null && previousUserId !== userId && currentGameRef.current) {
      skipNextSaveForUserId.current = userId;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    void refreshWallet(userId);
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        void refreshWallet(userId, false);
      }
    });

    return () => subscription.remove();
  }, [userId, refreshWallet]);

  async function handleCreateWalletTopup(amountPhp: number) {
    if (!userId) throw new Error('Connect to Supabase before opening wallet checkout.');
    setWalletError('');
    const checkout = await createWalletTopup(amountPhp);
    await Linking.openURL(checkout.checkoutUrl);
  }

  // Serialize writes so a slower earlier request cannot overwrite a newer chip snapshot.
  useEffect(() => {
    if (!game) return;

    if (!userId) {
      setSaveStatus('offline');
      return;
    }

    // Do not copy a guest's in-memory game over an existing account's saved game
    // when the user chooses the existing-account OAuth fallback.
    if (skipNextSaveForUserId.current === userId) {
      skipNextSaveForUserId.current = null;
      setSaveStatus('idle');
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

  // Stop Hold’em computer actions when the app is backgrounded.
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

  function handleGameModeChange(mode: GameMode) {
    setGameMode(mode);
    if (mode === 'chinese') {
      setComputerPlayers(current => Math.min(3, current));
    }
  }

  function startGame() {
    if (gameMode === 'chinese') {
      setChineseGame(createChinesePokerGame(computerPlayers));
      setGame(null);
      setIsPaused(false);
      setScreen('chinese');
      return;
    }

    setSavedGame(null);
    setGame(createGame(computerPlayers));
    setIsPaused(false);
    setScreen('game');
  }

  function resumeSelectedGame() {
    if (gameMode === 'chinese') {
      if (!chineseGame) return;
      setScreen('chinese');
      return;
    }

    if (!savedGame) return;
    setGame(savedGame);
    setIsPaused(false);
    setScreen('game');
  }

  function handleAction(action: PokerAction) {
    setGame(current => (current ? applyAction(current, action) : current));
  }

  function backToLobby() {
    if (game) setSavedGame(game);
    setIsPaused(true);
    setScreen('home');
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

  function handlePlaceChineseCard(card: Card, row: ChinesePokerRow) {
    setChineseGame(current => current ? placeChineseCard(current, card, row) : current);
  }

  function handleRemoveChineseCard(card: Card, row: ChinesePokerRow) {
    setChineseGame(current => current ? removeChineseCard(current, row, card) : current);
  }

  function handleSubmitChineseArrangement() {
    setChineseGame(current => current ? submitChinesePokerArrangement(current) : current);
  }

  function handleNextChineseDeal() {
    setChineseGame(current => current ? startNextChineseDeal(current) : current);
  }

  async function handleGoogleSignIn(signInToExistingAccount = false) {
    setAuthLoading(true);
    setAuthError('');
    try {
      await beginGoogleSignIn(signInToExistingAccount);
    } catch (error) {
      setAuthError(describeError(error));
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {screen === 'home' ? (
        <HomeScreen
          gameMode={gameMode}
          onGameModeChange={handleGameModeChange}
          computerPlayers={computerPlayers}
          onComputerPlayersChange={setComputerPlayers}
          onStartGame={startGame}
          hasSavedGame={gameMode === 'chinese' ? Boolean(chineseGame) : Boolean(savedGame)}
          onResumeGame={resumeSelectedGame}
          cloudStatus={cloudStatus}
          cloudMessage={cloudMessage}
          walletBalanceCredits={walletBalanceCredits}
          onOpenWallet={() => setScreen('wallet')}
          isGoogleAccount={isGoogleAccount}
          authEmail={authEmail}
          authLoading={authLoading}
          authError={authError}
          canSignInWithGoogle={Boolean(userId && isSupabaseConfigured)}
          onGoogleSignIn={handleGoogleSignIn}
        />
      ) : screen === 'wallet' ? (
        <WalletScreen
          balanceCredits={walletBalanceCredits}
          topups={walletTopups}
          loading={walletLoading}
          error={walletError || (!userId ? 'Supabase authentication is required for wallet access.' : '')}
          onBack={() => setScreen('home')}
          onRefresh={() => userId ? refreshWallet(userId) : Promise.resolve()}
          onCreateTopup={handleCreateWalletTopup}
        />
      ) : screen === 'chinese' && chineseGame ? (
        <ChinesePokerScreen
          game={chineseGame}
          onBackToLobby={() => setScreen('home')}
          onPlaceCard={handlePlaceChineseCard}
          onRemoveCard={handleRemoveChineseCard}
          onSubmit={handleSubmitChineseArrangement}
          onNextDeal={handleNextChineseDeal}
        />
      ) : screen === 'paused' && game ? (
        <PauseScreen
          game={game}
          saveStatus={saveStatus}
          onResume={resumeCurrentGame}
          onReturnHome={returnToHome}
        />
      ) : game ? (
        <PokerTableScreen
          game={game}
          saveStatus={saveStatus}
          onBackToLobby={backToLobby}
          onAction={handleAction}
          onNextHand={handleNextHand}
          onNewGame={handleNewGame}
        />
      ) : (
        <HomeScreen
          gameMode={gameMode}
          onGameModeChange={handleGameModeChange}
          computerPlayers={computerPlayers}
          onComputerPlayersChange={setComputerPlayers}
          onStartGame={startGame}
          hasSavedGame={gameMode === 'chinese' ? Boolean(chineseGame) : Boolean(savedGame)}
          onResumeGame={resumeSelectedGame}
          cloudStatus={cloudStatus}
          cloudMessage={cloudMessage}
          walletBalanceCredits={walletBalanceCredits}
          onOpenWallet={() => setScreen('wallet')}
          isGoogleAccount={isGoogleAccount}
          authEmail={authEmail}
          authLoading={authLoading}
          authError={authError}
          canSignInWithGoogle={Boolean(userId && isSupabaseConfigured)}
          onGoogleSignIn={handleGoogleSignIn}
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
