import { createAccount } from '../../services/account/accountService';
import { validateAccountCreation, accountCreationErrorMessage } from '../../domain/accountValidation';
import type { TextInputProps } from 'react-native';
import { useReducer, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { reduce, initialState } from './reducer';
import { syncDevice } from '../../services/sync/syncService';

export default function CreateAccountScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'CreateAccount'>) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const submitting = useRef(false);
  const { email, password, confirmation } = state.input;
  const loading = state.tag !== 'editing';
  const error = state.tag === 'editing' ? state.error : null;
  const setEmail = (value: string) => dispatch({ type: 'edit', field: 'email', value });
  const setPassword = (value: string) => dispatch({ type: 'edit', field: 'password', value });
  const setConfirmation = (value: string) => dispatch({ type: 'edit', field: 'confirmation', value });
  const submit = async () => {
    if (state.tag !== 'editing' || submitting.current) return;
    const validationError = validateAccountCreation(state.input);
    if (validationError) {
      dispatch({ type: 'error', message: validationError });
      return;
    }
    submitting.current = true;
    dispatch({ type: 'submit' });
    try {
      await createAccount(email, password);
      dispatch({ type: 'success' });
      void syncDevice().catch(() => undefined);
      navigation.goBack();
    } catch (caught) {
      dispatch({ type: 'error', message: accountCreationErrorMessage(caught) });
    } finally {
      submitting.current = false;
    }
  };
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.copy}>Create an account to sync your DriveCost data across devices.</Text>
        <Text style={styles.note}>Your existing DriveCost data on this device will be synced to your new account.</Text>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          secureTextEntry
          textContentType="newPassword"
        />
        <Text style={styles.hint}>Use at least 12 characters.</Text>
        <Field
          label="Confirm password"
          value={confirmation}
          onChangeText={setConfirmation}
          editable={!loading}
          secureTextEntry
          textContentType="newPassword"
        />
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => void submit()} style={styles.button}>
          <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Create account'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} {...props} />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  copy: { marginTop: 10, color: '#475569', lineHeight: 21 },
  note: { marginTop: 18, color: '#334155', lineHeight: 21 },
  field: { marginTop: 18 },
  label: { fontWeight: '700', color: '#0f172a' },
  input: { marginTop: 7, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, color: '#0f172a' },
  hint: { marginTop: 6, color: '#64748b' },
  error: { marginTop: 16, color: '#b91c1c' },
  button: { marginTop: 24, backgroundColor: '#0f172a', padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
