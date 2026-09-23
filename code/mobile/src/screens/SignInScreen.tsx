import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../services/sync/apiClient';
import { persistMobileSession } from '../services/sync/authSession';
import { getSyncOwner } from '../database/syncStateRepository';
import { syncDevice } from '../services/sync/syncService';

export default function SignInScreen() {
    const navigation = useNavigation<any>(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState<string|null>(null); const [loading,setLoading]=useState(false);
    const submit=async()=>{ setLoading(true);setError(null);try { const owner=await getSyncOwner(); if (!owner) { setError('This device already contains DriveCost data. Choose how to use it with an account in a future update.'); return; } const response=await apiClient.login(email.trim(),password); if(response.user.id!==owner.userId){ await apiClient.logout(response.refreshToken); setError('This device contains DriveCost data linked to another account.'); return; } await persistMobileSession(response); void syncDevice().catch(()=>undefined); navigation.goBack(); } catch { setError('Sign in wasn’t available. Your local data is safe.'); } finally {setLoading(false);} };
    return <SafeAreaView style={styles.screen}><View style={styles.content}><Text style={styles.title}>Sign in</Text><Text style={styles.copy}>Sign in to resume sync.</Text><Text style={styles.label}>Email</Text><TextInput accessibilityLabel="Email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/><Text style={styles.label}>Password</Text><TextInput accessibilityLabel="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry textContentType="password"/>{error?<Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>:null}<Pressable accessibilityRole="button" disabled={loading} onPress={()=>void submit()} style={styles.button}><Text style={styles.buttonText}>{loading?'Signing in…':'Sign in'}</Text></Pressable></View></SafeAreaView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#f8fafc'},content:{padding:20},title:{fontSize:28,fontWeight:'700',color:'#0f172a'},copy:{marginTop:10,color:'#475569'},label:{marginTop:20,fontWeight:'700',color:'#0f172a'},input:{marginTop:7,borderWidth:1,borderColor:'#cbd5e1',borderRadius:10,padding:12},error:{marginTop:16,color:'#b91c1c'},button:{marginTop:24,backgroundColor:'#0f172a',padding:15,borderRadius:10,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'700'}});
