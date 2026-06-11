CREATE TYPE "Role" AS ENUM ('user', 'admin');
CREATE TYPE "CoreValue" AS ENUM ('teamwork', 'ownership', 'innovation', 'integrity', 'customer_focus');
CREATE TYPE "KudoStatus" AS ENUM ('pending_media', 'active');
CREATE TYPE "MediaType" AS ENUM ('image', 'video');
CREATE TYPE "MediaStatus" AS ENUM ('processing', 'ready', 'failed');
CREATE TYPE "LedgerType" AS ENUM ('received', 'redeemed');
CREATE TYPE "RedemptionStatus" AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE "NotificationType" AS ENUM ('kudo_received', 'reaction', 'comment', 'redemption_success');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'user',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "giving_budgets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "used_points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "giving_budgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kudos" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "core_value" "CoreValue" NOT NULL,
    "status" "KudoStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kudos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kudo_media" (
    "id" TEXT NOT NULL,
    "kudo_id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'processing',
    "duration_secs" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kudo_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "point_ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "type" "LedgerType" NOT NULL,
    "kudo_id" TEXT,
    "redemption_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "points_cost" INTEGER NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "redemptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "points_spent" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'completed',
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "kudo_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "kudo_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "ref_id" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE INDEX "giving_budgets_user_id_year_month_idx" ON "giving_budgets"("user_id", "year_month");

CREATE UNIQUE INDEX "giving_budgets_user_id_year_month_key" ON "giving_budgets"("user_id", "year_month");

CREATE INDEX "kudos_status_created_at_idx" ON "kudos"("status", "created_at" DESC);

CREATE INDEX "kudos_receiver_id_status_created_at_idx" ON "kudos"("receiver_id", "status", "created_at" DESC);

CREATE INDEX "point_ledger_user_id_created_at_idx" ON "point_ledger"("user_id", "created_at" DESC);

CREATE UNIQUE INDEX "redemptions_idempotency_key_key" ON "redemptions"("idempotency_key");

CREATE INDEX "redemptions_user_id_created_at_idx" ON "redemptions"("user_id", "created_at" DESC);

CREATE INDEX "reactions_kudo_id_idx" ON "reactions"("kudo_id");

CREATE UNIQUE INDEX "reactions_kudo_id_user_id_emoji_key" ON "reactions"("kudo_id", "user_id", "emoji");

CREATE INDEX "comments_kudo_id_created_at_idx" ON "comments"("kudo_id", "created_at");

CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at" DESC);


ALTER TABLE "giving_budgets" ADD CONSTRAINT "giving_budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kudos" ADD CONSTRAINT "kudos_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kudos" ADD CONSTRAINT "kudos_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kudo_media" ADD CONSTRAINT "kudo_media_kudo_id_fkey" FOREIGN KEY ("kudo_id") REFERENCES "kudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_kudo_id_fkey" FOREIGN KEY ("kudo_id") REFERENCES "kudos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_redemption_id_fkey" FOREIGN KEY ("redemption_id") REFERENCES "redemptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reactions" ADD CONSTRAINT "reactions_kudo_id_fkey" FOREIGN KEY ("kudo_id") REFERENCES "kudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "comments" ADD CONSTRAINT "comments_kudo_id_fkey" FOREIGN KEY ("kudo_id") REFERENCES "kudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

