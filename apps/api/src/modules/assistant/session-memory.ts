import { isCourtesyPhrase } from "./word-loader";

export type SessionTurn = { id: string; message: string; reply: string; intent: string | null; source: "llm" | "fallback"; feedback: -1 | 1 | null; created_at: Date };
type Session = { turns: SessionTurn[]; touchedAt: number };

const sessions = new Map<string, Session>();
const ttlMs = 24 * 60 * 60 * 1000;
const maxTurns = 4;
const maxSessions = 1_000;

export function sessionKey(partnerId: string, userId: string, sessionId = userId): string {
  return `${partnerId}:${userId}:${sessionId}`;
}

export function getSession(key: string): SessionTurn[] {
  const session = sessions.get(key);
  if (!session) return [];
  if (Date.now() - session.touchedAt > ttlMs) {
    sessions.delete(key);
    return [];
  }
  session.touchedAt = Date.now();
  return [...session.turns];
}

export function addSessionTurn(key: string, turn: SessionTurn): SessionTurn[] {
  const current = getSession(key);
  if (!sessions.has(key) && sessions.size >= maxSessions) {
    const now = Date.now();
    for (const [candidate, session] of sessions) {
      if (now - session.touchedAt > ttlMs) sessions.delete(candidate);
    }
    if (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value!);
  }
  const next = [...current, turn];
  const evicted = next.length > maxTurns ? next.splice(0, 2) : [];
  sessions.set(key, { turns: next, touchedAt: Date.now() });
  return evicted;
}

export function rateSessionTurn(key: string, id: string, feedback: -1 | 1): void {
  const session = sessions.get(key);
  if (session) session.turns = session.turns.map((turn) => turn.id === id ? { ...turn, feedback } : turn);
}

export function endSession(key: string): SessionTurn[] {
  const turns = getSession(key);
  sessions.delete(key);
  return turns;
}

export function clearUserSessions(partnerId: string, userId: string): void {
  for (const key of sessions.keys()) if (key.startsWith(`${partnerId}:${userId}:`)) sessions.delete(key);
}

export function buildConversationContext(turns: SessionTurn[]): string {
  return turns.slice(-maxTurns).map((turn) => `Mitra: ${turn.message}\nAsisten: ${turn.reply}`).join("\n").slice(-3000);
}

export function extractUserGoals(turns: SessionTurn[]): string {
  return turns
    .map((turn) => turn.message.trim())
    .filter((message) => message.length >= 12 && !isCourtesyPhrase(message))
    .slice(-5)
    .map((message) => `- ${message.slice(0, 280)}`)
    .join("\n")
    .slice(0, 1500);
}
export async function summarizeSession(turns: SessionTurn[], previousSummary: string): Promise<string> {
  const condensed = turns.filter((turn) => !isCourtesyPhrase(turn.message)).map((turn) =>
    `Mitra: ${turn.message.slice(0, 180)} | Asisten: ${turn.reply.slice(0, 220)}`).join("\n");
  if (!condensed) return previousSummary;
  const combined = [previousSummary, condensed].filter(Boolean).join("\n");
  return combined.length <= 2400 ? combined : `${combined.slice(0, 400)}\n…\n${combined.slice(-1996)}`;
}
