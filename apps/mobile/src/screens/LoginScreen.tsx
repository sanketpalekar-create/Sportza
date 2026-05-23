import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../providers/ThemeProvider";

type LoginScreenProps = {
  onContinue: () => void;
};

export function LoginScreen({ onContinue }: LoginScreenProps) {
  const appTheme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: appTheme.colors.background }]}>
      <Text style={[styles.title, { color: appTheme.colors.textPrimary }]}>Login (Placeholder)</Text>
      <Text style={[styles.subtitle, { color: appTheme.colors.textSecondary }]}>
        Replace this with your authentication flow.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onContinue}
        style={[styles.button, { backgroundColor: appTheme.colors.accent }]}
      >
        <Text style={styles.buttonLabel}>Continue to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center"
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center"
  },
  button: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10
  },
  buttonLabel: {
    color: "#042F2E",
    fontWeight: "700"
  }
});
