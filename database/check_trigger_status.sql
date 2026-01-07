-- ============================================
-- 检查触发器状态和可能的问题
-- ============================================

-- 1. 检查触发器是否存在
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing,
    action_orientation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
   OR event_object_table = 'users';

-- 2. 检查触发器函数是否存在
SELECT 
    routine_name,
    routine_type,
    routine_definition,
    security_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
  AND routine_schema = 'public';

-- 3. 检查 profiles 表的权限设置
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_name = 'profiles'
  AND table_schema = 'public';

-- 4. 检查 auth.users 表的权限（需要 admin 权限）
-- 注意：这个查询可能需要特殊权限
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_name = 'users'
  AND table_schema = 'auth';

-- 5. 测试触发器函数（手动调用，模拟新用户创建）
-- 注意：这只是一个测试，不会真正创建用户
-- 你需要替换 '00000000-0000-0000-0000-000000000000' 为一个真实的 UUID
/*
DO $$
DECLARE
    test_user_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- 尝试手动调用触发器函数
    -- 注意：这需要 NEW 记录，所以不能直接调用
    -- 但我们可以测试函数逻辑
    RAISE NOTICE '触发器函数存在，但需要 NEW 记录才能测试';
END $$;
*/

-- 6. 检查最近的用户创建记录和对应的 profile
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as user_created_at,
    p.user_id as profile_user_id,
    p.created_at as profile_created_at,
    CASE 
        WHEN p.user_id IS NULL THEN '❌ 触发器未执行'
        WHEN p.created_at > u.created_at + INTERVAL '1 second' THEN '⚠️ 延迟创建'
        ELSE '✅ 正常'
    END as status,
    EXTRACT(EPOCH FROM (COALESCE(p.created_at, NOW()) - u.created_at)) as delay_seconds
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
ORDER BY u.created_at DESC
LIMIT 10;

-- 7. 检查 Supabase 的配置（可能需要通过 Dashboard 查看）
-- 在 Supabase Dashboard → Settings → Auth → Email Auth
-- 检查：
-- - "Enable email confirmations" 是否启用
-- - "Enable sign ups" 是否启用
-- - "Secure email change" 是否启用

