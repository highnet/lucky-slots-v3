async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { public: { apiUrl } } = useRuntimeConfig();
  const res = await fetch(apiUrl as string, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }
  return json.data as T;
}

export interface VerificationResult {
  spinId: string;
  match: boolean;
  serverSeed: string;
  serverHash: string;
  clientSeed: string;
  nonce: number;
  recomputedGrid: string[][];
}

export function useVerifySpin() {
  async function verify(spinId: string): Promise<VerificationResult> {
    const data = await graphqlRequest<{ verifySpin: unknown }>(`
      query VerifySpin($id: ID!) {
        verifySpin(id: $id) {
          spinId
          match
          serverSeed
          serverHash
          clientSeed
          nonce
          recomputedGrid
        }
      }
    `, { id: spinId });
    const r = data.verifySpin as Record<string, unknown>;
    return {
      spinId: String(r.spinId ?? ''),
      match: Boolean(r.match),
      serverSeed: String(r.serverSeed ?? ''),
      serverHash: String(r.serverHash ?? ''),
      clientSeed: String(r.clientSeed ?? ''),
      nonce: Number(r.nonce ?? 0),
      recomputedGrid: Array.isArray(r.recomputedGrid) ? (r.recomputedGrid as string[][]) : [],
    };
  }

  return { verify };
}
