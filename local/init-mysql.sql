CREATE DATABASE IF NOT EXISTS rangex;
CREATE USER IF NOT EXISTS 'rangex_app'@'%' IDENTIFIED BY '${RANGEX_DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON rangex.* TO 'rangex_app'@'%';
FLUSH PRIVILEGES;

-- Additional tables will be created by TypeORM synchronize (teams, notifications, playlist_item, interface_endpoint, asset_scenario_version).

