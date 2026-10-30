import { Redirect } from "expo-router";
import { View } from "react-native";
import { useSession } from "@/auth/SessionProvider";
import { Button, ErrorState, Loading, Screen } from "@/components/ui";
import { t } from "@/i18n";
import { space } from "@/theme";

/** Entry point: sends each user to the right space. */
export default function Index() {
  const { status, me, retry, signOut } = useSession();

  if (status === "loading") {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (status === "error") {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: "center", gap: space.lg }}>
          <ErrorState onRetry={retry} message={t("common.offline")} />
          <Button variant="ghost" label={t("common.logout")} onPress={() => void signOut()} />
        </View>
      </Screen>
    );
  }
  if (status === "needsProfile") return <Redirect href="/consent" />;
  if (status === "signedOut" || !me) return <Redirect href="/welcome" />;
  if (me.role === "DOCTOR") return <Redirect href="/alerts" />;
  return <Redirect href="/home" />;
}
