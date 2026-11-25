import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createGame, applyAction, chooseComputerAction, startNextHand } from './src/domain/poker/game';
import type { PokerAction, PokerGame } from './src/domain/poker/types';
import { HomeScreen } from './src/features/home/HomeScreen';
import { PokerTableScreen } from './src/features/game/PokerTableScreen';

type Screen = 'home' | 'game';

function AppContent() {
  const [screen, setScreen] = useState<Screen>('home');
  const [game, setGame] = useState<PokerGame | null>(null);

  useEffect(() => {
    if (screen !== 'game' || !game || game.status !== 'playing' || game.currentPlayerIndex !== 1) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setGame(current => {
        if (
          !current ||
          current.status !== 'playing' ||
          current.currentPlayerIndex !== 1
        ) {
          return current;
        }

        return applyAction(current, chooseComputerAction(current));
      });
    }, 750);

    return () => clearTimeout(timer);
  }, [game, screen]);

  function startGame() {
    setGame(createGame());
    setScreen('game');
  }

  function handleAction(action: PokerAction) {
    setGame(current => (current ? applyAction(current, action) : current));
  }

  function handleNextHand() {
    setGame(current => (current ? startNextHand(current) : createGame()));
  }

  function handleNewGame() {
    setGame(createGame());
  }

  return (
    <View style={styles.container}>
      {screen === 'home' || !game ? (
        <HomeScreen onStartGame={startGame} />
      ) : (
        <PokerTableScreen
          game={game}
          onBack={() => setScreen('home')}
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
  safeArea: {
    flex: 1,
    backgroundColor: '#071812',
  },
  container: {
    flex: 1,
  },
});

export default App;
