const queryKeyMap = new Map<string, number>();

export async function queryWithMetrics<T>(queryName: string, queryFn: () => Promise<T>) {
  const start = performance.now();
  const result = await queryFn();
  const end = performance.now();
  const ms = end - start;

  if (ms > 450) {
    console.warn(`[query:slow] ${queryName} took ${ms.toFixed(1)}ms`);
  } else {
    console.log(`[query] ${queryName} took ${ms.toFixed(1)}ms`);
  }

  const current = (queryKeyMap.get(queryName) || 0) + 1;
  queryKeyMap.set(queryName, current);
  if (current >= 8) {
    console.warn(`[query:n+1] ${queryName} executed ${current}x in session`);
  }

  return result;
}
