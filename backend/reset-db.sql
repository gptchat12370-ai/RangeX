-- Drop and recreate database
DROP DATABASE IF EXISTS rangex;
CREATE DATABASE rangex CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Verify
USE rangex;
SHOW TABLES;
