-- Dummy data for Good Job (PostgreSQL)
-- Run after migrate:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/dummy-data.sql
-- Or: docker exec -i goodjob-postgres psql -U postgres -d goodjob -v ON_ERROR_STOP=1 -f - < prisma/dummy-data.sql
--
-- Password for all dummy users: password123 (bcrypt below)
-- Emails *@sql-dummy.goodjob — avoid colliding with the prisma seed
-- Re-running this file deletes the old dummy rows (same ids), then re-inserts

BEGIN;

-- Delete in FK order (child → parent)
DELETE FROM notifications WHERE id IN (
  'n0000000-0000-4000-8000-000000000001',
  'n0000000-0000-4000-8000-000000000002'
);
DELETE FROM comments WHERE id = 'm0000000-0000-4000-8000-000000000001';
DELETE FROM reactions WHERE id IN (
  'r0000000-0000-4000-8000-000000000001',
  'r0000000-0000-4000-8000-000000000002'
);
DELETE FROM point_ledger WHERE id IN (
  'f0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000002',
  'f0000000-0000-4000-8000-000000000003',
  'f0000000-0000-4000-8000-000000000004'
);
DELETE FROM redemptions WHERE id = 'd0000000-0000-4000-8000-000000000001';
DELETE FROM kudo_media WHERE id = 'e0000000-0000-4000-8000-000000000001';
DELETE FROM kudos WHERE id IN (
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003'
);
DELETE FROM giving_budgets WHERE id IN (
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002'
);
DELETE FROM users WHERE id IN (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000004'
);
DELETE FROM rewards WHERE id IN ('sql-reward-book', 'sql-reward-lunch');

-- Bcrypt hash of 'password123' (cost 10), compatible with bcryptjs
INSERT INTO users (
  id, email, name, avatar_url, password, role, balance, is_active, created_at, updated_at
) VALUES
  (
    'a0000000-0000-4000-8000-000000000001',
    'sql-admin@sql-dummy.goodjob',
    'SQL Admin',
    NULL,
    '$2b$10$6ahxYVYOjiFVlswK0B.Ux.32DfWztuzcxpR8au0jkiVXNYDUEKzMq',
    'admin',
    0,
    true,
    NOW() - INTERVAL '30 days',
    NOW()
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'sql-alice@sql-dummy.goodjob',
    'SQL Alice',
    NULL,
    '$2b$10$6ahxYVYOjiFVlswK0B.Ux.32DfWztuzcxpR8au0jkiVXNYDUEKzMq',
    'user',
    50,
    true,
    NOW() - INTERVAL '20 days',
    NOW()
  ),
  (
    'a0000000-0000-4000-8000-000000000003',
    'sql-bob@sql-dummy.goodjob',
    'SQL Bob',
    NULL,
    '$2b$10$6ahxYVYOjiFVlswK0B.Ux.32DfWztuzcxpR8au0jkiVXNYDUEKzMq',
    'user',
    80,
    true,
    NOW() - INTERVAL '18 days',
    NOW()
  ),
  (
    'a0000000-0000-4000-8000-000000000004',
    'sql-carol@sql-dummy.goodjob',
    'SQL Carol',
    NULL,
    '$2b$10$6ahxYVYOjiFVlswK0B.Ux.32DfWztuzcxpR8au0jkiVXNYDUEKzMq',
    'user',
    120,
    true,
    NOW() - INTERVAL '15 days',
    NOW()
  );

INSERT INTO rewards (
  id, name, description, points_cost, image_url, is_active,
  quantity_total, quantity_redeemed,
  created_at, updated_at
) VALUES
  (
    'sql-reward-book',
    'SQL Book Voucher',
    'Dummy reward for SQL seed',
    150,
    NULL,
    true,
    100,
    0,
    NOW(),
    NOW()
  ),
  (
    'sql-reward-lunch',
    'SQL Team Lunch',
    'Dummy lunch reward',
    300,
    NULL,
    true,
    40,
    0,
    NOW(),
    NOW()
  );

INSERT INTO giving_budgets (id, user_id, year_month, used_points, updated_at)
VALUES
  (
    'b0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    '2026-04',
    80,
    NOW()
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003',
    '2026-04',
    0,
    NOW()
  );

INSERT INTO kudos (
  id, sender_id, receiver_id, points, message, core_value, status, created_at, updated_at
) VALUES
  (
    'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003',
    80,
    'Thanks for shipping the release on time — true teamwork.',
    'teamwork',
    'active',
    NOW() - INTERVAL '5 days',
    NOW()
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000004',
    120,
    'Your refactor made the codebase much easier to follow.',
    'innovation',
    'active',
    NOW() - INTERVAL '4 days',
    NOW()
  ),
  (
    'c0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000002',
    200,
    'You took ownership of the customer escalation — huge thanks.',
    'ownership',
    'active',
    NOW() - INTERVAL '2 days',
    NOW()
  );

INSERT INTO kudo_media (
  id, kudo_id, type, url, status, duration_secs, created_at
) VALUES
  (
    'e0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'image',
    'https://example.com/dummy/kudo-celebration.jpg',
    'ready',
    NULL,
    NOW() - INTERVAL '5 days'
  );

INSERT INTO point_ledger (
  id, user_id, amount, balance_after, type, kudo_id, redemption_id, created_at
) VALUES
  (
    'f0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000003',
    80,
    80,
    'received',
    'c0000000-0000-4000-8000-000000000001',
    NULL,
    NOW() - INTERVAL '5 days'
  ),
  (
    'f0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000004',
    120,
    120,
    'received',
    'c0000000-0000-4000-8000-000000000002',
    NULL,
    NOW() - INTERVAL '4 days'
  ),
  (
    'f0000000-0000-4000-8000-000000000003',
    'a0000000-0000-4000-8000-000000000002',
    200,
    200,
    'received',
    'c0000000-0000-4000-8000-000000000003',
    NULL,
    NOW() - INTERVAL '2 days'
  );

INSERT INTO redemptions (
  id, user_id, reward_id, points_spent, status, idempotency_key, created_at
) VALUES
  (
    'd0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    'sql-reward-book',
    150,
    'completed',
    'dummy-sql-redemption-001',
    NOW() - INTERVAL '1 day'
  );

INSERT INTO point_ledger (
  id, user_id, amount, balance_after, type, kudo_id, redemption_id, created_at
) VALUES
  (
    'f0000000-0000-4000-8000-000000000004',
    'a0000000-0000-4000-8000-000000000002',
    -150,
    50,
    'redeemed',
    NULL,
    'd0000000-0000-4000-8000-000000000001',
    NOW() - INTERVAL '1 day'
  );

INSERT INTO reactions (id, kudo_id, user_id, emoji, created_at)
VALUES
  (
    'r0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000004',
    '👍',
    NOW() - INTERVAL '4 days'
  ),
  (
    'r0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000003',
    '🎉',
    NOW() - INTERVAL '4 days'
  );

INSERT INTO comments (id, kudo_id, user_id, content, created_at, updated_at)
VALUES
  (
    'm0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    'Well deserved — that refactor was overdue!',
    NOW() - INTERVAL '3 days',
    NOW()
  );

INSERT INTO notifications (id, user_id, type, ref_id, is_read, expires_at, created_at)
VALUES
  (
    'n0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000003',
    'kudo_received',
    'c0000000-0000-4000-8000-000000000001',
    false,
    NOW() + INTERVAL '29 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    'n0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000002',
    'redemption_success',
    'd0000000-0000-4000-8000-000000000001',
    true,
    NOW() + INTERVAL '25 days',
    NOW() - INTERVAL '1 day'
  );

COMMIT;
