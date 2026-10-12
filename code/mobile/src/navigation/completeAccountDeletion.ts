import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

export function completeAccountDeletionNavigation(
  navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'reset'>
): void {
  navigation.reset({ index: 0, routes: [{ name: 'PrimaryTabs', params: { screen: 'Settings' } }] });
}
