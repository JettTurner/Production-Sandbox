import { getDatabase } from "../connection.js";
import { InterviewSession } from "../../core/interview/session-manager.js";

export interface SessionRecord {
  id: string;
  name: string;
  status: string;
  data_json: string;
  created_at: number;
  updated_at: number;
}

export class SessionRepository {
  create(session: InterviewSession): SessionRecord {
    const db = getDatabase();
    const data = session.serialize();
    const stmt = db.prepare(`
      INSERT INTO sessions (id, name, status, data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      session.id,
      session.name,
      session.getStatus(),
      JSON.stringify(data),
      session.getCreatedAt(),
      session.getUpdatedAt()
    );
    return this.findById(session.id)!;
  }

  findById(id: string): SessionRecord | null {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRecord | undefined;
    return row || null;
  }

  findAll(): SessionRecord[] {
    const db = getDatabase();
    return db.prepare("SELECT * FROM sessions ORDER BY updated_at DESC").all() as SessionRecord[];
  }

  update(session: InterviewSession): void {
    const db = getDatabase();
    const data = session.serialize();
    db.prepare(`
      UPDATE sessions SET name = ?, status = ?, data_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      session.name,
      session.getStatus(),
      JSON.stringify(data),
      session.getUpdatedAt(),
      session.id
    );
  }

  delete(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }

  toSession(record: SessionRecord): InterviewSession {
    const data = JSON.parse(record.data_json);
    return InterviewSession.deserialize(data);
  }
}
