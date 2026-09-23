import type { NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppTabParamList, GarageStackParamList } from './types';

type VehicleOnboardingNavigation = Pick<NativeStackNavigationProp<GarageStackParamList>, 'popToTop' | 'getParent'>;

/** Close onboarding and show the useful primary context for the newly active vehicle. */
export function completeVehicleOnboarding(navigation: VehicleOnboardingNavigation) {
    navigation.popToTop();
    const primaryNavigation = navigation.getParent<NavigationProp<AppTabParamList>>();
    primaryNavigation?.navigate('Home');
}
