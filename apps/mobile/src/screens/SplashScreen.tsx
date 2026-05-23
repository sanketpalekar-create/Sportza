import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../providers/ThemeProvider";

export function SplashScreen() {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: appTheme.colors.background }]}>
      <ActivityIndicator size="large" color={appTheme.colors.accent} />
      <Text style={[styles.title, { color: appTheme.colors.textPrimary }]}>Sportza</Text>
      <Text style={[styles.subtitle, { color: appTheme.colors.textSecondary }]}>
        Preparing your experience...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  title: {
    fontSize: 24,
    fontWeight: "700"
  },
  subtitle: {
    fontSize: 14
  }
});
