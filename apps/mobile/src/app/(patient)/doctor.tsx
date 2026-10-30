import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { ApiError } from "@/api";
import { useLink, useSubmitLinkCode } from "@/api/queries";
import { DEMO_INVITE_CODE } from "@/api/mock/seed";
import { AppText, Button, Card, Loading, Notice, Screen, ScreenHeader } from "@/components/ui";
import { ENV } from "@/config/env";
import { t } from "@/i18n";
import { INVITE_CODE_LENGTH, isCompleteInviteCode, normalizeInviteCode } from "@/lib/inviteCode";
import { colors, radius, space, type IconName } from "@/theme";

/** Add my doctor with the one-time code (spec §3 linking). */
export default function DoctorLink() {
  const router = useRouter();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const link = useLink();
  const [retrying, setRetrying] = useState(false);
  const goHome = () => router.replace("/home");

  const status = link.data?.status;
  const showForm = !link.isLoading && (status === "NONE" || status === undefined || (status === "REFUSED" && retrying));

  return (
    <Screen
      header={
        <ScreenHeader
          title={t("link.title")}
          right={welcome && status !== "ACCEPTED" ? <Button variant="ghost" label={t("common.later")} onPress={goHome} /> : undefined}
        />
      }
    >
      {link.isLoading ? (
        <Loading />
      ) : showForm ? (
        <CodeForm onDone={() => setRetrying(false)} />
      ) : status === "PENDING" ? (
        <StateCard icon="hourglass" tone={colors.watch} bg={colors.watchSoft} title={t("link.pendingTitle")} body={t("link.pendingBody")} />
      ) : status === "ACCEPTED" ? (
        <>
          <StateCard
            icon="checkmark-circle"
            tone={colors.ok}
            bg={colors.okSoft}
            title={t("link.acceptedTitle")}
            body={t("link.acceptedBody", { name: link.data?.doctorName ?? "" })}
          />
          <Button size="lg" icon="chatbubbles" label={t("link.write")} onPress={() => router.replace("/chat")} />
          {welcome ? <Button variant="ghost" label={t("risk.goHome")} onPress={goHome} /> : null}
        </>
      ) : (
        <>
          <StateCard icon="close" tone={colors.danger} bg={colors.dangerSoft} title={t("link.refusedTitle")} body={t("link.refusedBody")} />
          <Button variant="secondary" label={t("link.tryAgain")} onPress={() => setRetrying(true)} />
        </>
      )}
    </Screen>
  );
}

function CodeForm({ onDone }: { readonly onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = useSubmitLinkCode();
  const complete = isCompleteInviteCode(code);

  const send = async () => {
    setError(null);
    try {
      await submit.mutateAsync(code);
      onDone();
    } catch (err) {
      // Same message for wrong, expired or used codes (never reveal which).
      setError(err instanceof ApiError && err.status === 429 ? t("link.rateLimited") : err instanceof ApiError && err.status === 0 ? t("common.offline") : t("link.error"));
    }
  };

  return (
    <>
      <View style={styles.intro}>
        <View style={styles.iconCircle}>
          <Ionicons name="key" size={30} color={colors.accent} />
        </View>
        <AppText align="center" color={colors.textMuted}>
          {t("link.intro")}
        </AppText>
      </View>
      <View style={styles.codeWrap}>
        <AppText variant="bodyStrong">{t("link.codeLabel")}</AppText>
        <TextInput
          accessibilityLabel={t("link.codeLabel")}
          value={code}
          onChangeText={(s) => setCode(normalizeInviteCode(s))}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={INVITE_CODE_LENGTH}
          placeholder="• • • • • •"
          placeholderTextColor={colors.textSubtle}
          style={[styles.code, error ? styles.codeError : null]}
          onSubmitEditing={() => complete && void send()}
          maxFontSizeMultiplier={1.3}
        />
      </View>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {ENV.useMock ? (
        <AppText variant="small" color={colors.textSubtle} align="center">
          {t("link.demoHint", { code: DEMO_INVITE_CODE })}
        </AppText>
      ) : null}
      <Button size="lg" label={t("link.submit")} disabled={!complete} loading={submit.isPending} onPress={() => void send()} />
      <Notice icon="lock-closed">{t("link.privacy")}</Notice>
    </>
  );
}

interface StateCardProps {
  readonly icon: IconName;
  readonly tone: string;
  readonly bg: string;
  readonly title: string;
  readonly body: string;
}

function StateCard({ icon, tone, bg, title, body }: StateCardProps) {
  return (
    <Card tint={bg} style={styles.state}>
      <Ionicons name={icon} size={44} color={tone} />
      <AppText variant="title" color={tone} align="center">
        {title}
      </AppText>
      <AppText align="center">{body}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: "center", gap: space.md, paddingTop: space.md },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  codeWrap: { gap: space.sm },
  code: {
    minHeight: 72,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 10,
    color: colors.text,
  },
  codeError: { borderColor: colors.danger },
  state: { alignItems: "center", gap: space.md, paddingVertical: space.xl },
});
