-- Migration: 0005_add_branch_settings.sql
-- Add is_open and settings columns to branches table

ALTER TABLE branches ADD COLUMN is_open INTEGER DEFAULT 1;
ALTER TABLE branches ADD COLUMN settings TEXT;
