-- CreateTable
CREATE TABLE "site_media" (
    "id" SERIAL NOT NULL,
    "section" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "public_id" VARCHAR(255),
    "url" VARCHAR(1000) NOT NULL,
    "format" VARCHAR(50),
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "display_order" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_media_pkey" PRIMARY KEY ("id")
);
