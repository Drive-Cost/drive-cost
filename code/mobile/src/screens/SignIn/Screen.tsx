import { signIn, AccountOwnershipError } from '../../services/account/accountService';
import { useEffect, useReducer, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { reduce, initialState } from './reducer';
import { syncDevice } from '../../services/sync/syncService';

export default function SignInScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SignIn'>) {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const submitting = useRef(false);
  const flight = useRef<AbortController | null>(null);
  useEffect(() => () => flight.current?.abort(), []);
  const { email, password } = state.input;
  const loading = state.tag !== 'editing';
  const error = state.tag === 'editing' ? state.error : null;
  const setEmail = (value: string) => dispatch({ type: 'edit', field: 'email', value });
  const setPassword = (value: string) => dispatch({ type: 'edit', field: 'password', value });
  const submit = async () => {
    if (state.tag !== 'editing' || submitting.current) return;
    submitting.current = true;
    dispatch({ type: 'submit' });
    try {
      const controller = new AbortController();
      flight.current = controller;
      const result = await signIn(email, password, controller.signal);
      flight.current = null;
      dispatch({ type: 'success' });
      if (result.tag === 'choose-data') {
        navigation.replace('AccountDataChoice', result);
        return;
      }
      void syncDevice().catch(() => undefined);
      navigation.goBack();
    } catch (caught) {
      dispatch({
        type: 'error',
        message:
          caught instanceof AccountOwnershipError
            ? caught.message
            : 'Sign in wasn’t available. Your local data is safe.',
      });
    } finally {
      submitting.current = false;
      flight.current = null;
    }
  };
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.copy}>Sign in to resume sync.</Text>
        <Text style={styles.label}>Email</Text>
        <TextInput
          accessibilityLabel="Email"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          accessibilityLabel="Password"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          secureTextEntry
          textContentType="password"
        />
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => void submit()} style={styles.button}>
          <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  copy: { marginTop: 10, color: '#475569' },
  label: { marginTop: 20, fontWeight: '700', color: '#0f172a' },
  input: { marginTop: 7, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12 },
  error: { marginTop: 16, color: '#b91c1c' },
  button: { marginTop: 24, backgroundColor: '#0f172a', padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
