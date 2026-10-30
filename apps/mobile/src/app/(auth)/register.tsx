import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { z } from "zod";
import { ApiError } from "@/api";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Button, Notice, Screen, ScreenHeader, TextField } from "@/components/ui";
import { t } from "@/i18n";
import { colors, space } from "@/theme";

const schema = z.object({
  fullName: z.string().trim().min(2, { error: t("validation.required") }),
  email: z.email({ error: t("validation.email") }),
  password: z.string().min(8, { error: t("validation.password") }),
});
type Form = z.infer<typeof schema>;

export default function Register() {
  const router = useRouter();
  const { signUp } = useSession();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signUp(values);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? t("register.exists") : t("common.offline"));
    }
  });

  return (
    <Screen
      header={<ScreenHeader />}
      footer={<Button size="lg" label={t("register.submit")} loading={formState.isSubmitting} onPress={submit} />}
    >
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {t("register.title")}
        </AppText>
        <AppText color={colors.textMuted}>{t("register.subtitle")}</AppText>
      </View>
      <Controller
        control={control}
        name="fullName"
        render={({ field, fieldState }) => (
          <TextField
            label={t("register.fullName")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label={t("register.email")}
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
            label={t("register.password")}
            hint={t("register.passwordHint")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
        )}
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button variant="ghost" label={t("register.hasAccount")} onPress={() => router.replace("/login")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs },
});
