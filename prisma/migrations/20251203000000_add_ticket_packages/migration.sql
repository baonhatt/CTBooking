-- CreateTable
CREATE TABLE "ticket_packages" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50),
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "features" JSONB,
    "type" VARCHAR(50),
    "min_group_size" INTEGER,
    "max_group_size" INTEGER,
    "is_member_only" BOOLEAN DEFAULT FALSE,
    "is_active" BOOLEAN DEFAULT TRUE,
    "display_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_packages_code_key" ON "ticket_packages" ("code");
