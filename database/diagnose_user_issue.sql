-- ============================================
-- 诊断用户注册问题：检查 auth.users 和 profiles 表的一致性
-- ============================================

-- 1. 检查 auth.users 表中的所有用户（包括邮箱）
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. 检查哪些用户在 auth.users 中存在，但在 profiles 中不存在
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as auth_created_at,
    p.user_id as profile_user_id,
    CASE 
        WHEN p.user_id IS NULL THEN '❌ 缺少 profile 记录'
        ELSE '✅ 有 profile 记录'
    END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
ORDER BY u.created_at DESC;

-- 3. 修复：为缺少 profile 的用户自动创建记录
-- 注意：执行前请先备份数据！
INSERT INTO profiles (user_id, plan)
SELECT 
    u.id,
    'free'  -- 默认设置为 free 计划
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL  -- 只插入没有 profile 的用户
ON CONFLICT (user_id) DO NOTHING;  -- 如果已存在则忽略

-- 4. 验证修复结果：再次检查一致性
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as auth_created_at,
    p.user_id as profile_user_id,
    p.plan,
    CASE 
        WHEN p.user_id IS NULL THEN '❌ 仍然缺少 profile'
        ELSE '✅ 已修复'
    END as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
ORDER BY u.created_at DESC;

-- 5. 检查触发器是否存在且启用
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 6. 如果触发器不存在，重新创建（参考 supabase_setup.sql）
-- 注意：如果触发器已存在，执行下面的语句会报错，这是正常的
-- 如果触发器不存在，执行下面的语句来创建：

/*
-- 重新创建触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, plan)
    VALUES (NEW.id, 'free')
    ON CONFLICT (user_id) DO NOTHING;  -- 防止重复插入
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建新触发器
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
*/

