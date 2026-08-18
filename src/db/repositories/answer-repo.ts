import { getDatabase } from "../connection.js";

export interface AnswerRecord {
  id: string;
  session_id: string;
  question_id: string;
  answer_value: string;
  answered_at: number;
}

export class AnswerRepository {
  create(sessionId: string, questionId: string, answerValue: string): AnswerRecord {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = Date.now();
    db.prepare(`
      INSERT INTO answers (id, session_id, question_id, answer_value, answered_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, sessionId, questionId, answerValue, now);
    return { id, session_id: sessionId, question_id: questionId, answer_value: answerValue, answered_at: now };
  }

  findBySessionId(sessionId: string): AnswerRecord[] {
    const db = getDatabase();
    return db.prepare("SELECT * FROM answers WHERE session_id = ? ORDER BY answered_at")
      .all(sessionId) as AnswerRecord[];
  }

  deleteBySessionId(sessionId: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM answers WHERE session_id = ?").run(sessionId);
  }
}
