import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { VehicleDataStatus } from '../hooks/useVehicleData';
import { colors, space } from '../shared/ui/tokens';

export function VehicleDataNotice({ status, onRetry }: { status: VehicleDataStatus; onRetry: () => void }) {
  if (status === 'ready') return null;
  return (
    <View style={styles.notice}>
      <Text style={styles.copy}>
        {status === 'loading' ? 'Loading vehicle records…' : 'Unable to load vehicle records. Please try again.'}
      </Text>
      {status === 'error' ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={styles.action}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { paddingVertical: space.md },
  copy: { color: colors.secondaryText, lineHeight: 21 },
  retry: { paddingVertical: space.md },
  action: { color: colors.text, fontWeight: '700' },
});
