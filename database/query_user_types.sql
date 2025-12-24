-- ============================================
-- 查询三类用户 ID（带类型标识、邮箱和使用次数）
-- ============================================

-- 1. 注册了并订阅的用户（plan='pro'）
SELECT 
    'Pro 用户' as user_type, 
    p.user_id as id,
    u.email,
    COALESCE(uu.used_count, 0) as used_count
FROM profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
LEFT JOIN user_usage uu ON p.user_id = uu.user_id
WHERE p.plan = 'pro'

UNION ALL

-- 2. 注册了没订阅的用户（plan='free'）
SELECT 
    'Free 用户' as user_type, 
    p.user_id as id,
    u.email,
    COALESCE(uu.used_count, 0) as used_count
FROM profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
LEFT JOIN user_usage uu ON p.user_id = uu.user_id
WHERE p.plan = 'free'

UNION ALL

-- 3. 匿名没注册的用户
SELECT 
    '匿名用户' as user_type, 
    anon_id as id,
    NULL as email,
    COALESCE(used_count, 0) as used_count
FROM anon_usage;

