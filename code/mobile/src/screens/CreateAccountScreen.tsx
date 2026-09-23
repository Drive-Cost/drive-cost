import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../services/sync/apiClient';
import { getMobileSession, persistMobileSession } from '../services/sync/authSession';
import { bindSyncOwner, getSyncOwner } from '../database/syncStateRepository';
import { syncDevice } from '../services/sync/syncService';

export default function CreateAccountScreen() {
    const navigation = useNavigation<any>();
    const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
    const submit = async () => {
        if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
        if (password.length < 12) return setError('Use at least 12 characters for your password.');
        if (password !== confirmation) return setError('Passwords do not match.');
        setLoading(true); setError(null);
        try {
            const owner = await getSyncOwner(); const current = getMobileSession();
            const response = owner?.mode === 'guest' && current?.mode === 'guest' ? await apiClient.upgrade(email.trim(), password) : await apiClient.register(email.trim(), password);
            const next = await persistMobileSession(response);
            if (!owner) await bindSyncOwner({ userId: next.userId, mode: next.mode });
            void syncDevice().catch(() => undefined);
            navigation.goBack();
        } catch (caught) { setError(messageFor(caught)); } finally { setLoading(false); }
    };
    return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>Create an account</Text><Text style={styles.copy}>Create an account to sync your DriveCost data across devices.</Text><Text style={styles.note}>Your existing DriveCost data on this device will be synced to your new account.</Text><Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" /><Text style={styles.hint}>Use at least 12 characters.</Text><Field label="Confirm password" value={confirmation} onChangeText={setConfirmation} secureTextEntry textContentType="newPassword" />{error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={loading} onPress={() => void submit()} style={styles.button}><Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Create account'}</Text></Pressable></ScrollView></SafeAreaView>;
}
function Field(props: any) { return <View style={styles.field}><Text style={styles.label}>{props.label}</Text><TextInput accessibilityLabel={props.label} style={styles.input} {...props} /></View>; }
function messageFor(error: unknown) { const status = typeof error === 'object' && error && 'status' in error ? (error as { status: number }).status : 0; return status === 409 ? 'An account with this email already exists.' : status === 429 ? 'Too many attempts. Try again shortly.' : status === 400 ? 'Check your details and try again.' : 'DriveCost couldn’t reach the service. Your local data is safe.'; }
const styles = StyleSheet.create({ screen:{flex:1,backgroundColor:'#f8fafc'},content:{padding:20},title:{fontSize:28,fontWeight:'700',color:'#0f172a'},copy:{marginTop:10,color:'#475569',lineHeight:21},note:{marginTop:18,color:'#334155',lineHeight:21},field:{marginTop:18},label:{fontWeight:'700',color:'#0f172a'},input:{marginTop:7,borderWidth:1,borderColor:'#cbd5e1',borderRadius:10,padding:12,color:'#0f172a'},hint:{marginTop:6,color:'#64748b'},error:{marginTop:16,color:'#b91c1c'},button:{marginTop:24,backgroundColor:'#0f172a',padding:15,borderRadius:10,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'700'} });
