import { useAccountDeletionStore } from '../../store/accountDeletionStore';
import { signOut } from '../../services/account/accountService';
import { useSubmissionGuard } from '../../hooks/useSubmissionGuard';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SyncStatusCard from '../../components/SyncStatusCard';
import { syncDevice } from '../../services/sync/syncService';
import { useSyncStore } from '../../store/syncStore';
import { colors, control, space } from '../../shared/ui/tokens';
import { appReleaseIdentity, configuredSettingsLinks } from '../../services/app/appIdentity';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAccountStore } from '../../store/accountStore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { getSyncOwner } from '../../database/syncStateRepository';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { initialState, reduce } from './reducer';

export default function SettingsScreen() {
  const syncStatus = useSyncStore();
  const deletion = useAccountDeletionStore(state => state.view);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, dispatch] = useReducer(reduce, initialState);
  const { owner } = state;
  const { session, status } = useAccountStore();
  const lifecycleBlocked = status === 'deletion-pending' || status === 'account-unavailable';
  const matchingSession = status === 'authenticated' && session?.userId === owner?.userId ? session : null;
  const request = useRef(0);
  const [signOutState, setSignOutState] = useState<
    { tag: 'idle' } | { tag: 'working' } | { tag: 'error'; message: string }
  >({ tag: 'idle' });
  const guard = useSubmissionGuard();
  const finishSignOut = () =>
    guard(async () => {
      setSignOutState({ tag: 'working' });
      try {
        await signOut();
        setSignOutState({ tag: 'idle' });
      } catch {
        setSignOutState({
          tag: 'error',
          message: 'Unable to finish signing out. Please try again. Your device records are safe.',
        });
      }
    });
  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Your records will stay on this device. Sign in to the same account to resume sync.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => void finishSignOut() },
    ]);
  const loadOwner = useCallback(async () => {
    const generation = ++request.current;
    dispatch({ type: 'load' });
    try {
      const owner = await getSyncOwner();
      if (request.current === generation) dispatch({ type: 'loaded', owner });
    } catch {
      if (request.current === generation) dispatch({ type: 'failed' });
    }
  }, []);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    void loadOwner();
    return () => {
      request.current += 1;
    };
  }, [focused, loadOwner, session?.userId, session?.mode]);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          {signOutState.tag === 'error' && !lifecycleBlocked ? (
            <View>
              <Text accessibilityLiveRegion="polite" style={styles.copy}>
                {signOutState.message}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => void finishSignOut()} style={styles.secondaryAction}>
                <Text style={styles.secondaryText}>Try signing out again</Text>
              </Pressable>
            </View>
          ) : null}
          {state.tag === 'loading' ? (
            <Text style={styles.copy}>Loading account details…</Text>
          ) : state.tag === 'error' ? (
            <View style={styles.row}>
              <Text style={styles.copy}>Unable to load account details. Please try again.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void loadOwner();
                }}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryText}>Try again</Text>
              </Pressable>
            </View>
          ) : lifecycleBlocked ? (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>
                {status === 'account-unavailable' ? 'Account no longer available' : 'Account deletion pending'}
              </Text>
              <Text style={styles.copy}>Your records remain on this device. Syncing is paused.</Text>
              {status !== 'account-unavailable' ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.secondaryAction}
                  onPress={() => navigation.navigate('DeleteAccount')}
                >
                  <Text style={styles.secondaryText}>
                    {deletion.tag === 'cleanup-pending' ? 'Retry device cleanup' : 'Review account deletion'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : owner?.mode === 'guest' && matchingSession?.mode === 'guest' ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Finish setting up your account</Text>
                <Text style={styles.copy}>
                  Add an email and password to keep access to your cloud-synced DriveCost data.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={styles.action}
                onPress={() => navigation.navigate('CreateAccount')}
              >
                <Text style={styles.actionText}>Create account</Text>
              </Pressable>
            </>
          ) : owner && matchingSession?.mode === 'registered' ? (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{matchingSession.email ?? 'DriveCost account'}</Text>
              <Text style={styles.copy}>
                {syncStatus.phase === 'synced'
                  ? 'Sync enabled'
                  : syncStatus.phase === 'syncing'
                    ? 'Syncing'
                    : syncStatus.phase === 'offline'
                      ? 'Offline — changes will sync later'
                      : 'Sync problem'}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={signOutState.tag === 'working'}
                onPress={confirmSignOut}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryText}>{signOutState.tag === 'working' ? 'Signing out…' : 'Sign out'}</Text>
              </Pressable>
            </View>
          ) : owner ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>
                  {owner.mode === 'registered' ? 'Signed out' : 'Account access unavailable'}
                </Text>
                <Text style={styles.copy}>
                  {owner.mode === 'guest'
                    ? 'Your records remain on this device. This older account needs its original credential to reconnect or be deleted.'
                    : 'Your DriveCost data remains safely stored on this device.'}
                </Text>
              </View>
              {owner.mode === 'registered' ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.action}
                  onPress={() => navigation.navigate('SignIn')}
                >
                  <Text style={styles.actionText}>Sign in</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Local only</Text>
                <Text style={styles.copy}>Your DriveCost data is stored on this device.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={styles.action}
                onPress={() => navigation.navigate('CreateAccount')}
              >
                <Text style={styles.actionText}>Create account</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryAction}
                onPress={() => navigation.navigate('SignIn')}
              >
                <Text style={styles.secondaryText}>Sign in</Text>
              </Pressable>
            </>
          )}
          {state.tag === 'ready' && owner && !lifecycleBlocked ? (
            <Pressable
              accessibilityRole="button"
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('DeleteAccount')}
            >
              <Text style={styles.destructiveText}>Delete account</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{appReleaseIdentity.name}</Text>
              {appReleaseIdentity.version ? (
                <Text style={styles.copy}>
                  Version {appReleaseIdentity.version}
                  {appReleaseIdentity.buildNumber ? ` · Build ${appReleaseIdentity.buildNumber}` : ''}
                </Text>
              ) : null}
            </View>
          </View>
          {configuredSettingsLinks.map(link => (
            <Pressable
              key={link.label}
              accessibilityRole="link"
              style={styles.row}
              onPress={() => {
                void Linking.openURL(link.url);
              }}
            >
              <Text style={styles.rowTitle}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Data and sync</Text>
          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Your data</Text>
              <Text style={styles.copy}>Available on this device, even when you are offline.</Text>
            </View>
          </View>
          <SyncStatusCard
            status={syncStatus}
            onRetry={() => {
              void syncDevice().catch(() => undefined);
            }}
          />
          {syncStatus.phase === 'synced' ? <Text style={styles.synced}>Your data is up to date.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.page, paddingBottom: control.pageBottom },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  section: { marginTop: space.section },
  sectionLabel: { color: colors.mutedText, fontSize: 13, fontWeight: '700' },
  row: {
    minHeight: 68,
    marginTop: space.sm,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  rowCopy: { justifyContent: 'center' },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  copy: { marginTop: space.xs, color: colors.secondaryText, lineHeight: 21 },
  synced: { marginTop: 16, color: '#166534', fontWeight: '600' },
  action: { marginTop: 12, backgroundColor: colors.text, padding: 14, borderRadius: 10, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '700' },
  secondaryAction: { marginTop: 8, padding: 12, alignItems: 'center' },
  secondaryText: { color: colors.text, fontWeight: '700' },
  destructiveText: { color: colors.destructive, fontWeight: '700' },
});
