import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SyncStatusCard from '../components/SyncStatusCard';
import { syncDevice } from '../services/sync/syncService';
import { useSyncStore } from '../store/syncStore';
import { colors, control, space } from '../shared/ui/tokens';
import { appReleaseIdentity, configuredSettingsLinks } from '../services/app/appIdentity';
import { useNavigation } from '@react-navigation/native';
import { getMobileSession, getMobileSessionState } from '../services/sync/authSession';
import { getSyncOwner } from '../database/syncStateRepository';
import { useEffect, useState } from 'react';

export default function SettingsScreen() {
    const syncStatus = useSyncStore();
    const navigation = useNavigation<any>();
    const [owner, setOwner] = useState<Awaited<ReturnType<typeof getSyncOwner>>>(null);
    const session = getMobileSession();
    useEffect(() => { void getSyncOwner().then(setOwner); }, []);

    return (
        <SafeAreaView edges={['top']} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Settings</Text>
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Account</Text>
                {owner?.mode === 'guest' ? <>
                    <View style={styles.row}><Text style={styles.rowTitle}>Finish setting up your account</Text><Text style={styles.copy}>Add an email and password to keep access to your cloud-synced DriveCost data.</Text></View>
                    <Pressable accessibilityRole="button" style={styles.action} onPress={() => navigation.navigate('CreateAccount')}><Text style={styles.actionText}>Create account</Text></Pressable>
                </> : owner && session?.mode === 'registered' ? <View style={styles.row}><Text style={styles.rowTitle}>{session.email ?? 'DriveCost account'}</Text><Text style={styles.copy}>{syncStatus.phase === 'synced' ? 'Sync enabled' : syncStatus.phase === 'syncing' ? 'Syncing' : syncStatus.phase === 'offline' ? 'Offline — changes will sync later' : 'Sync problem'}</Text></View> : owner ? <><View style={styles.row}><Text style={styles.rowTitle}>Sign in to resume sync</Text><Text style={styles.copy}>Your DriveCost data remains safely stored on this device.</Text></View><Pressable accessibilityRole="button" style={styles.action} onPress={() => navigation.navigate('SignIn')}><Text style={styles.actionText}>Sign in</Text></Pressable></> : <><View style={styles.row}><Text style={styles.rowTitle}>Local only</Text><Text style={styles.copy}>Your DriveCost data is stored on this device.</Text></View><Pressable accessibilityRole="button" style={styles.action} onPress={() => navigation.navigate('CreateAccount')}><Text style={styles.actionText}>Create account</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondaryAction} onPress={() => navigation.navigate('SignIn')}><Text style={styles.secondaryText}>Sign in</Text></Pressable></>}
            </View>
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>About</Text>
                <View style={styles.row}>
                    <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{appReleaseIdentity.name}</Text>
                        {appReleaseIdentity.version ? (
                            <Text style={styles.copy}>
                                Version {appReleaseIdentity.version}{appReleaseIdentity.buildNumber ? ` · Build ${appReleaseIdentity.buildNumber}` : ''}
                            </Text>
                        ) : null}
                    </View>
                </View>
                {configuredSettingsLinks.map((link) => (
                    <Pressable
                        key={link.label}
                        accessibilityRole="link"
                        style={styles.row}
                        onPress={() => { void Linking.openURL(link.url); }}
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
                <SyncStatusCard status={syncStatus} onRetry={() => { void syncDevice().catch(() => undefined); }} />
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
    row: { minHeight: 68, marginTop: space.sm, paddingVertical: space.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
    rowCopy: { justifyContent: 'center' },
    rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    copy: { marginTop: space.xs, color: colors.secondaryText, lineHeight: 21 },
    synced: { marginTop: 16, color: '#166534', fontWeight: '600' },
    action: { marginTop: 12, backgroundColor: colors.text, padding: 14, borderRadius: 10, alignItems: 'center' },
    actionText: { color: '#fff', fontWeight: '700' },
    secondaryAction: { marginTop: 8, padding: 12, alignItems: 'center' },
    secondaryText: { color: colors.text, fontWeight: '700' },
});
