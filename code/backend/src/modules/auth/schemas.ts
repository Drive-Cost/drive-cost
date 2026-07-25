const emailSchema = {
  type: "string",
  format: "email",
  maxLength: 254,
} as const;

const passwordSchema = {
  type: "string",
  minLength: 12,
  maxLength: 128,
} as const;

export const credentialsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["email", "password"],
  properties: {
    email: emailSchema,
    password: passwordSchema,
  },
} as const;

export const authResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["accessToken", "user"],
  properties: {
    accessToken: { type: "string" },
    user: {
      type: "object",
      additionalProperties: false,
      required: ["id", "mode"],
      properties: {
        id: { type: "string" },
        mode: { type: "string", enum: ["guest", "registered"] },
        email: emailSchema,
      },
    },
  },
} as const;

export interface CredentialsInput {
  email: string;
  password: string;
}
