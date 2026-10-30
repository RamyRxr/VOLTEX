import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText, Button, Card, Loading, Notice, Screen, ScreenHeader, Stepper, ToggleRow } from "@/components/ui";
import { t, type TKey } from "@/i18n";
import { applyReminders, loadReminders, type ReminderKind, type ReminderSettings } from "@/notifications/reminders";
import { colors, space } from "@/theme";

const ROWS: readonly [ReminderKind, TKey][] = [
  ["bpMorning", "reminders.bpMorning"],
  ["bpEvening", "reminders.bpEvening"],
  ["questionnaire", "reminders.questionnaire"],
];

/** Local reminders with editable times (CLAUDE.md §4.1.10). */
export default function Reminders() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<"saved" | "denied" | null>(null);

  useEffect(() => {
    void loadReminders().then(setSettings);
  }, []);

  const update = (kind: ReminderKind, patch: Partial<ReminderSettings[ReminderKind]>) => {
    setOutcome(null);
    setSettings((prev) => (prev ? { ...prev, [kind]: { ...prev[kind], ...patch } } : prev));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const ok = await applyReminders(settings).catch(() => false);
    setSaving(false);
    setOutcome(ok ? "saved" : "denied");
  };

  return (
    <Screen
      header={<ScreenHeader title={t("reminders.title")} />}
      footer={
        <>
          {outcome === "saved" ? <Notice tone="ok">{t("reminders.saved")}</Notice> : null}
          {outcome === "denied" ? <Notice tone="high">{t("reminders.permissionDenied")}</Notice> : null}
          <Button size="lg" label={t("common.save")} loading={saving} disabled={!settings} onPress={() => void save()} />
        </>
      }
    >
      <AppText color={colors.textMuted}>{t("reminders.intro")}</AppText>
      {!settings ? (
        <Loading />
      ) : (
        ROWS.map(([kind, label]) => {
          const r = settings[kind];
          return (
            <Card key={kind} style={styles.card}>
              <ToggleRow label={t(label)} value={r.enabled} onChange={(enabled) => update(kind, { enabled })} />
              {r.enabled ? (
                <View style={styles.time}>
                  <View style={styles.flex}>
                    <Stepper
                      compact
                      label={`${t(label)} — ${t("reminders.hour")}`}
                      unit={t("reminders.hour")}
                      value={r.hour}
                      min={0}
                      max={23}
                      pad={2}
                      onChange={(hour) => update(kind, { hour })}
                    />
                  </View>
                  <AppText variant="title" color={colors.textSubtle}>
                    :
                  </AppText>
                  <View style={styles.flex}>
                    <Stepper
                      compact
                      label={`${t(label)} — ${t("reminders.minute")}`}
                      unit={t("reminders.minute")}
                      value={r.minute}
                      min={0}
                      max={55}
                      step={5}
                      pad={2}
                      onChange={(minute) => update(kind, { minute })}
                    />
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0, overflow: "hidden" },
  time: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, paddingBottom: space.sm },
  flex: { flex: 1 },
});
