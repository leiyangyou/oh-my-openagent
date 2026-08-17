import type { ModelMapSessionClient } from "./controller"

export async function findInheritedSessionID(
  sessionID: string,
  selections: ReadonlyMap<string, unknown>,
  session: ModelMapSessionClient,
): Promise<string | undefined> {
  let candidate: string | undefined = sessionID
  const visited = new Set<string>()

  while (candidate !== undefined && !visited.has(candidate)) {
    if (selections.has(candidate)) return candidate
    visited.add(candidate)
    const response = await session.get({ path: { id: candidate } })
    candidate = response.data?.parentID
  }

  return undefined
}
