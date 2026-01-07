-- ============================================
-- 查询所有用户信息（同时查询 auth.users 和 profiles 两个表）
-- ============================================

SELECT * FROM (
-- 1. 注册了并订阅的用户（plan='pro'）
SELECT 
    'Pro 用户' as user_type, 
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    u.email_confirmed_at,
    p.user_id as has_profile,
    p.plan,
    p.created_at as profile_created_at,
    COALESCE(uu.used_count, 0) as used_count,
    CASE 
        WHEN p.user_id IS NULL THEN '❌ 缺少 profile'
        ELSE '✅ 正常'
    END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN user_usage uu ON u.id = uu.user_id
WHERE p.plan = 'pro'

UNION ALL

-- 2. 注册了没订阅的用户（plan='free'）
SELECT 
    'Free 用户' as user_type, 
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    u.email_confirmed_at,
    p.user_id as has_profile,
    p.plan,
    p.created_at as profile_created_at,
    COALESCE(uu.used_count, 0) as used_count,
    CASE 
        WHEN p.user_id IS NULL THEN '❌ 缺少 profile'
        ELSE '✅ 正常'
    END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN user_usage uu ON u.id = uu.user_id
WHERE p.plan = 'free'

UNION ALL

-- 3. 在 auth.users 中存在但没有 profile 的用户（异常情况）
SELECT 
    '⚠️ 缺少 Profile' as user_type, 
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    u.email_confirmed_at,
    NULL as has_profile,
    NULL as plan,
    NULL as profile_created_at,
    COALESCE(uu.used_count, 0) as used_count,
    '❌ 缺少 profile（需要修复）' as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN user_usage uu ON u.id = uu.user_id
WHERE p.user_id IS NULL

UNION ALL

-- 4. 匿名没注册的用户
SELECT 
    '匿名用户' as user_type, 
    anon_id as user_id,
    NULL as email,
    created_at as user_created_at,
    NULL as email_confirmed_at,
    NULL as has_profile,
    NULL as plan,
    NULL as profile_created_at,
    COALESCE(used_count, 0) as used_count,
    '✅ 正常' as status
FROM anon_usage
) AS all_users

ORDER BY 
    CASE user_type
        WHEN 'Pro 用户' THEN 1
        WHEN 'Free 用户' THEN 2
        WHEN '⚠️ 缺少 Profile' THEN 3
        WHEN '匿名用户' THEN 4
    END,
    user_created_at DESC;

