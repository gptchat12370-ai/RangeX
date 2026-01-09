import * as Minio from 'minio';

/**
 * Verify MinIO security configuration
 * - Buckets should be PRIVATE (no public read access)
 * - All file access must go through /api/assets/file/* proxy
 * - This ensures authentication and works across network IPs
 */
async function verifyMinioSecurity() {
  const client = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  });

  const buckets = ['rangex-assets', 'rangex-staging', 'rangex-approved'];

  console.log('🔒 MinIO Security Verification\n');
  console.log(`Endpoint: ${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`);
  console.log(`SSL: ${process.env.MINIO_USE_SSL === 'true' ? 'Enabled' : 'Disabled'}\n`);

  for (const bucket of buckets) {
    try {
      const exists = await client.bucketExists(bucket);
      
      if (!exists) {
        console.log(`⚠️  Bucket "${bucket}" does not exist`);
        console.log(`   Creating bucket...`);
        await client.makeBucket(bucket, '');
        console.log(`   ✅ Created bucket "${bucket}"`);
      } else {
        console.log(`✅ Bucket "${bucket}" exists`);
      }

      // Check bucket policy
      try {
        const policy = await client.getBucketPolicy(bucket);
        if (policy) {
          console.log(`   ⚠️  WARNING: Bucket "${bucket}" has a public policy!`);
          console.log(`   📋 Policy:`);
          console.log(JSON.stringify(JSON.parse(policy), null, 2));
          console.log(`   🔧 Recommendation: Remove public policy for security`);
        } else {
          console.log(`   🔒 Bucket "${bucket}" is PRIVATE (no public policy) ✅`);
        }
      } catch (policyError: any) {
        if (policyError.code === 'NoSuchBucketPolicy') {
          console.log(`   🔒 Bucket "${bucket}" is PRIVATE (no policy set) ✅`);
        } else {
          console.log(`   ⚠️  Could not check policy: ${policyError.message}`);
        }
      }

      // List some objects as a connectivity test
      const stream = client.listObjectsV2(bucket, '', false, '');
      let count = 0;
      for await (const obj of stream) {
        count++;
        if (count === 1) {
          console.log(`   📦 Sample object: ${obj.name}`);
        }
      }
      if (count === 0) {
        console.log(`   📦 Bucket is empty`);
      } else if (count > 1) {
        console.log(`   📦 Total objects: ${count}`);
      }

    } catch (error: any) {
      console.log(`❌ Error checking bucket "${bucket}": ${error.message}`);
    }
    console.log('');
  }

  console.log('✅ Security Check Complete\n');
  console.log('📌 Summary:');
  console.log('   - All buckets should be PRIVATE (no public read access)');
  console.log('   - File access controlled through /api/assets/file/* endpoint');
  console.log('   - Authentication enforced by backend (JWT tokens)');
  console.log('   - Works across all network IPs (localhost, 10.x.x.x, 192.168.x.x, etc.)');
}

verifyMinioSecurity()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
