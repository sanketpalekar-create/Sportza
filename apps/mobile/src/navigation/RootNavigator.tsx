import { useEffect, useMemo, useState } from "react";
import { NavigationContainer, DefaultTheme, Theme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/HomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { useAppTheme } from "../providers/ThemeProvider";
import { subscribeUnauthorized } from "../lib/authEvents";
import { validateCurrentSession } from "../lib/apiClient";

type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const appTheme = useAppTheme();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const unsubscribeUnauthorized = subscribeUnauthorized(() => {
      if (mounted) setIsAuthenticated(false);
    });

    const bootstrapSession = async () => {
      const hasValidSession = await validateCurrentSession();
      if (mounted) {
        setIsAuthenticated(hasValidSession);
        setIsBootstrapping(false);
      }
    };

    void bootstrapSession();

    return () => {
      mounted = false;
      unsubscribeUnauthorized();
    };
  }, []);

  const navigationTheme = useMemo<Theme>(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: appTheme.colors.background,
        card: appTheme.colors.surface,
        text: appTheme.colors.textPrimary,
        primary: appTheme.colors.accent
      }
    }),
    [appTheme]
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isBootstrapping ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : isAuthenticated ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <Stack.Screen name="Login">
            {() => <LoginScreen onContinue={() => setIsAuthenticated(true)} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
