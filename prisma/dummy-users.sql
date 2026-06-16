-- Adds demo users only (local auth, password: password123)
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/dummy-users.sql
--
-- Delete then re-insert with same id/email (does not touch @goodjob.com seed users)

BEGIN;

DELETE FROM users WHERE id IN (
  'a0000000-0000-4000-8000-000000000010',
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000012',
  'a0000000-0000-4000-8000-000000000013'
);

-- Same bcrypt 'password123' (cost 10) as prisma/dummy-data.sql
INSERT INTO users (
  id,
  email,
  name,
  avatar_url,
  password,
  google_id,
  auth_provider,
  role,
  balance,
  is_active,
  created_at,
  updated_at
) VALUES
  (
    'a0000000-0000-4000-8000-000000000010',
    'demo-dan@goodjob.com',
    'Dan Pham',
    NULL,
    '$2b$10$6ahxYVYOjiFVlswK0B.Ux.32DfWztuzcxpR8au0jkiVXNYDUEKzMq',
    NULL,
    'local',
    'user',
    200,
    true,
    NOW() - INTERVAL '10 days',
    NOW()
  ),
  (
    'a0000000-0000-4000-8000-000000000011',
    'demo-emma@goodjob.com',
    'Emma Vo',
    NULL,
    '$2b$10$6ahxYVYOjiFVlswK0B.Ux.32DfWztuzcxpR8au0jkiVXNYDUEKzMq',
    NULL,
    'local',
    'user',
    275,
    true,
    NOW() - INTERVAL '9 days',
    NOW()
  ),
  (
    'a0000000-0000-4000-8000-000000000012',
    'demo-frank@goodjob.com',
    'Frank Bui',
    NULL,
    '$2b$10$6ahxYVYOjiFVlswK0B.Ux.32DfWztuzcxpR8au0jkiVXNYDUEKzMq',
    NULL,
    'local',
    'user',
    90,
    true,
    NOW() - INTERVAL '8 days',
    NOW()
  ),
  (
    'a0000000-0000-4000-8000-000000000013',
    'demo-grace@goodjob.com',
    'Grace Ho',
    NULL,
    '$2b$10$6ahxYVYOjiFVlswK0B.Ux.32DfWztuzcxpR8au0jkiVXNYDUEKzMq',
    NULL,
    'local',
    'user',
    410,
    true,
    NOW() - INTERVAL '7 days',
    NOW()
  );

COMMIT;
