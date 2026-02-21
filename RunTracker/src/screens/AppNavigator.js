// src/screens/AppNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import MapScreen         from './MapScreen';
import LeaderboardScreen from './LeaderboardScreen';
import ProfileScreen     from './ProfileScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ icon, label, focused }) {
  return (
    <View style={{ alignItems: 'center', gap: 2, paddingTop: 6 }}>
      <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.4 }}>{icon}</Text>
      <Text style={{
        fontFamily: 'monospace', fontSize: 8, letterSpacing: 1,
        color: focused ? '#00f5a0' : '#5a6070',
      }}>
        {label}
      </Text>
    </View>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111419',
          borderTopColor:  '#1f242e',
          borderTopWidth:  1,
          height:          64,
          paddingBottom:   8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🗺" label="MAP" focused={focused} /> }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏆" label="RANKS" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👤" label="ME" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}
