import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface ProfileScreenProps {
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  userId: string | null;
  createdAt: string | null;
  signOutLoading: boolean;
  error: string;
  onSignOut: () => void;
}

function formatDate(value: string | null): string {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInitials(value: string | null): string {
  const words = (value ?? 'Poker Player').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(word => word[0]?.toUpperCase() ?? '').join('');
}

export function ProfileScreen({
  email,
  fullName,
  avatarUrl,
  userId,
  createdAt,
  signOutLoading,
  error,
  onSignOut,
}: ProfileScreenProps) {
  const displayName = fullName?.trim() || email?.split('@')[0] || 'Poker Player';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>PLAYER ACCOUNT</Text>
        <Text style={styles.title}>Your profile</Text>
        <Text style={styles.subtitle}>Manage your Poker Room account.</Text>

        <View style={styles.profileCard}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{getInitials(displayName)}</Text>
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{email ?? 'No email available'}</Text>
          <View style={styles.providerBadge}>
            <Text style={styles.providerBadgeText}>GOOGLE ACCOUNT</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>ACCOUNT DETAILS</Text>
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Display name</Text>
            <Text style={styles.detailValue}>{displayName}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email address</Text>
            <Text style={styles.detailValue}>{email ?? 'Not available'}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sign-in method</Text>
            <Text style={styles.detailValue}>Google</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Member since</Text>
            <Text style={styles.detailValue}>{formatDate(createdAt)}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Player ID</Text>
            <Text style={styles.detailValue}>
              {userId ? `${userId.slice(0, 8)}…` : 'Not available'}
            </Text>
          </View>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>ACCOUNT SECURITY</Text>
          <Text style={styles.noticeText}>
            Your Google account is used to access your saved games and demo wallet. Signing out
            returns you to the Google sign-in screen.
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: signOutLoading, busy: signOutLoading }}
          disabled={signOutLoading}
          onPress={onSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.pressed,
            signOutLoading && styles.disabled,
          ]}>
          {signOutLoading ? (
            <ActivityIndicator color="#f0d5d1" />
          ) : (
            <Text style={styles.signOutText}>SIGN OUT</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#071812' },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 27, paddingBottom: 28 },
  eyebrow: { color: '#d5b36a', fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  title: { marginTop: 9, color: '#f4efe5', fontSize: 29, fontWeight: '900' },
  subtitle: { marginTop: 7, color: '#a9b9ae', fontSize: 12, lineHeight: 18 },
  profileCard: {
    marginTop: 22, padding: 22, alignItems: 'center', borderRadius: 18,
    backgroundColor: '#11291f', borderWidth: 1, borderColor: '#36503c',
  },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#203d2d' },
  avatarFallback: {
    width: 76, height: 76, borderRadius: 38, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#d5b36a',
  },
  avatarInitials: { color: '#14251b', fontSize: 25, fontWeight: '900' },
  name: { marginTop: 13, color: '#f4efe5', fontSize: 19, fontWeight: '900' },
  email: { marginTop: 5, color: '#a9b9ae', fontSize: 11 },
  providerBadge: {
    marginTop: 12, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6,
    backgroundColor: '#203d2d', borderWidth: 1, borderColor: '#52633f',
  },
  providerBadgeText: { color: '#d9c28e', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { marginTop: 25, color: '#d5b36a', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  detailsCard: {
    marginTop: 10, paddingHorizontal: 15, borderRadius: 14, backgroundColor: '#11291f',
    borderWidth: 1, borderColor: '#284534',
  },
  detailRow: {
    minHeight: 51, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', gap: 12,
  },
  detailLabel: { color: '#8fa396', fontSize: 10 },
  detailValue: {
    flexShrink: 1, color: '#f0eadc', fontSize: 10, fontWeight: '800', textAlign: 'right',
  },
  rowDivider: { height: 1, backgroundColor: '#2c4536' },
  noticeCard: {
    marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: '#10251b',
    borderWidth: 1, borderColor: '#284534',
  },
  noticeTitle: { color: '#d5b36a', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  noticeText: { marginTop: 6, color: '#a9b9ae', fontSize: 10, lineHeight: 16 },
  errorText: { marginTop: 12, color: '#edaaa2', fontSize: 10, lineHeight: 15 },
  signOutButton: {
    minHeight: 49, marginTop: 22, borderRadius: 12, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#3a211f', borderWidth: 1, borderColor: '#74433e',
  },
  signOutText: { color: '#f0d5d1', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
});
