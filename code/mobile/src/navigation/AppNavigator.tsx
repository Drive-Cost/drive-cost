import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import AddScreen from '../screens/AddScreen';
import ChargingScreen from '../screens/ChargingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import FuelScreen from '../screens/FuelScreen';
import HistoryScreen from '../screens/HistoryScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import OwnershipExpensesScreen from '../screens/OwnershipExpensesScreen';
import QuickAddOwnershipExpenseScreen from '../screens/QuickAddOwnershipExpenseScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UpdateOdometerScreen from '../screens/UpdateOdometerScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import SignInScreen from '../screens/SignInScreen';
import GarageStack from './GarageStack';
import { detailScreenHeaders, primaryTabShell, primaryTabsUseNavigationHeaders } from './navigationShell';
import { AppTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function PrimaryTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: primaryTabsUseNavigationHeaders,
                tabBarActiveTintColor: '#0f172a',
                tabBarInactiveTintColor: '#64748b',
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopColor: '#e2e8f0',
                    borderTopWidth: 1,
                },
                tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
                tabBarIcon: ({ color, size }) => (
                    <Ionicons
                        name={primaryTabShell[route.name].iconName as ComponentProps<typeof Ionicons>['name']}
                        color={color}
                        size={route.name === 'Add' ? size + 2 : size}
                    />
                ),
            })}
        >
            <Tab.Screen name="Home" component={DashboardScreen} options={{ title: primaryTabShell.Home.label, tabBarAccessibilityLabel: primaryTabShell.Home.accessibilityLabel }} />
            <Tab.Screen name="History" component={HistoryScreen} options={{ title: primaryTabShell.History.label, tabBarAccessibilityLabel: primaryTabShell.History.accessibilityLabel }} />
            <Tab.Screen name="Add" component={AddScreen} options={{ title: primaryTabShell.Add.label, tabBarAccessibilityLabel: primaryTabShell.Add.accessibilityLabel }} />
            <Tab.Screen name="Garage" component={GarageStack} options={{ title: primaryTabShell.Garage.label, tabBarAccessibilityLabel: primaryTabShell.Garage.accessibilityLabel }} />
            <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: primaryTabShell.Settings.label, tabBarAccessibilityLabel: primaryTabShell.Settings.accessibilityLabel }} />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#f8fafc' },
                headerShadowVisible: false,
                headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
            }}
        >
            <Stack.Screen name="PrimaryTabs" component={PrimaryTabs} options={{ headerShown: false }} />
            <Stack.Screen name="FuelEntry" component={FuelScreen} options={{ title: detailScreenHeaders.FuelEntry }} />
            <Stack.Screen name="ChargingEntry" component={ChargingScreen} options={{ title: detailScreenHeaders.ChargingEntry }} />
            <Stack.Screen name="MaintenanceEntry" component={MaintenanceScreen} options={{ title: detailScreenHeaders.MaintenanceEntry }} />
            <Stack.Screen name="OwnershipExpenseEntry" component={QuickAddOwnershipExpenseScreen} options={{ title: detailScreenHeaders.OwnershipExpenseEntry }} />
            <Stack.Screen name="OwnershipExpenses" component={OwnershipExpensesScreen} options={{ title: detailScreenHeaders.OwnershipExpenses }} />
            <Stack.Screen name="UpdateOdometer" component={UpdateOdometerScreen} options={{ title: detailScreenHeaders.UpdateOdometer }} />
            <Stack.Screen name="CreateAccount" component={CreateAccountScreen} options={{ title: 'Create account' }} />
            <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign in' }} />
        </Stack.Navigator>
    );
}
