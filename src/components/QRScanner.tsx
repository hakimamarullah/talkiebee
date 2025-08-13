import { Text, TouchableOpacity, StyleSheet, View, Animated, Dimensions, Platform, StatusBar, Alert } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface QRScannerProps {
  onScanSuccess: (url: string) => void;
}

export default function QRScanner({ onScanSuccess }: QRScannerProps) {
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false); // Flashlight toggle
  const scanAnimation = useRef(new Animated.Value(0)).current; // Persist animation value

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scanAnimation]);

  const onBarcodeScanned = ({ data }: { data: any }) => {
    if (!scanned) {
      setScanned(true);
      try {
        new URL(data);
        onScanSuccess(data);
      } catch (error) {
        console.error('Invalid URL scanned:', error);
        setTimeout(() => setScanned(false), 2000);
      }
    }
  };

  const pickImageAndScan = async () => {
    await ImagePicker.getMediaLibraryPermissionsAsync();
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      try {
        const scannedResults = await Camera.scanFromURLAsync(uri, ['qr']);
        if (scannedResults.length > 0) {
          onScanSuccess(scannedResults[0].data);
        } else {
          console.log('No QR code found in image');
        }
      } catch (err) {
        console.error('Error scanning from gallery:', err);
      }
    }
  };

  const scanLineTranslateY = scanAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 250],
  });

  return (
    <View style={styles.container}>
      {Platform.OS === 'android' ? <StatusBar hidden /> : null}

      {/* Camera View */}
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
      />

      {/* Header Overlay */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Join Server</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => setTorchOn(!torchOn)} style={styles.iconButton}>
            <Ionicons
              name={torchOn ? 'flashlight' : 'flashlight-outline'}
              size={28}
              color="white"
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImageAndScan} style={styles.iconButton}>
            <Ionicons name="image-outline" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scanning Area Overlay */}
      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          <Animated.View
            style={[
              styles.scanLine,
              { transform: [{ translateY: scanLineTranslateY }] },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1, width: '100%' },

  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
    height: 50,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 12,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#F5C842',
    borderWidth: 3,
  },
  topLeft: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  topRight: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#F5C842',
    shadowColor: '#F5C842',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
  },
});
