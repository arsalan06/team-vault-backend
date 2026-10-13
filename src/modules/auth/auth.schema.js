import { z } from "zod";

// Emails are compared case-insensitively in practice, so normalize them
// before they reach the DB — otherwise "Bob@x.com" and "bob@x.com" could
// register as two accounts, and login would depend on capitalization.
const email = z.string().trim().toLowerCase().pipe(z.email());

// Defines exactly what shape each endpoint's input must have.
// Used by the `validate` middleware before the controller ever runs.
export const registerSchema = z.object({
  body: z.object({
    email,
    name: z.string().trim().min(2).max(100),
    password: z.string().min(8).max(72), // 72 = bcrypt/argon2 practical limit
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1).max(1024), // cap input fed to argon2
  }),
});
