import { Assets as NavigationAssets } from '@react-navigation/elements';
import { DefaultTheme } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { createURL } from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { useColorScheme, AppState, AppStateStatus } from 'react-native';
import { Navigation } from './navigation';
import * as NavigationBar from "expo-navigation-bar"

Asset.loadAsync([
  ...NavigationAssets,
  require('./assets/newspaper.png'),
  require('./assets/bell.png'),
]);

SplashScreen.setOptions({
  duration: 2000
});
SplashScreen.preventAutoHideAsync();

const prefix = createURL('/');

const hideNavBar = async () => {

    // Prevent content from moving up when bar is shown
    await NavigationBar.setPositionAsync("absolute") 

    // Hide bottom bar
    await NavigationBar.setVisibilityAsync("hidden") 

    // Show the bar when user swipes
    await NavigationBar.setBehaviorAsync("overlay-swipe")  
}

export function App() {
  const colorScheme = useColorScheme();

  const theme = DefaultTheme

  React.useEffect(() => {

    const handleAppStateChange = (nextAppState: AppStateStatus) => {

        // If app is being used, hide nav bar
        if (nextAppState === "active") {

            hideNavBar()
        }
    }

    // Subscribe to app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange)

    // Clean up the event listener when the component unmounts
    return () => {
        appStateSubscription.remove()
    }
}, [])

  return (
    <Navigation
      theme={theme}
      linking={{
        enabled: 'auto',
        prefixes: [prefix],
      }}
      onReady={() => {
        SplashScreen.hideAsync();
      }}
    />
  );
}
