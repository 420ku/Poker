import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { WalletTopupHistoryItem } from '../../services/walletRepository';

const PACKAGES = [50, 100, 250, 500];

interface WalletScreenProps {
  balanceCredits: number;
  topups: WalletTopupHistoryItem[];
  loading: boolean;
  error: string;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onCreateTopup: (amountPhp: number) => Promise<void>;
}

export function WalletScreen({
  balanceCredits,
  topups,
  loading,
  error,
  onBack,
  onRefresh,
  onCreateTopup,
}: WalletScreenProps) {
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [localError, setLocalError] = useState('');

  async function handleTopup(amountPhp: number) {
    setSelectedPackage(amountPhp);
    setLocalError('');
    try {
      await onCreateTopup(amountPhp);
    } catch (topupError) {
      setLocalError(
        topupError instanceof Error ? topupError.message : 'Unable to open checkout.',
      );
    } finally {
      setSelectedPackage(null);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>LOBBY</Text>
        </Pressable>
        <Text style={styles.topTitle}>DEMO WALLET</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh wallet"
          disabled={loading}
          onPress={() => void onRefresh()}
          style={styles.refreshButton}>
          <Text style={styles.refreshText}>REFRESH</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>POKER ROOM · PORTFOLIO DEMO</Text>
        <Text style={styles.title}>Your credits</Text>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>AVAILABLE DEMO CREDITS</Text>
          <Text style={styles.balanceValue}>{balanceCredits.toLocaleString('en-PH')}</Text>
          <Text style={styles.balanceCaption}>Credits have no cash value</Text>
        </View>

        <Text style={styles.sectionTitle}>ADD DEMO CREDITS</Text>
        <Text style={styles.sectionDescription}>
          Choose a sandbox package. Checkout opens on Xendit’s hosted payment page.
        </Text>
        <View style={styles.packageGrid}>
          {PACKAGES.map(amountPhp => {
            const isSelected = selectedPackage === amountPhp;
            const isDisabled = selectedPackage !== null;
            return (
              <Pressable
                key={amountPhp}
                accessibilityRole="button"
                accessibilityState={{ disabled: isDisabled, selected: isSelected }}
                disabled={isDisabled}
                onPress={() => void handleTopup(amountPhp)}
                style={({ pressed }) => [
                  styles.packageCard,
                  isSelected && styles.packageCardSelected,
                  pressed && styles.pressed,
                  isDisabled && !isSelected && styles.disabled,
                ]}>
                {isSelected ? (
                  <ActivityIndicator color="#14251b" />
                ) : (
                  <>
                    <Text style={[styles.packageAmount, isSelected && styles.packageTextSelected]}>
                      ₱{amountPhp}
                    </Text>
                    <Text style={[styles.packageCredits, isSelected && styles.packageTextSelected]}>
                      +{(amountPhp * 100).toLocaleString('en-PH')} CREDITS
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>SANDBOX ONLY</Text>
          <Text style={styles.noticeText}>
            This wallet is for showcasing a mobile payment integration. Credits are non-transferable,
            cannot be withdrawn, and are not redeemable for cash or prizes. Table stacks remain
            separate from this demo balance. Only Xendit Test Mode keys are accepted.
          </Text>
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>RECENT TOP-UPS</Text>
          {loading ? <ActivityIndicator color="#d5b36a" size="small" /> : null}
        </View>
        {topups.length === 0 ? (
          <Text style={styles.emptyText}>No top-ups yet.</Text>
        ) : (
          topups.map(topup => (
            <View key={topup.id} style={styles.historyRow}>
              <View style={styles.historyInfo}>
                <Text style={styles.historyAmount}>₱{Number(topup.amount_php).toLocaleString('en-PH')}</Text>
                <Text style={styles.historyDate}>
                  {new Date(topup.created_at).toLocaleDateString('en-PH')}
                </Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={styles.historyCredits}>
                  +{Number(topup.credits).toLocaleString('en-PH')}
                </Text>
                <Text
                  style={[
                    styles.historyStatus,
                    topup.status === 'completed' && styles.statusCompleted,
                    topup.status === 'failed' && styles.statusFailed,
                  ]}>
                  {topup.status.toUpperCase()}
                </Text>
              </View>
            </View>
          ))
        )}
        <Text style={styles.footerNote}>
          After checkout, return to this screen and refresh. Credits are added only after a verified
          Xendit webhook.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#071812' },
  topBar: {
    minHeight: 62,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1b3528',
  },
  backButton: { minWidth: 76, flexDirection: 'row', alignItems: 'center' },
  backArrow: { color: '#d5b36a', fontSize: 28, lineHeight: 30 },
  backText: { marginLeft: 4, color: '#c7d0c8', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  topTitle: { flex: 1, color: '#f0eadc', fontSize: 10, fontWeight: '900', letterSpacing: 1.6, textAlign: 'center' },
  refreshButton: { minWidth: 76, alignItems: 'flex-end' },
  refreshText: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  content: { paddingHorizontal: 22, paddingTop: 25, paddingBottom: 36 },
  eyebrow: { color: '#d5b36a', fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  title: { marginTop: 9, color: '#f4efe5', fontSize: 29, fontWeight: '900' },
  balanceCard: {
    marginTop: 18, padding: 20, borderRadius: 18, backgroundColor: '#183426',
    borderWidth: 1, borderColor: '#52633f',
  },
  balanceLabel: { color: '#a9b9ae', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  balanceValue: { marginTop: 8, color: '#f5f0e5', fontSize: 38, fontWeight: '900' },
  balanceCaption: { marginTop: 5, color: '#d5b36a', fontSize: 10, fontWeight: '700' },
  sectionTitle: { color: '#d5b36a', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  sectionDescription: { marginTop: 7, color: '#a9b9ae', fontSize: 12, lineHeight: 18 },
  packageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 13 },
  packageCard: {
    width: '48%', minHeight: 75, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: '#11291f', borderWidth: 1, borderColor: '#36503c',
  },
  packageCardSelected: { backgroundColor: '#d5b36a', borderColor: '#e3c783' },
  packageAmount: { color: '#f4efe5', fontSize: 19, fontWeight: '900' },
  packageCredits: { marginTop: 5, color: '#9fb0a2', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  packageTextSelected: { color: '#14251b' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
  errorText: { marginTop: 12, color: '#edaaa2', fontSize: 11, lineHeight: 16 },
  noticeCard: {
    marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: '#11291f',
    borderWidth: 1, borderColor: '#36503c',
  },
  noticeTitle: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  noticeText: { marginTop: 6, color: '#a9b9ae', fontSize: 10, lineHeight: 16 },
  historyHeader: { marginTop: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#243b2d',
  },
  historyInfo: { flex: 1 },
  historyAmount: { color: '#f0eadc', fontSize: 12, fontWeight: '800' },
  historyDate: { marginTop: 4, color: '#83988a', fontSize: 9 },
  historyRight: { alignItems: 'flex-end' },
  historyCredits: { color: '#e6d095', fontSize: 11, fontWeight: '900' },
  historyStatus: { marginTop: 4, color: '#a9b9ae', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  statusCompleted: { color: '#82bd90' },
  statusFailed: { color: '#edaaa2' },
  emptyText: { marginTop: 13, color: '#83988a', fontSize: 11 },
  footerNote: { marginTop: 17, color: '#83988a', fontSize: 9, lineHeight: 14, textAlign: 'center' },
});
