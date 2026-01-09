INSERT INTO migrations (timestamp, name) VALUES (1767609600000, 'AddPerMachineSecurityGroups1767609600000');

CREATE TABLE IF NOT EXISTS machine_security_groups (
  id VARCHAR(36) PRIMARY KEY,
  sessionId VARCHAR(36) NOT NULL,
  machineId VARCHAR(36) NOT NULL,
  machineName VARCHAR(255) NOT NULL,
  networkGroup VARCHAR(100) NOT NULL,
  securityGroupId VARCHAR(100) NOT NULL COMMENT 'AWS sg-xxxxx',
  securityGroupName VARCHAR(255) NOT NULL,
  allowedIngressSources JSON DEFAULT NULL COMMENT 'Array of {machineId?, machineName?, cidr?, protocol, fromPort?, toPort?, description?}',
  allowedEgressTargets JSON DEFAULT NULL COMMENT 'Array of {machineId?, machineName?, cidr?, protocol, fromPort?, toPort?, description?}',
  exposedPorts JSON DEFAULT NULL COMMENT 'Array of {protocol, containerPort, exposedToSolver, description?}',
  status ENUM('creating', 'active', 'deleting', 'deleted', 'failed') NOT NULL DEFAULT 'creating',
  awsMetadata JSON DEFAULT NULL COMMENT '{vpcId, ingressRuleIds?, egressRuleIds?, region, lastSyncAt?}',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deletedAt TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_machine_sg_session (sessionId),
  INDEX idx_machine_sg_machine (machineId),
  INDEX idx_machine_sg_status (status),
  INDEX idx_machine_sg_aws_id (securityGroupId),
  FOREIGN KEY (sessionId) REFERENCES environment_session(id) ON DELETE CASCADE
);
