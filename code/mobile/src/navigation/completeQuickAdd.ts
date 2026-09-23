import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';

type QuickAddNavigation = Pick<NativeStackNavigationProp<RootStackParamList>, 'reset'>;

export function completeQuickAdd(navigation: QuickAddNavigation): void {
    navigation.reset({
        index: 0,
        routes: [{ name: 'PrimaryTabs', params: { screen: 'Home' } }],
    });
}
