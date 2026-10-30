import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { api, type ChatMessage } from "@/api";
import { useLink } from "@/api/queries";
import { useMe } from "@/auth/SessionProvider";
import { Bubble } from "@/components/Bubble";
import { Composer } from "@/components/Composer";
import { AppText, Button, EmptyState, ErrorState, Loading, Notice, Screen } from "@/components/ui";
import { t } from "@/i18n";
import { formatDayTime } from "@/lib/format";
import { space } from "@/theme";

const chatKey = (linkId: string) => ["chat", linkId] as const;

/** Chat with the accepted doctor (Supabase Realtime in production, spec §4.1.9). */
export default function Chat() {
  const router = useRouter();
  const link = useLink();

  const header = (
    <View style={styles.header}>
      <AppText variant="title" accessibilityRole="header">
        {link.data?.status === "ACCEPTED" && link.data.doctorName ? link.data.doctorName : t("chat.title")}
      </AppText>
      <Notice tone="danger" icon="call">
        {t("chat.banner")}
      </Notice>
    </View>
  );

  if (link.isLoading) {
    return (
      <Screen inTabs scroll={false} header={header}>
        <Loading />
      </Screen>
    );
  }
  if (link.data?.status !== "ACCEPTED" || !link.data.linkId) {
    const pending = link.data?.status === "PENDING";
    return (
      <Screen inTabs scroll={false} header={header}>
        <EmptyState icon={pending ? "hourglass" : "medkit"} message={pending ? t("chat.pending") : t("chat.noDoctor")} />
        {!pending ? <Button icon="key" label={t("home.doctorAdd")} onPress={() => router.push("/doctor")} /> : null}
      </Screen>
    );
  }
  return <Thread linkId={link.data.linkId} header={header} />;
}

function Thread({ linkId, header }: { readonly linkId: string; readonly header: React.ReactNode }) {
  const me = useMe();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const messages = useQuery({ queryKey: chatKey(linkId), queryFn: () => api.chat.list(linkId) });

  useEffect(() => {
    return api.chat.subscribe(linkId, (message) => {
      queryClient.setQueryData<ChatMessage[]>(chatKey(linkId), (prev = []) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
    });
  }, [linkId, queryClient]);

  const send = useMutation({
    mutationFn: (body: string) => api.chat.send(linkId, body),
    onSuccess: (message) =>
      queryClient.setQueryData<ChatMessage[]>(chatKey(linkId), (prev = []) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      ),
  });

  const now = new Date();
  const list = [...(messages.data ?? [])].reverse();

  return (
    <Screen
      inTabs
      scroll={false}
      header={header}
      footer={
        <>
          {failed ? <Notice tone="danger">{t("chat.sendError")}</Notice> : null}
          <Composer
            placeholder={t("chat.placeholder")}
            busy={send.isPending}
            onSend={async (body) => {
              setFailed(false);
              try {
                await send.mutateAsync(body);
              } catch (err) {
                setFailed(true);
                throw err;
              }
            }}
          />
        </>
      }
    >
      {messages.isLoading ? (
        <Loading />
      ) : messages.isError ? (
        <ErrorState onRetry={() => void messages.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon="chatbubbles" message={t("chat.empty")} />
      ) : (
        <FlatList
          inverted
          data={list}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Bubble body={item.body} mine={item.senderId === me.id} meta={formatDayTime(item.createdAt, now)} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md },
  list: { paddingVertical: space.md, flexGrow: 1 },
});
