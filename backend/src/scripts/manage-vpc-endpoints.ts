#!/usr/bin/env node
/**
 * VPC Endpoint Management CLI
 * 
 * Usage:
 *   npm run endpoints:create   - Create all VPC endpoints
 *   npm run endpoints:delete   - Delete all VPC endpoints (save costs)
 *   npm run endpoints:list     - List all VPC endpoints
 *   npm run endpoints:tighten  - Tighten security group rules
 * 
 * Use this when:
 * - Starting the platform after a long shutdown (create endpoints)
 * - Shutting down the platform to save costs (delete endpoints)
 * - Checking endpoint status (list)
 * - Applying security best practices (tighten)
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { VpcEndpointService } from '../services/vpc-endpoint.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const vpcEndpointService = app.get(VpcEndpointService);

  const command = process.argv[2];

  try {
    switch (command) {
      case 'create':
        console.log('Creating VPC endpoints...');
        await vpcEndpointService.ensureEndpointsExist();
        console.log('✅ VPC endpoints created successfully');
        break;

      case 'delete':
        console.log('⚠️  WARNING: This will delete all RangeX VPC endpoints!');
        console.log('   Platform will not be able to pull ECR images until endpoints are recreated.');
        console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...');
        
        await new Promise((resolve) => setTimeout(resolve, 5000));
        
        await vpcEndpointService.deleteAllEndpoints();
        console.log('✅ VPC endpoints deleted successfully');
        console.log('💰 Cost savings: ~$0.01/hour per endpoint ($0.03/hour total)');
        break;

      case 'list':
        console.log('Listing VPC endpoints...');
        const endpoints = await vpcEndpointService.listEndpoints();
        
        if (endpoints.length === 0) {
          console.log('No VPC endpoints found in this VPC');
        } else {
          console.table(endpoints);
        }
        break;

      case 'tighten':
        console.log('This command is not yet implemented.');
        console.log('Please manually tighten security groups according to SECURITY_GROUP_GUIDE.md');
        break;

      default:
        console.log('Usage: npm run endpoints:<command>');
        console.log('');
        console.log('Commands:');
        console.log('  create   - Create all VPC endpoints');
        console.log('  delete   - Delete all VPC endpoints (save costs)');
        console.log('  list     - List all VPC endpoints');
        console.log('  tighten  - Tighten security group rules');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  await app.close();
  process.exit(0);
}

bootstrap();
