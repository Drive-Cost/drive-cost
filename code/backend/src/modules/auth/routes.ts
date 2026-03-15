import { FastifyInstance } from "fastify";
import { createId, readDatabase, writeDatabase } from "../../lib/fileDatabase";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/guest", async (_request, reply) => {
    const database = readDatabase();
    const session = {
      id: createId("session"),
      userId: createId("user"),
      mode: "guest" as const,
      createdAt: new Date().toISOString(),
    };

    database.users.push({
      id: session.userId,
      mode: "guest",
      createdAt: session.createdAt,
    });
    database.sessions.push(session);
    writeDatabase(database);

    reply.code(201);
    return session;
  });
}
