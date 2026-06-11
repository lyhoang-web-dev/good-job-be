-- AlterTable
ALTER TABLE "rewards" ADD COLUMN "quantity_total" INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE "rewards" ADD COLUMN "quantity_redeemed" INTEGER NOT NULL DEFAULT 0;

-- Đồng bộ số đã claim từ lịch sử redemption (status completed)
UPDATE "rewards" r
SET "quantity_redeemed" = COALESCE(sub.c, 0)
FROM (
  SELECT "reward_id", COUNT(*)::int AS c
  FROM "redemptions"
  WHERE "status" = 'completed'
  GROUP BY "reward_id"
) sub
WHERE r."id" = sub."reward_id";

-- Đảm bảo tổng luôn >= đã claim
UPDATE "rewards"
SET "quantity_total" = GREATEST("quantity_total", "quantity_redeemed" + 1);
