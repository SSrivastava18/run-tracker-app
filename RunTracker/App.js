// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import AuthScreen    from './src/screens/AuthScreen';
import AppNavigator  from './src/screens/AppNavigator';

function RootRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0c10', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00f5a0" size="large" />
      </View>
    );
  }

  return user ? <AppNavigator /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={{ colors: { background: '#0a0c10' } }}>
        <StatusBar style="light" />
        <RootRouter />
      </NavigationContainer>
    </AuthProvider>
  );
}
