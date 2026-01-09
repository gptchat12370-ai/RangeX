import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { envValidationSchema } from './config/env.validation';
import { AuthController } from './controllers/auth.controller';
import { SolverController } from './controllers/solver.controller';
import { AdminController } from './controllers/admin.controller';
import { CreatorController } from './controllers/creator.controller';
import { AccountController } from './controllers/account.controller';
import { AssetsController } from './controllers/assets.controller';
import { PlaylistController } from './controllers/playlist.controller';
import { TeamsController } from './controllers/teams.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { CareerPathController } from './controllers/career-path.controller';
import { EventsController } from './controllers/events.controller';
import { HealthController } from './controllers/health.controller';
import { SettingsController } from './controllers/settings.controller';
import { User } from './entities/user.entity';
import { SystemSettings } from './entities/system-settings.entity';
import { Scenario } from './entities/scenario.entity';
import { ScenarioVersion } from './entities/scenario-version.entity';
import { Asset } from './entities/asset.entity';
import { AssetScenarioVersion } from './entities/asset-scenario-version.entity';
import { Event } from './entities/event.entity';
import { Notification } from './entities/notification.entity';
import { CareerPath } from './entities/career-path.entity';
import { CareerPathItem } from './entities/career-path-item.entity';
import { Playlist } from './entities/playlist.entity';
import { PlaylistItem } from './entities/playlist-item.entity';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { TeamJoinRequest } from './entities/team-join-request.entity';
import { AssetStorageService } from './services/asset-storage.service';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { BadgesService } from './services/badges.service';
import { BadgesJob } from './jobs/badges.job';
import { AuditService } from './services/audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { BadgeRequirement } from './entities/badge-requirement.entity';
import { AdminBadgeController } from './controllers/admin-badge.controller';
import { BadgeController } from './controllers/badge.controller';
import { DockerImageController } from './controllers/docker-image.controller';
import { UploadController } from './controllers/upload.controller';
import { FavoritesController } from './controllers/favorites.controller';
import { RatingsController } from './controllers/ratings.controller';
import { TestDeploymentController } from './controllers/test-deployment.controller';
import { SessionConnectionController } from './controllers/session-connection.controller';
import { ProxyController } from './controllers/proxy.controller';
import { EnvironmentSession } from './entities/environment-session.entity';
import { UsageDaily } from './entities/usage-daily.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { ScenarioLimit } from './entities/scenario-limit.entity';
import { EnvironmentMachine } from './entities/environment-machine.entity';
import { UserFavorite } from './entities/user-favorite.entity';
import { ScenarioRating } from './entities/scenario-rating.entity';
import { EventRegistration } from './entities/event-registration.entity';
import { EventScenario } from './entities/event-scenario.entity';
import { EventParticipation } from './entities/event-participation.entity';
import { EventSession } from './entities/event-session.entity';
import { InterfaceEndpoint } from './entities/interface-endpoint.entity';
import { PlatformImage } from './entities/platform-image.entity';
import { RegistryCredential } from './entities/registry-credential.entity';
import { Machine } from './entities/machine.entity';
import { ScenarioAsset } from './entities/scenario-asset.entity';
import { ScenarioVersionAdminTest } from './entities/scenario-version-admin-test.entity';
// AdminTestValidation removed - not using automated testing
import { DockerImage } from './entities/docker-image.entity';
import { DockerCredential } from './entities/docker-credential.entity';
import { TestDeployment } from './entities/test-deployment.entity';
import { ScenarioVersionTestRun } from './entities/scenario-version-test-run.entity';
import { MachineSecurityGroup } from './entities/machine-security-group.entity';
import { SessionsService } from './services/sessions.service';
import { CostService } from './services/cost.service';
import { RegistryService } from './services/registry.service';
import { DockerImageService } from './services/docker-image.service';
import { ImagePullService } from './services/image-pull.service';
import { AppService } from './app.service';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './common/guards/jwt.strategy';
import { RolesGuard } from './common/guards/roles.guard';
import { SystemSettingsService } from './services/system-settings.service';
import { TeamsService } from './services/teams.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { UsersService } from './services/users.service';
import { CareerPathService } from './services/career-path.service';
import { EventsService } from './services/events.service';
import { NotificationsService } from './services/notifications.service';
import { PlaylistService } from './services/playlist.service';
import { ScenariosService } from './services/scenarios.service';
import { EnvironmentService } from './services/environment.service';
import { LimitService } from './services/limit.service';
import { AwsIntegrationService } from './services/aws-integration.service';
import { SessionLimitService } from './services/session-limit.service';
import { MinioService } from './services/minio.service';
import { FileOrganizationService } from './services/file-organization.service';
import { DockerImagesService } from './services/docker-images.service';
import { DockerComposeGeneratorService } from './services/docker-compose-generator.service';
import { SessionStateMachineService } from './services/session-state-machine.service';
import { SessionTimeoutService } from './services/session-timeout.service';
import { EventCleanupService } from './services/event-cleanup.service';
import { SessionSecurityService } from './services/session-security.service';
import { EventParticipationService } from './services/event-participation.service';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { PrivateNetworkMiddleware } from './common/middleware/private-network.middleware';
import { BudgetEventBridgeService } from './services/budget-eventbridge.service';
import { MultiOsGuiService } from './services/multi-os-gui.service';
import { OrphanedTaskMonitorService } from './services/orphaned-task-monitor.service';
import { AwsConfigSyncService } from './services/aws-config-sync.service';
import { AlertService } from './services/alert.service';
import { BudgetMonitorService } from './services/budget-monitor.service';
import { CreatorTestingService } from './services/creator-testing.service';
import { ScenarioWorkflowService } from './services/scenario-workflow.service';
import { CreatorEnvironmentService } from './services/creator-environment.service';
import { ImagePipelineService } from './services/image-pipeline.service';
import { CreatorTestingController } from './controllers/creator-testing.controller';
import { ImagePipelineController } from './controllers/image-pipeline.controller';
import { AdminDeploymentsController } from './controllers/admin-deployments.controller';
import { BudgetMonitorController } from './controllers/budget-monitor.controller';
import { OrphanedTaskController } from './controllers/orphaned-task.controller';
import { AwsConfigController } from './controllers/aws-config.controller';
import { MultiOsGuiController } from './controllers/multi-os-gui.controller';
import { ImageVariant } from './entities/image-variant.entity';
import { Tool } from './entities/tool.entity';
import { CreatorPreferences } from './entities/creator-preferences.entity';
import { Job } from './entities/job.entity';
import { CreatorModule } from './modules/creator.module';
import { JobQueueService } from './services/job-queue.service';
import { SubmissionValidationService } from './services/submission-validation.service';
import { JobWorkerService } from './services/job-worker.service';
import { ImageScanService } from './services/image-scan.service';
import { ECRPromotionService } from './services/ecr-promotion.service';
import { TestDeploymentService } from './services/test-deployment.service';
import { TestDeploymentGateway } from './gateways/test-deployment.gateway';
import { VpcEndpointService } from './services/vpc-endpoint.service';
import { GatewayProxyService } from './services/gateway-proxy.service';
import { SessionSecurityGroupService } from './services/session-security-group.service';
import { SessionConnectionService } from './services/session-connection.service';
import { SshGatewayService } from './services/ssh-gateway.service';
import { SshGateway } from './gateways/ssh.gateway';
import { DockerComposeSyncService } from './services/docker-compose-sync.service';
import { DockerComposeSyncServicePhase23 } from './services/docker-compose-sync-phase23.service';
import { ScenarioApprovalService } from './services/scenario-approval.service';
// AdminTestService removed - not using automated testing
import { AdminTestEnvironmentService } from './services/admin-test-environment.service';
import { BuildOrchestrationService } from './services/build-orchestration.service';
import { BundleService } from './services/bundle.service';
import { AwsDeployService } from './services/aws-deploy.service';
import { AwsHealthCheckService } from './services/aws-health-check.service';
import { DeploymentEnvironment } from './entities/deployment-environment.entity';
import { SessionNetworkTopology } from './entities/session-network-topology.entity';
import { SessionSecurityGroup } from './entities/session-security-group.entity';
import { NetworkPivotPoint } from './entities/network-pivot-point.entity';
import { SecurityGroupManagerService } from './services/security-group-manager.service';
import { PerMachineSecurityGroupService } from './services/per-machine-security-group.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: envValidationSchema,
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [
          User,
          SystemSettings,
          Scenario,
          ScenarioVersion,
          Asset,
          AssetScenarioVersion,
          Event,
          Notification,
          CareerPath,
          CareerPathItem,
          Playlist,
          PlaylistItem,
          Team,
          TeamMember,
          TeamJoinRequest,
          Badge,
          UserBadge,
          BadgeRequirement,
          AuditLog,
          EnvironmentSession,
          UsageDaily,
          SystemSetting,
          ScenarioLimit,
          EnvironmentMachine,
          UserFavorite,
          ScenarioRating,
          EventRegistration,
          EventScenario,
          EventParticipation,
          EventSession,
          InterfaceEndpoint,
          PlatformImage,
          RegistryCredential,
          Machine,
          ScenarioAsset,
          SessionNetworkTopology,
          SessionSecurityGroup,
          NetworkPivotPoint,
          DockerImage,
          DockerCredential,
          TestDeployment,
          ImageVariant,
          Tool,
          CreatorPreferences,
          Job,
          DeploymentEnvironment,
          ScenarioVersionAdminTest,
          // AdminTestValidation removed
          ScenarioVersionTestRun,
        ],
        synchronize: false, // Disabled - use migrations instead
        logging: false,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100, // Increased limit
      },
    ]),
    TypeOrmModule.forFeature([
      User,
      SystemSettings,
      Scenario,
      ScenarioVersion,
      Asset,
      AssetScenarioVersion,
      Event,
      Notification,
      CareerPath,
      CareerPathItem,
      Playlist,
      PlaylistItem,
      Team,
      TeamMember,
      TeamJoinRequest,
      Badge,
      UserBadge,
      BadgeRequirement,
      AuditLog,
      EnvironmentSession,
      UsageDaily,
      SystemSetting,
      ScenarioLimit,
      EnvironmentMachine,
      UserFavorite,
      ScenarioRating,
      EventParticipation,
      EventSession,
      EventRegistration,
      EventScenario,
      InterfaceEndpoint,
      PlatformImage,
      RegistryCredential,
      Machine,
      ScenarioAsset,
      SessionNetworkTopology,
      SessionSecurityGroup,
      NetworkPivotPoint,
      DockerImage,
      DockerCredential,
      TestDeployment,
      ImageVariant,
      Tool,
      CreatorPreferences,
      Job,
      DeploymentEnvironment,
      ScenarioVersionAdminTest,
      // AdminTestValidation removed
      ScenarioVersionTestRun,
      MachineSecurityGroup,
    ]),
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '7d' }, // Extended to 7 days for better user experience
      }),
      inject: [ConfigService],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CreatorModule,
  ],
  controllers: [
    AuthController,
    SolverController,
    AdminController,
    CreatorController,
    AccountController,
    AssetsController,
    PlaylistController,
    TeamsController,
    NotificationsController,
    CareerPathController,
    EventsController,
    HealthController,
    SettingsController,
    AdminBadgeController,
    BadgeController,
    DockerImageController,
    UploadController,
    FavoritesController,
    RatingsController,
    CreatorTestingController,
    ImagePipelineController,
    AdminDeploymentsController,
    BudgetMonitorController,
    OrphanedTaskController,
    AwsConfigController,
    MultiOsGuiController,
    TestDeploymentController,
    SessionConnectionController,
    ProxyController,
  ],
  providers: [
    AppService,
    AuthService,
    UsersService,
    ScenariosService,
    SystemSettingsService,
    EventsService,
    NotificationsService,
    CareerPathService,
    PlaylistService,
    TeamsService,
    EnvironmentService,
    LimitService,
    AwsIntegrationService,
    SessionLimitService,
    AssetStorageService,
    BadgesService,
    BadgesJob,
    AuditService,
    SessionsService,
    CostService,
    RegistryService,
    DockerImageService,
    MinioService,
    FileOrganizationService,
    DockerImagesService,
    ImagePullService,
    DockerComposeGeneratorService,
    SessionStateMachineService,
    SessionTimeoutService,
    EventCleanupService,
    SessionSecurityService,
    EventParticipationService,
    BudgetEventBridgeService,
    MultiOsGuiService,
    OrphanedTaskMonitorService,
    AwsConfigSyncService,
    AlertService,
    BudgetMonitorService,
    CreatorTestingService,
    ScenarioWorkflowService,
    CreatorEnvironmentService,
    ImagePipelineService,
    JobQueueService,
    SubmissionValidationService,
    ImageScanService,
    ECRPromotionService,
    JobWorkerService,
    TestDeploymentService,
    TestDeploymentGateway,
    VpcEndpointService,
    GatewayProxyService,
    SessionConnectionService,
    SessionSecurityGroupService,
    SshGatewayService,
    SshGateway,
    DockerComposeSyncService,
    DockerComposeSyncServicePhase23,
    ScenarioApprovalService,
    BuildOrchestrationService,
    // AdminTestService removed
    AdminTestEnvironmentService,
    BundleService,
    AwsDeployService,
    SecurityGroupManagerService,
    PerMachineSecurityGroupService,
    AwsHealthCheckService,
    JwtStrategy,
    RolesGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PrivateNetworkMiddleware, RequestIdMiddleware, RequestLoggerMiddleware)
      .forRoutes('*');
  }
}
