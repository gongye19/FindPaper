-- ============================================
-- Supabase 数据库设置脚本
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================

-- ============================================
-- 1. 创建 profiles 表（存储用户计划）
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 当新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, plan)
    VALUES (NEW.id, 'free');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. 创建 user_usage 表（登录用户使用计数）
-- ============================================
CREATE TABLE IF NOT EXISTS user_usage (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_usage_used_count ON user_usage(used_count);

-- 自动更新 updated_at
CREATE TRIGGER update_user_usage_updated_at
    BEFORE UPDATE ON user_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. 创建 anon_usage 表（游客使用计数）
-- ============================================
CREATE TABLE IF NOT EXISTS anon_usage (
    anon_id UUID PRIMARY KEY,
    used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anon_usage_used_count ON anon_usage(used_count);

-- 自动更新 updated_at
CREATE TRIGGER update_anon_usage_updated_at
    BEFORE UPDATE ON anon_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. RPC 函数：原子扣减登录用户配额
-- ============================================
CREATE OR REPLACE FUNCTION consume_user_quota(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan TEXT;
    v_used_count INTEGER;
    v_remaining INTEGER;
BEGIN
    -- 检查用户计划
    SELECT plan INTO v_plan
    FROM profiles
    WHERE user_id = p_user_id;
    
    -- 如果用户不存在，创建默认 profile
    IF v_plan IS NULL THEN
        INSERT INTO profiles (user_id, plan)
        VALUES (p_user_id, 'free')
        ON CONFLICT (user_id) DO NOTHING;
        v_plan := 'free';
    END IF;
    
    -- pro 用户无限配额
    IF v_plan = 'pro' THEN
        RETURN 999999;  -- 返回一个很大的数字表示无限
    END IF;
    
    -- free 用户：检查并扣减配额
    -- 确保 user_usage 记录存在
    INSERT INTO user_usage (user_id, used_count)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- 原子更新：检查配额并扣减
    UPDATE user_usage
    SET used_count = used_count + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND used_count < 50  -- free 用户限制 50 次
    RETURNING used_count INTO v_used_count;
    
    -- 如果更新失败（配额已用完），返回 -1
    IF v_used_count IS NULL THEN
        -- 获取当前使用次数
        SELECT used_count INTO v_used_count
        FROM user_usage
        WHERE user_id = p_user_id;
        
        IF v_used_count IS NULL THEN
            RETURN -1;
        END IF;
        
        -- 如果已用完，返回 -1
        IF v_used_count >= 50 THEN
            RETURN -1;
        END IF;
    END IF;
    
    -- 计算剩余次数
    v_remaining := 50 - v_used_count;
    RETURN v_remaining;
END;
$$;

-- ============================================
-- 5. RPC 函数：原子扣减游客配额
-- ============================================
CREATE OR REPLACE FUNCTION consume_anon_quota(p_anon_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_used_count INTEGER;
    v_remaining INTEGER;
BEGIN
    -- 确保记录存在
    INSERT INTO anon_usage (anon_id, used_count)
    VALUES (p_anon_id, 0)
    ON CONFLICT (anon_id) DO NOTHING;
    
    -- 原子更新：检查配额并扣减
    UPDATE anon_usage
    SET used_count = used_count + 1,
        updated_at = NOW()
    WHERE anon_id = p_anon_id
      AND used_count < 3  -- 游客限制 3 次
    RETURNING used_count INTO v_used_count;
    
    -- 如果更新失败（配额已用完），返回 -1
    IF v_used_count IS NULL THEN
        -- 获取当前使用次数
        SELECT used_count INTO v_used_count
        FROM anon_usage
        WHERE anon_id = p_anon_id;
        
        IF v_used_count IS NULL THEN
            RETURN -1;
        END IF;
        
        -- 如果已用完，返回 -1
        IF v_used_count >= 3 THEN
            RETURN -1;
        END IF;
    END IF;
    
    -- 计算剩余次数
    v_remaining := 3 - v_used_count;
    RETURN v_remaining;
END;
$$;

-- ============================================
-- 6. 设置 Row Level Security (RLS)
-- ============================================

-- profiles 表：用户只能读自己的记录
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- user_usage 表：用户只能读自己的记录
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
    ON user_usage FOR SELECT
    USING (auth.uid() = user_id);

-- anon_usage 表：不需要 RLS（后端用 service_role 访问）
ALTER TABLE anon_usage ENABLE ROW LEVEL SECURITY;

-- 允许 service_role 完全访问（后端使用）
CREATE POLICY "Service role can manage anon_usage"
    ON anon_usage FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 7. 辅助函数：获取用户配额信息（可选）
-- ============================================
CREATE OR REPLACE FUNCTION get_user_quota_info(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan TEXT;
    v_used_count INTEGER;
    v_limit INTEGER;
    v_remaining INTEGER;
    v_result JSON;
BEGIN
    -- 获取用户计划
    SELECT plan INTO v_plan
    FROM profiles
    WHERE user_id = p_user_id;
    
    IF v_plan IS NULL THEN
        v_plan := 'free';
    END IF;
    
    -- 获取使用次数
    SELECT COALESCE(used_count, 0) INTO v_used_count
    FROM user_usage
    WHERE user_id = p_user_id;
    
    IF v_used_count IS NULL THEN
        v_used_count := 0;
    END IF;
    
    -- 计算限制和剩余
    IF v_plan = 'pro' THEN
        v_limit := 999999;
        v_remaining := 999999;
    ELSE
        v_limit := 50;
        v_remaining := GREATEST(0, 50 - v_used_count);
    END IF;
    
    v_result := json_build_object(
        'plan', v_plan,
        'used_count', v_used_count,
        'limit', v_limit,
        'remaining', v_remaining
    );
    
    RETURN v_result;
END;
$$;

-- ============================================
-- 完成
-- ============================================
-- 执行完成后，可以在 Supabase Dashboard 中验证：
-- 1. Tables: profiles, user_usage, anon_usage
-- 2. Functions: consume_user_quota, consume_anon_quota, get_user_quota_info
-- 3. Policies: 检查 RLS 策略是否正确设置

