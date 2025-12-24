-- ============================================
-- 重置配额 SQL 脚本
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================

-- ============================================
-- 方法1: 重置所有游客配额
-- ============================================
UPDATE anon_usage SET used_count = 0;

-- ============================================
-- 方法2: 重置所有用户配额
-- ============================================
UPDATE user_usage SET used_count = 0;

-- ============================================
-- 方法3: 重置特定游客配额（替换 YOUR_ANON_ID）
-- ============================================
-- UPDATE anon_usage 
-- SET used_count = 0 
-- WHERE anon_id = 'YOUR_ANON_ID'::uuid;

-- ============================================
-- 方法4: 重置特定用户配额（替换 YOUR_USER_ID）
-- ============================================
-- UPDATE user_usage 
-- SET used_count = 0 
-- WHERE user_id = 'YOUR_USER_ID'::uuid;

-- ============================================
-- 方法5: 查看当前配额使用情况
-- ============================================

-- 查看所有游客使用情况
SELECT anon_id, used_count, created_at, updated_at 
FROM anon_usage 
ORDER BY updated_at DESC 
LIMIT 20;

-- 查看所有用户使用情况
SELECT 
    u.user_id,
    u.used_count,
    p.plan,
    u.updated_at
FROM user_usage u
LEFT JOIN profiles p ON u.user_id = p.user_id
ORDER BY u.updated_at DESC
LIMIT 20;

-- ============================================
-- 方法6: 删除所有测试数据（谨慎使用！）
-- ============================================
-- DELETE FROM anon_usage;
-- DELETE FROM user_usage;

