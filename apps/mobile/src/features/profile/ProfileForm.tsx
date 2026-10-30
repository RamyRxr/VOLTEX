import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch, type Control, type FieldPath } from "react-hook-form";
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";
import type { RiskDto } from "shared";
import { errorText } from "@/api";
import { useSaveProfile } from "@/api/queries";
import { AppText, Button, DateField, Notice, Screen, ScreenHeader, Segmented, TextField, YesNo } from "@/components/ui";
import { t, type TKey } from "@/i18n";
import { pregnancyWeek } from "@/lib/pregnancy";
import { colors, radius, space } from "@/theme";
import { buildProfileSchema, datesOf, emptyForm, toProfileInput, type BooleanField, type ProfileForm as Form } from "./schema";

interface Step {
  readonly title: TKey;
  readonly subtitle: TKey;
  readonly fields: readonly FieldPath<Form>[];
}

const STEPS: readonly Step[] = [
  { title: "profile.you.title", subtitle: "profile.you.subtitle", fields: ["fullName", "birthDate", "phone"] },
  {
    title: "profile.pregnancy.title",
    subtitle: "profile.pregnancy.subtitle",
    fields: ["dateKind", "pregnancyDate", "firstPregnancy", "multiplePregnancy", "ivfPregnancy"],
  },
  {
    title: "profile.health.title",
    subtitle: "profile.health.subtitle",
    fields: ["chronicHypertension", "previousPreeclampsia", "preexistingDiabetes", "gestationalDiabetes", "kidneyDisease", "autoimmuneDisease"],
  },
  { title: "profile.family.title", subtitle: "profile.family.subtitle", fields: ["familyPreeclampsia", "familyHypertension"] },
  { title: "profile.body.title", subtitle: "profile.body.subtitle", fields: ["heightCm", "weightKg", "treatments"] },
];

interface Props {
  /** Name typed at sign-up, editable here. */
  readonly initialFullName: string;
  readonly onSaved: (risk: RiskDto) => void;
  readonly onExit: () => void;
}

/** The medical profile, one short step at a time (spec §4.1.2). */
export function ProfileForm({ initialFullName, onSaved, onExit }: Props) {
  const now = useMemo(() => new Date(), []);
  const schema = useMemo(() => buildProfileSchema(now), [now]);
  const [step, setStep] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const save = useSaveProfile();
  const { control, trigger, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm(initialFullName),
    mode: "onTouched",
  });

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step] ?? STEPS[0]!;
  const [dateKind, pregnancyDate, firstPregnancy] = useWatch({ control, name: ["dateKind", "pregnancyDate", "firstPregnancy"] });
  const week = pregnancyDate ? pregnancyWeek(datesOf({ dateKind, pregnancyDate }), now) : null;

  const submit = handleSubmit(async (values) => {
    setSaveError(null);
    try {
      const { risk } = await save.mutateAsync(toProfileInput(values));
      onSaved(risk);
    } catch (err) {
      setSaveError(errorText(err));
    }
  });

  const next = async () => {
    if (isLast) return submit();
    if (await trigger(current.fields as FieldPath<Form>[], { shouldFocus: true })) {
      setStep(step + 1);
      scroll.current?.scrollTo({ y: 0, animated: false });
    }
  };

  const back = () => (step === 0 ? onExit() : setStep(step - 1));

  return (
    <Screen
      scroll={false}
      header={<ScreenHeader title={t("profile.title")} onBack={back} />}
      footer={
        <>
          {saveError ? <Notice tone="danger">{saveError}</Notice> : null}
          <Button
            size="lg"
            label={isLast ? t("profile.finish") : t("profile.next")}
            loading={save.isPending}
            onPress={() => void next()}
          />
        </>
      }
    >
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.progressWrap} accessibilityLabel={t("profile.step", { n: step + 1, total: STEPS.length })}>
          <AppText variant="caption" color={colors.textMuted}>
            {t("profile.step", { n: step + 1, total: STEPS.length })}
          </AppText>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
          </View>
        </View>
        <View style={styles.head}>
          <AppText variant="title" accessibilityRole="header">
            {t(current.title)}
          </AppText>
          <AppText color={colors.textMuted}>{t(current.subtitle)}</AppText>
        </View>

        {step === 0 ? (
          <>
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
              name="birthDate"
              render={({ field, fieldState }) => (
                <DateField label={t("profile.birthDate")} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <TextField
                  label={`${t("profile.phone")} (${t("common.optional")})`}
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
              )}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <View style={styles.group}>
              <AppText variant="bodyStrong">{t("profile.dateKind")}</AppText>
              <Controller
                control={control}
                name="dateKind"
                render={({ field }) => (
                  <Segmented
                    accessibilityLabel={t("profile.dateKind")}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "due", label: t("profile.dateKind.due") },
                      { value: "lmp", label: t("profile.dateKind.lmp") },
                    ]}
                  />
                )}
              />
            </View>
            <Controller
              control={control}
              name="pregnancyDate"
              render={({ field, fieldState }) => (
                <DateField
                  label={dateKind === "due" ? t("profile.dateKind.due") : t("profile.dateKind.lmp")}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            {week !== null ? <Notice icon="calendar">{t("profile.weekPreview", { n: week })}</Notice> : null}
            <Question control={control} name="firstPregnancy" label="profile.firstPregnancy" />
            <Question control={control} name="multiplePregnancy" label="profile.multiplePregnancy" />
            <Question control={control} name="ivfPregnancy" label="profile.ivfPregnancy" />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Question control={control} name="chronicHypertension" label="profile.chronicHypertension" />
            {firstPregnancy === false ? (
              <Question control={control} name="previousPreeclampsia" label="profile.previousPreeclampsia" />
            ) : null}
            <Question control={control} name="preexistingDiabetes" label="profile.preexistingDiabetes" />
            <Question control={control} name="gestationalDiabetes" label="profile.gestationalDiabetes" />
            <Question control={control} name="kidneyDisease" label="profile.kidneyDisease" />
            <Question control={control} name="autoimmuneDisease" label="profile.autoimmuneDisease" />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Question control={control} name="familyPreeclampsia" label="profile.familyPreeclampsia" />
            <Question control={control} name="familyHypertension" label="profile.familyHypertension" />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <View style={styles.pair}>
              <View style={styles.flex}>
                <Controller
                  control={control}
                  name="heightCm"
                  render={({ field, fieldState }) => (
                    <TextField
                      label={t("profile.heightCm")}
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      keyboardType="number-pad"
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </View>
              <View style={styles.flex}>
                <Controller
                  control={control}
                  name="weightKg"
                  render={({ field, fieldState }) => (
                    <TextField
                      label={t("profile.weightKg")}
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      keyboardType="decimal-pad"
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </View>
            </View>
            <Controller
              control={control}
              name="treatments"
              render={({ field }) => (
                <TextField
                  label={`${t("profile.treatments")} (${t("common.optional")})`}
                  placeholder={t("profile.treatmentsPlaceholder")}
                  value={field.value}
                  onChangeText={field.onChange}
                  multiline
                />
              )}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Question({ control, name, label }: { control: Control<Form>; name: BooleanField; label: TKey }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={styles.question}>
          <YesNo question={t(label)} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl, gap: space.lg },
  progressWrap: { gap: space.xs },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },
  head: { gap: space.xs },
  group: { gap: space.sm },
  question: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  pair: { flexDirection: "row", gap: space.md },
  flex: { flex: 1 },
});
