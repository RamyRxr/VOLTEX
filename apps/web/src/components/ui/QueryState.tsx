"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api";
import { fr } from "@/lib/i18n/fr";

/** Loading skeleton or error with retry; renders children once data is there. */
export function QueryState<T>({
  query,
  children,
  skeletonRows = 4,
}: {
  query: UseQueryResult<T>;
  children: React.ReactNode;
  skeletonRows?: number;
}) {
  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label={fr.common.loading} style={{ display: "grid", gap: 10, padding: 20 }}>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 36 }} />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="empty" role="alert">
        <p>{errorMessage(query.error) || fr.common.error}</p>
        <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => void query.refetch()}>
          {fr.common.retry}
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
