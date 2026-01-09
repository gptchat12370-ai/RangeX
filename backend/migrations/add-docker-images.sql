-- Docker Images Table (for both ready and custom images)
CREATE TABLE IF NOT EXISTS docker_image (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tag VARCHAR(100) NOT NULL DEFAULT 'latest',
    registry_url VARCHAR(255) DEFAULT 'docker.io',
    description TEXT,
    category VARCHAR(100),
    is_public BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_ready_image BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_image (name(191), tag, registry_url),
    FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
);

-- Docker Credentials Table (for private registries)
CREATE TABLE IF NOT EXISTS docker_credential (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    registry_url VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_cred (user_id, registry_url),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Environment Images Link Table (many-to-many)
CREATE TABLE IF NOT EXISTS environment_image (
    id VARCHAR(36) PRIMARY KEY,
    environment_id VARCHAR(36) NOT NULL,
    docker_image_id VARCHAR(36) NOT NULL,
    container_name VARCHAR(255),
    ports_mapping JSON,
    environment_vars JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (environment_id) REFERENCES environment_session(id) ON DELETE CASCADE,
    FOREIGN KEY (docker_image_id) REFERENCES docker_image(id) ON DELETE CASCADE
);
