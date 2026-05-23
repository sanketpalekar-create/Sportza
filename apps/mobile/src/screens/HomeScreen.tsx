import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../providers/ThemeProvider";

export function HomeScreen() {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: appTheme.colors.background }]}>
      <Text style={[styles.title, { color: appTheme.colors.textPrimary }]}>Home (Placeholder)</Text>
      <Text style={[styles.subtitle, { color: appTheme.colors.textSecondary }]}>
        Migration foundation is ready. Wire real modules next.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center"
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center"
  }
});
