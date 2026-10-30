import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAddSession } from "@/api/queries";
import { AppText, Button, Checkbox, Notice, Screen, ScreenHeader, Stepper } from "@/components/ui";
import { recordResult } from "@/features/result/record";
import { useLastResult } from "@/features/result/lastResult";
import { t } from "@/i18n";
import { callEmergency } from "@/lib/emergency";
import { colors, space } from "@/theme";

/** Input limits for what a home monitor can display (not medical thresholds). */
const LIMITS = { sys: [60, 260], dia: [30, 180], pulse: [30, 220] } as const;
const DEFAULTS = { sys: 120, dia: 80, pulse: 80 }; // spec §4.1.5

export default function MeasureBp() {
  const router = useRouter();
  const last = useLastResult();
  const isRemeasure = last?.evaluation.action === "REMEASURE";
  const [sys, setSys] = useState(DEFAULTS.sys);
  const [dia, setDia] = useState(DEFAULTS.dia);
  const [pulse, setPulse] = useState(DEFAULTS.pulse);
  const [noPulse, setNoPulse] = useState(false);
  const [failed, setFailed] = useState(false);
  const add = useAddSession();

  const invalid = sys <= dia;

  const submit = async () => {
    setFailed(false);
    try {
      const result = await add.mutateAsync({
        sys,
        dia,
        pulse: noPulse ? undefined : pulse,
        takenAt: new Date().toISOString(),
        source: "MANUAL",
      });
      await recordResult(result.evaluation, "SESSION", { sys, dia });
      router.replace("/result");
    } catch {
      setFailed(true);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title={isRemeasure ? t("bp.remeasureTitle") : t("bp.title")} />}
      footer={
        <>
          {invalid ? <Notice tone="high">{t("bp.sysBelowDia")}</Notice> : null}
          {failed ? (
            <Notice
              tone="danger"
              action={<Button variant="danger" icon="call" label={t("common.call14")} onPress={callEmergency} />}
            >
              {`${t("common.offline")} ${t("result.remeasureSymptoms")}`}
            </Notice>
          ) : null}
          <Button size="lg" label={t("bp.submit")} disabled={invalid} loading={add.isPending} onPress={() => void submit()} />
        </>
      }
    >
      <AppText color={colors.textMuted}>{t("bp.subtitle")}</AppText>
      <Stepper
        label={t("bp.sys")}
        hint={t("bp.sysHint")}
        unit={t("common.mmhg")}
        value={sys}
        min={LIMITS.sys[0]}
        max={LIMITS.sys[1]}
        onChange={setSys}
      />
      <Stepper
        label={t("bp.dia")}
        hint={t("bp.diaHint")}
        unit={t("common.mmhg")}
        value={dia}
        min={LIMITS.dia[0]}
        max={LIMITS.dia[1]}
        onChange={setDia}
      />
      <View style={styles.pulse}>
        <Stepper
          label={`${t("bp.pulse")} (${t("common.optional")})`}
          hint={t("bp.pulseHint")}
          unit={t("common.bpm")}
          value={pulse}
          min={LIMITS.pulse[0]}
          max={LIMITS.pulse[1]}
          onChange={setPulse}
          disabled={noPulse}
        />
        <Checkbox label={t("bp.noPulse")} checked={noPulse} onChange={setNoPulse} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pulse: { gap: space.sm },
});
