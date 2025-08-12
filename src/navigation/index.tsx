import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HeaderButton, Text } from '@react-navigation/elements';
import {
  createStaticNavigation,
  StaticParamList,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Image } from 'react-native';
import bell from '../assets/bell.png';
import newspaper from '../assets/newspaper.png';
import { Home } from './screens/Home';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { Updates } from './screens/Updates';
import { NotFound } from './screens/NotFound';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// 1️⃣ Bottom Tabs — only Home + Updates
const BottomTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: true,
    }}
  >
    <Tab.Screen
      name="Home"
      component={Home}
      options={{
        title: 'TalkieBee',
        tabBarIcon: ({ color, size }) => (
          <Image
            source={newspaper}
            tintColor={color}
            style={{ width: size, height: size }}
          />
        ),
      }}
    />
    <Tab.Screen
      name="Updates"
      component={Updates}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Image
            source={bell}
            tintColor={color}
            style={{ width: size, height: size }}
          />
        ),
      }}
    />
  </Tab.Navigator>
);

// 2️⃣ Drawer — Tabs + Profile + Settings
const DrawerNavigator = () => (
  <Drawer.Navigator
    screenOptions={{
      drawerPosition: 'left',
      headerShown: false,
    }}
  >
    <Drawer.Screen
      name="MainTabs"
      component={BottomTabs}
      options={{ title: 'Home' }}
    />
    <Drawer.Screen
      name="Profile"
      component={Profile}
      options={{ title: 'Profile', headerShown: true,headerLeft: () => null }}
    />
    <Drawer.Screen
      name="Settings"
      component={Settings}
      options={({ navigation }) => ({
        presentation: 'modal',
        headerRight: () => (
          <HeaderButton onPress={navigation.goBack}>
            <Text>Close</Text>
          </HeaderButton>
        ),
      })}
    />
  </Drawer.Navigator>
);

// 3️⃣ Root Stack — wraps Drawer for linking + not found screen
const RootStack = createNativeStackNavigator({
  screens: {
    Drawer: {
      screen: DrawerNavigator,
      options: {
        headerShown: false,
      },
    },
    NotFound: {
      screen: NotFound,
      options: { title: '404' },
      linking: { path: '*' },
    },
  },
});

export const Navigation = createStaticNavigation(RootStack);

type RootStackParamList = StaticParamList<typeof RootStack>;
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
