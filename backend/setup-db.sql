-- Create database
CREATE DATABASE IF NOT EXISTS rangex;

-- Create user
CREATE USER IF NOT EXISTS 'rangex_app'@'localhost' IDENTIFIED BY 'R@n53xP@ssw0rd!';

-- Grant privileges
GRANT ALL PRIVILEGES ON rangex.* TO 'rangex_app'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Show databases
SHOW DATABASES;
