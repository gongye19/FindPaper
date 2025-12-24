"""
测试配额功能
"""
import sys
import os
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import Request
from unittest.mock import Mock
# 注意：服务导入在 main() 函数中进行，以便先加载环境变量

def test_supabase_service():
    """测试 Supabase 服务初始化"""
    print("=" * 60)
    print("测试 Supabase 服务")
    print("=" * 60)
    
    # 重新获取服务实例
    from services.supabase_service import get_supabase_service
    service = get_supabase_service()
    
    if not service.is_available():
        print("❌ Supabase 服务不可用")
        print("   请检查环境变量配置：")
        print("   - SUPABASE_URL 或 PROJECT_URL")
        print("   - SUPABASE_SECRET_KEY 或 SERVICE_ROLE_KEY")
        return False
    
    print("✅ Supabase 服务初始化成功")
    return True

def test_anon_quota():
    """测试游客配额"""
    print("\n" + "=" * 60)
    print("测试游客配额")
    print("=" * 60)
    
    from services.supabase_service import get_supabase_service
    service = get_supabase_service()
    
    if not service.is_available():
        print("❌ Supabase 服务不可用，跳过测试")
        return False
    
    # 测试一个假的 anon_id
    test_anon_id = "00000000-0000-0000-0000-000000000001"
    
    print(f"测试 anon_id: {test_anon_id}")
    
    # 测试扣减配额
    remaining = service.consume_anon_quota(test_anon_id)
    
    if remaining == -1:
        print(f"❌ 配额已用完或扣减失败")
    else:
        print(f"✅ 配额扣减成功，剩余: {remaining}")
    
    return remaining != -1

def test_quota_guard():
    """测试配额检查中间件"""
    print("\n" + "=" * 60)
    print("测试配额检查中间件")
    print("=" * 60)
    
    from middleware.quota_guard import get_quota_guard
    quota_guard = get_quota_guard()
    
    # 模拟游客请求
    mock_request = Mock(spec=Request)
    mock_request.headers = {
        "X-Anon-Id": "00000000-0000-0000-0000-000000000002"
    }
    
    print("测试游客请求...")
    passed, user_type, remaining = quota_guard.check_quota(mock_request)
    
    if passed:
        print(f"✅ 配额检查通过: user_type={user_type}, remaining={remaining}")
    else:
        print(f"❌ 配额检查失败: user_type={user_type}, remaining={remaining}")
    
    return passed

def main():
    """主测试函数"""
    print("\n" + "=" * 60)
    print("Supabase 配额功能测试")
    print("=" * 60)
    
    # 先加载环境变量（在导入服务之前）
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env.dev"
    if env_path.exists():
        load_dotenv(env_path, override=True)
        print(f"已加载环境变量: {env_path}")
    else:
        env_path = Path(__file__).parent.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path, override=True)
            print(f"已加载环境变量: {env_path}")
        else:
            print(f"环境变量文件不存在")
    
    # 重新导入服务以获取更新后的环境变量
    import importlib
    import services.supabase_service
    importlib.reload(services.supabase_service)
    from services.supabase_service import get_supabase_service
    from middleware.quota_guard import get_quota_guard
    
    results = []
    
    # 测试 Supabase 服务
    results.append(("Supabase 服务初始化", test_supabase_service()))
    
    # 测试游客配额
    results.append(("游客配额", test_anon_quota()))
    
    # 测试配额检查中间件
    results.append(("配额检查中间件", test_quota_guard()))
    
    # 总结
    print("\n" + "=" * 60)
    print("测试结果总结")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{name}: {status}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n🎉 所有测试通过！")
    else:
        print("\n⚠️  部分测试失败，请检查配置和日志")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

