import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  createStaticNavigation,
  StaticParamList,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Svg, { Path, Circle, Rect, Line } from "react-native-svg";

import { Home } from "./screens/Home";
import { Profile } from "./screens/Profile";
import { Buzz } from "./screens/Buzz";
import { NotFound } from "./screens/NotFound";

// SVG Icon Components for Walkie Talkie App
const TalkieBeeIcon = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Bee body */}
    <Path 
      d="M12 18c-3.5 0-6-2.5-6-6s2.5-6 6-6 6 2.5 6 6-2.5 6-6 6z" 
      fill={color}
      opacity="0.9"
    />
    {/* Bee stripes */}
    <Line x1="9" y1="10" x2="15" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="9" y1="12.5" x2="15" y2="12.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="9" y1="15" x2="15" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    {/* Left wing */}
    <Path 
      d="M8 9c-2-1-4-1-5 0s0 3 2 3c1 0 2-1 3-3z" 
      stroke={color} 
      strokeWidth="1.5" 
      fill="none"
      strokeLinecap="round"
    />
    {/* Right wing */}
    <Path 
      d="M16 9c2-1 4-1 5 0s0 3-2 3c-1 0-2-1-3-3z" 
      stroke={color} 
      strokeWidth="1.5" 
      fill="none"
      strokeLinecap="round"
    />
    {/* Antennae */}
    <Line x1="10.5" y1="7" x2="10" y2="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <Line x1="13.5" y1="7" x2="14" y2="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    {/* Antenna dots */}
    <Circle cx="10" cy="4" r="1" fill={color} />
    <Circle cx="14" cy="4" r="1" fill={color} />
  </Svg>
);

const BuzzIcon = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect 
      x="6" 
      y="4" 
      width="12" 
      height="16" 
      rx="2" 
      stroke={color} 
      strokeWidth="2"
    />
    <Circle cx="12" cy="8" r="1" fill={color} />
    <Rect 
      x="10" 
      y="12" 
      width="4" 
      height="2" 
      rx="1" 
      fill={color}
    />
    <Line 
      x1="9" 
      y1="17" 
      x2="15" 
      y2="17" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round"
    />
    <Path 
      d="M6 6h-2a1 1 0 0 0-1 1v2" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round"
    />
    <Path 
      d="M18 6h2a1 1 0 0 1 1 1v2" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round"
    />
  </Svg>
);

const ProfileIcon = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path 
      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <Circle 
      cx="12" 
      cy="7" 
      r="4" 
      stroke={color} 
      strokeWidth="2"
    />
  </Svg>
);

const SettingsIcon = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
    <Path 
      d="M12 1v6m0 6v6m11-7h-6m-6 0H1m15.5-3.5L19 9.5m-14 5L7.5 16.5m0-9L5 5.5m14 5l-2.5 2.5" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round"
    />
  </Svg>
);

const Tab = createBottomTabNavigator();

// 1️⃣ Bottom Tabs — All screens (Home, Buzz, Profile, Settings)
const BottomTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: true,
      tabBarActiveTintColor: "#F5C842", // Bumble yellow for active tabs
      tabBarInactiveTintColor: "#999999", // Light gray for inactive tabs
      tabBarStyle: {
        backgroundColor: "#FFFFFF", // Clean white background
        borderTopColor: "#E5E5E5", // Subtle border
        height: 60, // Slightly taller for better touch targets
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: "600", // Semi-bold for readability
        marginBottom: 2,
      },
      tabBarIconStyle: {
        marginTop: 2,
      },
      headerStyle: {
        backgroundColor: "#FFFFFF",
        elevation: 2, // Android shadow
        shadowOpacity: 0.1, // iOS shadow
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
      },
      headerTintColor: "#424242", // Dark gray for header text
      headerTitleStyle: {
        fontWeight: "700", // Bold title
        fontSize: 18,
        color: "#424242",
      },
    }}
  >
    <Tab.Screen
      name="Home"
      component={Home}
      options={{
        title: "TalkieBee",
        tabBarIcon: ({ color, size }) => (
          <TalkieBeeIcon
            color={color}
            size={size}
          />
        ),
        tabBarLabel: "Home",
      }}
    />
    <Tab.Screen
      name="Buzz"
      component={Buzz}
      options={{
        title: "Buzz",
        tabBarIcon: ({ color, size }) => (
          <BuzzIcon
            color={color}
            size={size}
          />
        ),
        tabBarLabel: "Buzz",
        //tabBarBadge: 0, // Optional: show notification badge
        tabBarBadgeStyle: {
          backgroundColor: "#F5C842",
          color: "#000000",
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    />
    <Tab.Screen
      name="Profile"
      component={Profile}
      options={{
        title: "Profile",
        tabBarIcon: ({ color, size }) => (
          <ProfileIcon
            color={color}
            size={size}
          />
        ),
        tabBarLabel: "Profile",
      }}
    />
  </Tab.Navigator>
);

// 2️⃣ Root Stack — wraps Tabs for linking + not found screen
const RootStack = createNativeStackNavigator({
  screens: {
    MainTabs: {
      screen: BottomTabs,
      options: {
        headerShown: false,
      },
    },
    NotFound: {
      screen: NotFound,
      options: { 
        title: "404",
        headerStyle: {
          backgroundColor: "#FFFFFF",
        },
        headerTintColor: "#424242",
        headerTitleStyle: {
          fontWeight: "700",
          color: "#424242",
        },
      },
      linking: { path: "*" },
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