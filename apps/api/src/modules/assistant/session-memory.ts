type SessionTurn = { id: string; message: string; reply: string; intent: string | null; source: "llm" | "fallback"; feedback: -1 | 1 | null; created_at: Date };
type Session = { turns: SessionTurn[]; touchedAt: number };

const sessions = new Map<string, Session>();
const ttlMs = 24 * 60 * 60 * 1000;
const maxTurns = 15;
const maxSessions = 1_000;

export function sessionKey(partnerId: string, userId: string): string {
  return `${partnerId}:${userId}`;
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

export function addSessionTurn(key: string, turn: SessionTurn): void {
  const current = getSession(key);
  if (!sessions.has(key) && sessions.size >= maxSessions) {
    const now = Date.now();
    for (const [candidate, session] of sessions) {
      if (now - session.touchedAt > ttlMs) sessions.delete(candidate);
    }
    if (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value!);
  }
  sessions.set(key, { turns: [...current, turn].slice(-maxTurns), touchedAt: Date.now() });
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

export function buildConversationContext(turns: SessionTurn[]): string {
  return turns.slice(-5).map((turn) => `Mitra: ${turn.message}\nAsisten: ${turn.reply}`).join("\n").slice(-2200);
}

export function extractUserGoals(turns: SessionTurn[]): string {
  return turns
    .map((turn) => turn.message.trim())
    .filter((message) => message.length >= 12 && !/^(?:halo|hai|hi|tes|test|ok|oke|terima kasih)[.!?\s]*$/i.test(message))
    .slice(-5)
    .map((message) => `- ${message.slice(0, 280)}`)
    .join("\n")
    .slice(0, 1500);
}
export async function summarizeSession(turns: SessionTurn[], previousSummary: string): Promise<string> {
  const goals = extractUserGoals(turns);
  if (!goals) return previousSummary;
  return [previousSummary, goals].filter(Boolean).join("\n").slice(-1800);
}
