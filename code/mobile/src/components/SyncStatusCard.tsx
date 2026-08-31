import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SyncStatus } from '../services/sync/syncStatus';

interface SyncStatusCardProps {
    status: SyncStatus;
    onRetry: () => void;
}

const copyByPhase = {
    'local-only': {
        title: 'Local-only mode',
        detail: 'Your data is safely stored on this device. Sync is not configured.',
    },
    offline: {
        title: 'Waiting to sync',
        detail: 'Your changes are safe on this device and will sync when a connection is available.',
    },
    syncing: { title: 'Syncing changes', detail: 'Checking your latest vehicle and entry updates.' },
    synced: { title: 'Changes synced', detail: 'This device is up to date.' },
    error: {
        title: 'Sync paused',
        detail: 'Your changes are still safe on this device. Try again when you are ready.',
    },
} satisfies Record<SyncStatus['phase'], { title: string; detail: string }>;

export default function SyncStatusCard({ status, onRetry }: SyncStatusCardProps) {
    const copy = copyByPhase[status.phase];
    const canRetry = status.phase === 'offline' || status.phase === 'error';

    return (
        <View style={[styles.card, styles[status.phase]]}>
            <View style={styles.copy}>
                <Text style={styles.title}>{copy.title}</Text>
                <Text style={styles.detail}>{copy.detail}</Text>
                {status.phase === 'synced' && status.lastSyncedAt ? (
                    <Text style={styles.timestamp}>Last checked {formatTime(status.lastSyncedAt)}</Text>
                ) : null}
            </View>
            {canRetry ? (
                <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
                    <Text style={styles.retryLabel}>Retry</Text>
                </Pressable>
            ) : null}
        </View>
    );
}

function formatTime(value: string): string {
    return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 16, borderRadius: 18 },
    copy: { flex: 1 },
    title: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
    detail: { color: '#475569', lineHeight: 20, marginTop: 4 },
    timestamp: { color: '#64748b', fontSize: 13, marginTop: 6 },
    retryButton: {
        alignSelf: 'center',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#0f172a',
    },
    retryLabel: { color: '#ffffff', fontWeight: '700' },
    'local-only': { backgroundColor: '#f1f5f9' },
    offline: { backgroundColor: '#fef3c7' },
    syncing: { backgroundColor: '#dbeafe' },
    synced: { backgroundColor: '#dcfce7' },
    error: { backgroundColor: '#fee2e2' },
});
