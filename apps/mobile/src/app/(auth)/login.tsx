import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { z } from "zod";
import { errorText } from "@/api";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Button, Card, Notice, Screen, ScreenHeader, TextField } from "@/components/ui";
import { DEMO_ACCOUNTS } from "@/config/demo";
import { ENV } from "@/config/env";
import { t } from "@/i18n";
import { colors, space } from "@/theme";

const schema = z.object({
  email: z.email({ error: t("validation.email") }),
  password: z.string().min(1, { error: t("validation.required") }),
});
type Form = z.infer<typeof schema>;

export default function Login() {
  const router = useRouter();
  const { as } = useLocalSearchParams<{ as?: string }>();
  const asDoctor = as === "doctor";
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, setValue, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await signIn(email, password);
      // The root guards switch to the patient or doctor space by themselves.
      router.replace("/");
    } catch (err) {
      setError(errorText(err));
    }
  });

  const fillDemo = (email: string) => {
    setValue("email", email);
    setValue("password", DEMO_ACCOUNTS.password);
  };

  return (
    <Screen
      header={<ScreenHeader />}
      footer={<Button size="lg" label={t("login.submit")} loading={formState.isSubmitting} onPress={submit} />}
    >
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {asDoctor ? t("login.doctorTitle") : t("login.title")}
        </AppText>
        <AppText color={colors.textMuted}>{asDoctor ? t("login.doctorSubtitle") : t("login.subtitle")}</AppText>
      </View>

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={t("login.email")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label={t("login.password")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={() => void submit()}
            returnKeyType="go"
          />
        )}
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {!asDoctor ? (
        <Button variant="ghost" label={t("login.noAccount")} onPress={() => router.replace("/register")} />
      ) : null}

      {ENV.demoMode ? (
        <Card tint={colors.surfaceMuted}>
          <AppText variant="caption" color={colors.textMuted}>
            {t("login.demoTitle")}
          </AppText>
          <View style={styles.demoRow}>
            <Button
              variant="secondary"
              icon="person-circle"
              label={t("login.demoPatient")}
              onPress={() => fillDemo(DEMO_ACCOUNTS.patient)}
              style={styles.demoBtn}
            />
            <Button
              variant="secondary"
              icon="medkit"
              label={t("login.demoDoctor")}
              onPress={() => fillDemo(DEMO_ACCOUNTS.doctor)}
              style={styles.demoBtn}
            />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs },
  demoRow: { flexDirection: "row", gap: space.sm },
  demoBtn: { flex: 1, paddingHorizontal: space.sm },
});
