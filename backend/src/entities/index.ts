import { AuditLog } from './audit-log.entity';
import { Asset } from './asset.entity';
import { EnvironmentMachine } from './environment-machine.entity';
import { EnvironmentSession } from './environment-session.entity';
import { Machine } from './machine.entity';
import { PlatformImage } from './platform-image.entity';
import { RegistryCredential } from './registry-credential.entity';
import { Scenario } from './scenario.entity';
import { ScenarioLimit } from './scenario-limit.entity';
import { ScenarioVersion } from './scenario-version.entity';
import { ScenarioAsset } from './scenario-asset.entity';
import { SystemSetting } from './system-setting.entity';
import { UsageDaily } from './usage-daily.entity';
import { User } from './user.entity';
import { Badge } from './badge.entity';
import { UserBadge } from './user-badge.entity';
import { Playlist } from './playlist.entity';
import { PlaylistItem } from './playlist-item.entity';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';
import { Notification } from './notification.entity';
import { AssetScenarioVersion } from './asset-scenario-version.entity';
import { InterfaceEndpoint } from './interface-endpoint.entity';
import { CareerPath } from './career-path.entity';
import { CareerPathItem } from './career-path-item.entity';
import { Event } from './event.entity';
import { EventScenario } from './event-scenario.entity';
import { EventRegistration } from './event-registration.entity';
import { SystemSettings } from './system-settings.entity';
import { Job } from './job.entity';
import { SessionNetworkTopology } from './session-network-topology.entity';
import { SessionSecurityGroup } from './session-security-group.entity';
import { NetworkPivotPoint } from './network-pivot-point.entity';

export const entities = [
  AuditLog,
  Asset,
  EnvironmentMachine,
  EnvironmentSession,
  Machine,
  PlatformImage,
  RegistryCredential,
  Scenario,
  ScenarioLimit,
  ScenarioVersion,
  ScenarioAsset,
  SystemSetting,
  UsageDaily,
  User,
  Badge,
  UserBadge,
  Playlist,
  PlaylistItem,
  Team,
  TeamMember,
  Notification,
  AssetScenarioVersion,
  InterfaceEndpoint,
  CareerPath,
  CareerPathItem,
  Event,
  EventScenario,
  EventRegistration,
  SystemSettings,
  Job,
  SessionNetworkTopology,
  SessionSecurityGroup,
  NetworkPivotPoint,
] as const;

export {
  AuditLog,
  Asset,
  EnvironmentMachine,
  EnvironmentSession,
  Machine,
  PlatformImage,
  RegistryCredential,
  Scenario,
  ScenarioLimit,
  ScenarioVersion,
  ScenarioAsset,
  SystemSetting,
  UsageDaily,
  User,
  Badge,
  UserBadge,
  Playlist,
  PlaylistItem,
  Team,
  TeamMember,
  Notification,
  AssetScenarioVersion,
  InterfaceEndpoint,
  CareerPath,
  CareerPathItem,
  Event,
  EventScenario,
  EventRegistration,
  SystemSettings,
  Job,
  SessionNetworkTopology,
  SessionSecurityGroup,
  NetworkPivotPoint,
};
