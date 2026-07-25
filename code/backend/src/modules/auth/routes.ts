import { FastifyInstance } from "fastify";
import { createId, readDatabase, writeDatabase } from "../../lib/fileDatabase";
import { CredentialsInput, authResponseSchema, credentialsSchema } from "./schemas";
import { hashPassword, verifyPassword } from "./passwords";

function toAuthResponse(app: FastifyInstance, user: {
  id: string;
  mode: "guest" | "registered";
  email?: string;
}) {
  return {
    accessToken: app.jwt.sign(
      { sub: user.id, mode: user.mode, email: user.email },
      { expiresIn: "30d" },
    ),
    user: {
      id: user.id,
      mode: user.mode,
      ...(user.email ? { email: user.email } : {}),
    },
  };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/guest", { schema: { response: { 201: authResponseSchema } } }, async (_request, reply) => {
    const database = readDatabase();
    const user = {
      id: createId("user"),
      mode: "guest" as const,
      createdAt: new Date().toISOString(),
    };

    database.users.push(user);
    writeDatabase(database);

    reply.code(201);
    return toAuthResponse(app, user);
  });

  app.post<{ Body: CredentialsInput }>(
    "/auth/register",
    { schema: { body: credentialsSchema, response: { 201: authResponseSchema } } },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      const database = readDatabase();

      if (database.users.some((user) => user.email === email)) {
        return reply.code(409).send({ error: "email_already_registered" });
      }

      const user = {
        id: createId("user"),
        mode: "registered" as const,
        email,
        passwordHash: await hashPassword(request.body.password),
        createdAt: new Date().toISOString(),
      };
      database.users.push(user);
      writeDatabase(database);

      reply.code(201);
      return toAuthResponse(app, user);
    },
  );

  app.post<{ Body: CredentialsInput }>(
    "/auth/login",
    { schema: { body: credentialsSchema, response: { 200: authResponseSchema } } },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      const database = readDatabase();
      const user = database.users.find(
        (candidate) => candidate.email === email && candidate.mode === "registered",
      );

      if (!user?.passwordHash || !(await verifyPassword(request.body.password, user.passwordHash))) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }

      return toAuthResponse(app, user);
    },
  );
}
