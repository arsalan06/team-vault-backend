import { z } from "zod";

// Defines exactly what shape each endpoint's input must have.
// Used by the `validate` middleware before the controller ever runs.
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    name: z.string().min(2).max(100),
    password: z.string().min(8).max(72), // 72 = bcrypt/argon2 practical limit
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});
