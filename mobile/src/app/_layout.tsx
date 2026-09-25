import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ScanProvider } from "@/lib/scan-context";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ScanProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="analyzing" options={{ animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="result" options={{ animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="report" />
        </Stack>
      </ScanProvider>
    </SafeAreaProvider>
  );
}
