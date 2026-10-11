import { useEffect, useReducer } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { confirmAccountDataChoice, cancelSignIn } from '../../services/account/accountService';
import type { AccountDataChoice } from '../../services/account/accountAccess';
import { AccountActivationError, AccountOwnershipError } from '../../services/account/accountErrors';
import { syncDevice } from '../../services/sync/syncService';
import { useSubmissionGuard } from '../../hooks/useSubmissionGuard';
import { colors, space } from '../../shared/ui/tokens';
import { initialState, reduce } from './reducer';

export default function AccountDataChoiceScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'AccountDataChoice'>) {
  const { attemptId, email, vehicleCount } = route.params;
  const [state, dispatch] = useReducer(reduce, initialState);
  const submitOnce = useSubmissionGuard();
  const working = state.tag === 'working' || state.tag === 'succeeded';
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => cancelSignIn(attemptId));
    return () => {
      unsubscribe();
      cancelSignIn(attemptId);
    };
  }, [attemptId, navigation]);

  const choose = (choice: AccountDataChoice) =>
    submitOnce(async () => {
      dispatch({ type: 'choose', choice: choice.kind });
      try {
        await confirmAccountDataChoice(attemptId, choice);
        dispatch({ type: 'succeeded' });
        void syncDevice().catch(() => undefined);
        navigation.goBack();
      } catch (error) {
        dispatch({
          type: 'failed',
          committed: error instanceof AccountActivationError,
          message:
            error instanceof AccountOwnershipError
              ? error.message
              : 'Unable to connect your account. Your device data is safe.',
        });
      }
    });
  const replace = () =>
    Alert.alert(
      'Replace data on this device?',
      'The DriveCost records on this device, including changes not yet saved to your account, will be removed. Your account records will be downloaded first. This cannot be undone. Your cloud account data will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace device data',
          style: 'destructive',
          onPress: () => void choose({ kind: 'replace', confirmed: true }),
        },
      ]
    );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Use your account</Text>
        <Text style={styles.copy}>Signed in as {email}.</Text>
        <Text style={styles.copy}>
          This device already has DriveCost records
          {vehicleCount ? ` for ${vehicleCount} ${vehicleCount === 1 ? 'vehicle' : 'vehicles'}` : ''}. Choose what to
          keep.
        </Text>
        {state.tag !== 'connection-error' ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add this data to my account"
              disabled={working}
              accessibilityState={{ disabled: working, busy: state.tag === 'working' }}
              onPress={() => void choose({ kind: 'add' })}
              style={styles.option}
            >
              <Text style={styles.optionTitle}>Add this data to my account</Text>
              <Text style={styles.copy}>
                Keep the records on this device and add them to the records already in your account.
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use my account data instead"
              disabled={working}
              accessibilityState={{ disabled: working, busy: state.tag === 'working' }}
              onPress={replace}
              style={styles.option}
            >
              <Text style={styles.optionTitle}>Use my account data instead</Text>
              <Text style={styles.copy}>
                Remove the records on this device and use the records saved in your account.
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={styles.option}
            onPress={() => void choose(state.choice === 'add' ? { kind: 'add' } : { kind: 'replace', confirmed: true })}
          >
            <Text style={styles.optionTitle}>Retry connection</Text>
          </Pressable>
        )}
        {state.tag === 'connection-error' ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {state.error}
          </Text>
        ) : null}
        {state.tag === 'working' ? (
          <Text accessibilityLiveRegion="polite" style={styles.copy}>
            Checking and saving your data choice…
          </Text>
        ) : null}
        {state.tag === 'ready' && state.error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {state.error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            cancelSignIn(attemptId);
            navigation.goBack();
          }}
          style={styles.cancel}
        >
          <Text style={styles.optionTitle}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.page },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  copy: { marginTop: space.sm, color: colors.secondaryText, lineHeight: 21 },
  option: { marginTop: space.section, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  optionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cancel: { paddingVertical: space.md, marginTop: space.section },
  error: { color: colors.destructive, marginTop: space.md },
});
