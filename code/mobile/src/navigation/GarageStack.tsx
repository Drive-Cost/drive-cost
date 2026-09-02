import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GarageScreen from '../screens/GarageScreen';
import AddVehicleScreen from '../screens/AddVehicleScreen';
import EditVehicleScreen from '../screens/EditVehicleScreen';
import { GarageStackParamList } from './types';

const Stack = createNativeStackNavigator<GarageStackParamList>();

export default function GarageStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen name="GarageHome" component={GarageScreen} />
            <Stack.Screen name="AddVehicle" component={AddVehicleScreen} />
            <Stack.Screen name="EditVehicle" component={EditVehicleScreen} />
        </Stack.Navigator>
    );
}
