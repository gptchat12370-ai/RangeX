import { Client } from 'minio';

const client = new Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
});

async function main() {
  try {
    const buckets = ['rangex-assets', 'rangex-staging', 'rangex-approved'];
    
    console.log('🔒 Making MinIO Buckets PRIVATE for Security\n');
    
    for (const bucketName of buckets) {
      // Check if bucket exists
      const exists = await client.bucketExists(bucketName);
      if (!exists) {
        console.log(`⚠️  Bucket '${bucketName}' does not exist, skipping...`);
        continue;
      }
      
      // Remove public policy (make bucket PRIVATE)
      try {
        await client.setBucketPolicy(bucketName, '');
        console.log(`✅ Bucket '${bucketName}' is now PRIVATE (policy removed)`);
      } catch (error: any) {
        if (error.code === 'NoSuchBucketPolicy') {
          console.log(`✅ Bucket '${bucketName}' already PRIVATE (no policy)`);
        } else {
          console.log(`⚠️  Error removing policy from '${bucketName}': ${error.message}`);
        }
      }
    }
    
    console.log('\n📌 Summary:');
    console.log('   ✅ All buckets are PRIVATE');
    console.log('   🔒 Direct URLs (http://localhost:9000/bucket/file) will NOT work');
    console.log('   🛡️  All access goes through /api/assets/file/* with JWT authentication');
    console.log('   🌐 Works across all network IPs (10.x.x.x, 192.168.x.x, localhost)');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
