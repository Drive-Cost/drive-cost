import { useEffect, useReducer, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { completeAccountDeletionNavigation } from '../../navigation/completeAccountDeletion';
import { colors, control, radius, space } from '../../shared/ui/tokens';
import { useAccountDeletionStore } from '../../store/accountDeletionStore';
import {
  AccountDeletionError,
  openAccountDeletion,
  deleteAccount,
  checkAccountDeletion,
  confirmDeviceCleanup,
} from '../../services/account/accountDeletion';
import { initialState, reduce } from './reducer';

export default function DeleteAccountScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const { view } = useAccountDeletionStore();
  const active = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void openAccountDeletion().catch(() => {
      if (mounted.current)
        dispatch({ type: 'failed', message: 'Account details could not be loaded. Please try again.' });
    });
    return () => {
      mounted.current = false;
    };
  }, []);
  const submit = async (operation: () => Promise<unknown>) => {
    if (active.current) return;
    active.current = true;
    dispatch({ type: 'submit' });
    try {
      await operation();
      if (mounted.current) dispatch({ type: 'finished' });
    } catch (error) {
      if (mounted.current)
        dispatch({
          type: 'failed',
          message:
            error instanceof AccountDeletionError
              ? error.message
              : 'Deletion is unavailable right now. Your device records are preserved. Please try again.',
        });
    } finally {
      active.current = false;
    }
  };
  const action =
    view.tag === 'ready'
      ? {
          label: 'Delete account permanently',
          run: () => deleteAccount(state.password),
          disabled: view.mode === 'registered' && !state.password,
          destructive: true,
        }
      : view.tag === 'unknown'
        ? { label: 'Check deletion status', run: checkAccountDeletion, disabled: false, destructive: false }
        : view.tag === 'needs-confirmation'
          ? {
              label: 'Remove these device records permanently',
              run: () => confirmDeviceCleanup(view.signature),
              disabled: false,
              destructive: true,
            }
          : view.tag === 'cleanup-pending'
            ? { label: 'Retry device cleanup', run: checkAccountDeletion, disabled: false, destructive: false }
            : view.tag === 'blocked' || view.tag === 'none'
              ? { label: 'Try again', run: openAccountDeletion, disabled: false, destructive: false }
              : null;
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.title}>
          {view.tag === 'complete' ? 'Account deleted' : 'Delete your DriveCost account?'}
        </Text>
        {view.tag === 'ready' ? (
          <>
            {view.email ? <Text style={styles.account}>{view.email}</Text> : null}
            <Text style={styles.copy}>This permanently deletes your account and the records saved in it.</Text>
            <Text style={styles.copy}>
              The DriveCost records on this device will also be removed, including anything that hasn’t synced yet.
            </Text>
            <Text style={styles.copy}>Records stored offline on other devices cannot be removed remotely.</Text>
            <Text style={styles.copy}>This cannot be undone.</Text>
            {view.mode === 'registered' ? (
              <View>
                <Text style={styles.label}>Current password</Text>
                <TextInput
                  accessibilityLabel="Current password"
                  secureTextEntry
                  textContentType="password"
                  autoCapitalize="none"
                  maxLength={128}
                  value={state.password}
                  onChangeText={value => dispatch({ type: 'password', value })}
                  editable={!state.busy}
                  style={styles.input}
                />
              </View>
            ) : null}
          </>
        ) : view.tag === 'unknown' ? (
          <>
            <Text style={styles.copy}>
              {state.busy ? 'Confirming account deletion…' : 'We couldn’t confirm whether your account was deleted.'}
            </Text>
            <Text style={styles.copy}>
              Your records are still on this device. Syncing is paused until we can confirm what happened.
            </Text>
            <Text style={styles.copy}>You can keep recording locally while you wait.</Text>
          </>
        ) : view.tag === 'needs-confirmation' ? (
          <>
            <Text style={styles.copy}>Your cloud account has been deleted.</Text>
            <Text style={styles.copy}>
              This device contains additional or changed records saved while deletion was pending. Removing them needs
              your confirmation again.
            </Text>
            <Text style={styles.copy}>
              All DriveCost records on this device, including these changes, will be permanently removed. This cannot be
              undone.
            </Text>
          </>
        ) : view.tag === 'complete' ? (
          <Text style={styles.copy}>
            Your DriveCost account and its cloud records have been deleted. DriveCost records on this device have also
            been removed.
          </Text>
        ) : view.tag === 'blocked' || view.tag === 'cleanup-pending' ? (
          <Text style={styles.copy}>{view.message}</Text>
        ) : (
          <Text style={styles.copy}>Loading account details…</Text>
        )}
        {state.error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {state.error}
          </Text>
        ) : null}
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: state.busy || action.disabled }}
            disabled={state.busy || action.disabled}
            style={[
              styles.button,
              action.destructive && styles.destructive,
              (state.busy || action.disabled) && styles.disabled,
            ]}
            onPress={() => void submit(action.run)}
          >
            <Text style={styles.buttonText}>{state.busy ? 'Please wait…' : action.label}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={styles.secondary}
          onPress={() =>
            view.tag === 'complete' ? completeAccountDeletionNavigation(navigation) : navigation.goBack()
          }
        >
          <Text style={styles.secondaryText}>
            {view.tag === 'complete'
              ? 'Continue using DriveCost'
              : view.tag === 'ready' && !state.busy
                ? 'Cancel'
                : 'Back to Settings'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.page, paddingBottom: control.pageBottom },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  account: { marginTop: space.md, color: colors.secondaryText, fontWeight: '600' },
  copy: { marginTop: space.lg, color: colors.secondaryText, lineHeight: 23 },
  label: { marginTop: space.section, color: colors.text, fontWeight: '700' },
  input: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.control,
    padding: space.md,
    minHeight: control.minHeight,
    color: colors.text,
  },
  error: { marginTop: space.lg, color: colors.destructive, lineHeight: 22 },
  button: {
    marginTop: space.section,
    backgroundColor: colors.navy,
    padding: space.lg,
    minHeight: control.minHeight,
    borderRadius: radius.control,
    alignItems: 'center',
  },
  destructive: { backgroundColor: colors.destructive },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.surface, fontWeight: '700', textAlign: 'center' },
  secondary: { marginTop: space.sm, padding: space.lg, minHeight: control.minHeight, alignItems: 'center' },
  secondaryText: { color: colors.text, fontWeight: '700' },
});
