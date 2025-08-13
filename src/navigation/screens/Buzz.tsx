import { Text } from '@react-navigation/elements';
import { StyleSheet, View } from 'react-native';
import QRScanner from '../../components/QRScanner';
import { CommunicationScreen } from '../../components/CommunicationScreen';
import { useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export function Buzz() {
  const [permission, requestPermission] = useCameraPermissions();
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await requestPermission();
      await checkStoredUrl();
    })();
  }, []);

  const checkStoredUrl = async () => {
    try {
      const storedUrl = await SecureStore.getItemAsync('relay_server_url');
      setServerUrl(storedUrl);
    } catch (error) {
      console.error('Failed to get stored URL:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanSuccess = async (url: string) => {
    try {
      await SecureStore.setItemAsync('relay_server_url', url);
      setServerUrl(url);
    } catch (error) {
      console.error('Failed to store URL:', error);
    }
  };

  const handleLeave = () => {
    setServerUrl(null);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {serverUrl ? (
        <CommunicationScreen 
          serverUrl={serverUrl} 
          onLeave={handleLeave} 
        />
      ) : (
        permission?.granted ? (
          <QRScanner onScanSuccess={handleScanSuccess} />
        ) : (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Camera permission is required to scan QR codes
            </Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
});