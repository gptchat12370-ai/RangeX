-- Check for scenario versions with cover images that might not exist
SELECT 
    sv.id,
    sv.title,
    sv.coverImageUrl,
    sv.status,
    sv.createdAt
FROM scenario_version sv
WHERE sv.coverImageUrl IS NOT NULL
ORDER BY sv.createdAt DESC
LIMIT 50;

-- Check for assets that might be missing
SELECT 
    a.id,
    a.name,
    a.storageKey,
    a.type,
    a.sizeBytes,
    a.createdAt,
    a.createdByUserId
FROM asset a
ORDER BY a.createdAt DESC
LIMIT 50;

-- Check scenario_asset for file references
SELECT 
    sa.id,
    sa.fileName,
    sa.fileUrl,
    sa.minioPath,
    sa.assetLocation,
    sa.uploadedAt,
    sv.title as scenario_title
FROM scenario_asset sa
LEFT JOIN scenario_version sv ON sa.scenarioVersionId = sv.id
WHERE sa.minioPath IS NOT NULL
ORDER BY sa.uploadedAt DESC
LIMIT 50;

-- Find the specific problematic file
SELECT 
    'scenario_version' as source_table,
    sv.id,
    sv.title,
    sv.coverImageUrl as file_path,
    sv.createdAt
FROM scenario_version sv
WHERE sv.coverImageUrl LIKE '%1767593586349-2afe3fb8-0c35-4369-bf9b-ce58f11375d8%'

UNION ALL

SELECT 
    'asset' as source_table,
    a.id,
    a.name,
    a.storageKey as file_path,
    a.createdAt
FROM asset a
WHERE a.storageKey LIKE '%1767593586349-2afe3fb8-0c35-4369-bf9b-ce58f11375d8%'

UNION ALL

SELECT 
    'scenario_asset' as source_table,
    sa.id,
    sa.fileName,
    COALESCE(sa.minioPath, sa.fileUrl) as file_path,
    sa.uploadedAt as createdAt
FROM scenario_asset sa
WHERE sa.minioPath LIKE '%1767593586349-2afe3fb8-0c35-4369-bf9b-ce58f11375d8%'
   OR sa.fileUrl LIKE '%1767593586349-2afe3fb8-0c35-4369-bf9b-ce58f11375d8%';
