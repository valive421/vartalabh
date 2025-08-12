import React, { useEffect, useRef } from 'react';
import { NavigationContainerRef } from '@react-navigation/native';
import { Alert } from 'react-native';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from './src/screens/splash';
import HomeScreen from './src/screens/home';
import SearchScreen from './src/screens/search';
import SignupScreen from './src/screens/Signup';
import SigninScreen from './src/screens/SIgnin';
import MessageScreen from './src/screens/Message';
import VideoCallScreen from './src/screens/VideoCallScreen';
import './src/core/fontawesome';
import useglobal from './src/core/global';

const Stack = createNativeStackNavigator();

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#fff',
    text: '#000',
  },
};

const App = () => {
  const { 
    initialized, 
    authenticated, 
    init, 
    incomingCall, 
    clearIncomingCall,
    videoSocketConnect,
    sendVideoSignal,
  } = useglobal();
  
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    init();
  }, []);

  // Handle incoming calls globally
  useEffect(() => {
    if (incomingCall && incomingCall.caller) {
      console.log('[App] Incoming call detected:', incomingCall);
      
      // Check if we're already in a call screen
      const currentRoute = navigationRef.current?.getCurrentRoute();
      if (currentRoute?.name === 'VideoCallScreen') {
        console.log('[App] Already in call screen, ignoring incoming call');
        return;
      }
      
      Alert.alert(
        'Incoming Video Call',
        `Call from ${incomingCall.caller}`,
        [
          {
            text: 'Decline',
            style: 'cancel',
            onPress: () => {
              console.log('[App] Call declined');
              clearIncomingCall();
            },
          },
          {
            text: 'Accept',
            onPress: () => {
              console.log('[App] Call accepted');
              try {
                // Inform caller we're ready before navigating
                sendVideoSignal({ action: 'accept', recipient: incomingCall.caller.toLowerCase() });
              } catch {}
              clearIncomingCall();
              navigationRef.current?.navigate('VideoCallScreen', {
                recipient: incomingCall.caller,
                startCall: false
              });
            },
          },
        ],
        { cancelable: false }
      );
    }
  }, [incomingCall, clearIncomingCall]);

  return (
    <NavigationContainer
      theme={LightTheme}
      ref={navigationRef}
    >
      <StatusBar barStyle='dark-content' />
      <Stack.Navigator>
        {!initialized ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : !authenticated ? (
          <>
            <Stack.Screen name="SignIn" component={SigninScreen} />
            <Stack.Screen name="SignUp" component={SignupScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Search" component={SearchScreen} />
            <Stack.Screen name="Messages" component={MessageScreen} />
            <Stack.Screen 
              name="VideoCallScreen" 
              component={VideoCallScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;