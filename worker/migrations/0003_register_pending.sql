-- Registrations waiting for their email code (see server/routes/user/register-otp.ts)
CREATE TABLE IF NOT EXISTS `register_pending` (
  `email` text PRIMARY KEY NOT NULL,
  `registration_id` text NOT NULL,
  `name` text NOT NULL,
  `phone` text,
  `gender` text,
  `dob` text,
  `password_hash` text NOT NULL,
  `code_hash` text NOT NULL,
  `code_expires_at` integer NOT NULL,
  `sent_at` integer NOT NULL,
  `fails` integer DEFAULT 0 NOT NULL,
  `expires_at` integer NOT NULL
);
