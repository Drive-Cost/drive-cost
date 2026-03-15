import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import DashboardScreen from "../screens/DashboardScreen";
import GarageStack from "./GarageStack";
import FuelScreen from "../screens/FuelScreen";
import MaintenanceScreen from "../screens/MaintenacesScreen";

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: "#f8fafc",
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          color: "#0f172a",
          fontWeight: "700",
        },
        tabBarActiveTintColor: "#0f172a",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
        tabBarIcon: ({ color, size, focused }) => {
          const iconSize = focused ? size + 1 : size;
          let icon = "◫";

          switch (route.name) {
            case "Dashboard":
              icon = focused ? "▦" : "◫";
              break;
            case "Garage":
              icon = "⌂";
              break;
            case "Fuel":
              icon = "⛽";
              break;
            case "Maintenance":
              icon = "⚙";
              break;
          }

          return <Text style={{ color, fontSize: iconSize }}>{icon}</Text>;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />

      <Tab.Screen
        name="Garage"
        component={GarageStack}
        options={{ headerShown: false }}
      />

      <Tab.Screen name="Fuel" component={FuelScreen} />

      <Tab.Screen name="Maintenance" component={MaintenanceScreen} />
    </Tab.Navigator>
  );
}
