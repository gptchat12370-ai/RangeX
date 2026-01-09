import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageVariant } from '../entities/image-variant.entity';
import { CreatorPreferences } from '../entities/creator-preferences.entity';
import { Machine } from '../entities/machine.entity';
import { ScenarioVersion } from '../entities/scenario-version.entity';
import { ImageVariantService } from '../services/image-variant.service';
import { CreatorEnvironmentService } from '../services/creator-environment.service';
import { CreatorPreferencesService } from '../services/creator-preferences.service';
import { MinioService } from '../services/minio.service';
import { DockerComposeSyncService } from '../services/docker-compose-sync.service';
import { DockerComposeSyncServicePhase23 } from '../services/docker-compose-sync-phase23.service';
import { CreatorEnvironmentController } from '../controllers/creator-environment.controller';
import { CreatorPreferencesController } from '../controllers/creator-preferences.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImageVariant,
      CreatorPreferences,
      Machine,
      ScenarioVersion,
    ]),
  ],
  providers: [
    ImageVariantService,
    CreatorEnvironmentService,
    CreatorPreferencesService,
    MinioService,
    DockerComposeSyncService,
    DockerComposeSyncServicePhase23,
  ],
  controllers: [
    CreatorEnvironmentController,
    CreatorPreferencesController,
  ],
  exports: [
    ImageVariantService,
    CreatorEnvironmentService,
    CreatorPreferencesService,
  ],
})
export class CreatorModule {}
