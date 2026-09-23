import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GarageScreen from '../screens/GarageScreen';
import AddVehicleScreen from '../screens/AddVehicleScreen';
import EditVehicleScreen from '../screens/EditVehicleScreen';
import { garageStackHeaders } from './navigationShell';
import { GarageStackParamList } from './types';

const Stack = createNativeStackNavigator<GarageStackParamList>();

export default function GarageStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#f8fafc' },
                headerShadowVisible: false,
                headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
            }}
        >
            <Stack.Screen name="GarageHome" component={GarageScreen} options={{ headerShown: garageStackHeaders.GarageHome !== null }} />
            <Stack.Screen name="AddVehicle" component={AddVehicleScreen} options={{ title: garageStackHeaders.AddVehicle ?? undefined }} />
            <Stack.Screen name="EditVehicle" component={EditVehicleScreen} options={{ title: garageStackHeaders.EditVehicle ?? undefined }} />
        </Stack.Navigator>
    );
}
