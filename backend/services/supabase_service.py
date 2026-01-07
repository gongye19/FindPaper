"""
Supabase 服务：提供 Supabase 客户端和 JWT 验证
"""
import os
import logging
from typing import Optional, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

try:
    from supabase import create_client, Client
    from jose import jwt, JWTError
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.warning("supabase 或 python-jose 库未安装，配额功能将不可用")

# 加载环境变量
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("PROJECT_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SERVICE_ROLE_KEY")


class SupabaseService:
    """Supabase 服务类"""
    
    def __init__(self):
        """初始化 Supabase 服务"""
        if not SUPABASE_AVAILABLE:
            self.client = None
            logger.warning("Supabase 库未安装，配额功能将不可用")
            return
        
        if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
            logger.warning("Supabase 配置缺失，配额功能将不可用")
            self.client = None
            return
        
        try:
            self.client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
            logger.info(f"Supabase 服务初始化成功: {SUPABASE_URL}")
        except Exception as e:
            logger.error(f"Supabase 服务初始化失败: {e}")
            self.client = None
    
    def is_available(self) -> bool:
        """检查 Supabase 服务是否可用"""
        return self.client is not None
    
    def verify_jwt_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        验证 JWT token 并返回用户信息
        
        :param token: JWT token
        :return: 用户信息字典，包含 user_id，如果验证失败返回 None
        """
        if not self.client:
            logger.warning("Supabase 服务不可用，无法验证 token")
            return None
        
        try:
            # 使用 Supabase 客户端验证 token
            # 注意：Supabase Python 客户端的 get_user 方法需要传入 token
            # 但这个方法可能不存在，我们需要使用另一种方式
            
            # 方法：直接解码 JWT token（使用 jose 库）
            # 注意：Supabase 的 JWT secret 可以从环境变量或 API 获取
            # 但为了简化，我们直接使用 Supabase 的 REST API 验证
            
            # 使用 Supabase REST API 验证 token
            import requests
            verify_url = f"{SUPABASE_URL}/auth/v1/user"
            headers = {
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_SECRET_KEY
            }
            
            resp = requests.get(verify_url, headers=headers, timeout=5)
            
            if resp.status_code == 200:
                user_data = resp.json()
                user_id = user_data.get("id")
                if user_id:
                    logger.info(f"JWT token 验证成功: user_id={user_id}")
                    return {
                        "user_id": user_id,
                        "email": user_data.get("email")
                    }
            
            logger.warning(f"JWT token 验证失败: HTTP {resp.status_code}")
            return None
                
        except Exception as e:
            logger.error(f"JWT token 验证出错: {e}")
            return None
    
    def consume_user_quota(self, user_id: str) -> int:
        """
        扣减登录用户配额（原子操作）
        
        :param user_id: 用户 ID
        :return: 剩余次数，如果配额不足返回 -1，pro 用户返回 999999
        """
        if not self.client:
            logger.warning("Supabase 服务不可用，跳过配额检查")
            return 999999  # 服务不可用时放行
        
        try:
            result = self.client.rpc("consume_user_quota", {"p_user_id": user_id}).execute()
            
            if result.data is not None:
                remaining = int(result.data)
                logger.info(f"用户 {user_id} 配额扣减成功，剩余: {remaining}")
                return remaining
            else:
                logger.warning(f"用户 {user_id} 配额扣减失败：返回数据为空")
                return -1
                
        except Exception as e:
            logger.error(f"扣减用户配额出错: {e}")
            return -1
    
    def consume_anon_quota(self, anon_id: str) -> int:
        """
        扣减游客配额（原子操作）
        
        :param anon_id: 游客 ID (UUID)
        :return: 剩余次数，如果配额不足返回 -1
        """
        if not self.client:
            logger.warning("Supabase 服务不可用，跳过配额检查")
            return 999999  # 服务不可用时放行
        
        try:
            result = self.client.rpc("consume_anon_quota", {"p_anon_id": anon_id}).execute()
            
            if result.data is not None:
                remaining = int(result.data)
                logger.info(f"游客 {anon_id} 配额扣减成功，剩余: {remaining}")
                return remaining
            else:
                logger.warning(f"游客 {anon_id} 配额扣减失败：返回数据为空")
                return -1
                
        except Exception as e:
            logger.error(f"扣减游客配额出错: {e}")
            return -1
    
    def get_user_quota_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        获取用户配额信息
        
        :param user_id: 用户 ID
        :return: 配额信息字典，包含 plan, used_count, limit, remaining
        """
        if not self.client:
            return None
        
        try:
            result = self.client.rpc("get_user_quota_info", {"p_user_id": user_id}).execute()
            
            if result.data:
                return result.data
            else:
                return None
                
        except Exception as e:
            logger.error(f"获取用户配额信息出错: {e}")
            return None
    
    def check_user_exists(self, email: str) -> bool:
        """
        检查用户是否存在（通过邮箱）
        使用 Supabase Admin API 查询 auth.users 表
        
        :param email: 用户邮箱
        :return: True 表示用户存在，False 表示不存在
        """
        if not self.client:
            logger.warning("Supabase 服务不可用，无法检查用户是否存在")
            return False
        
        if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
            logger.error("Supabase 配置缺失：SUPABASE_URL 或 SUPABASE_SECRET_KEY 未设置")
            return False
        
        try:
            import requests
            # Supabase Admin API: 通过邮箱查询用户
            # 注意：Admin API 需要使用正确的端点
            admin_url = f"{SUPABASE_URL}/auth/v1/admin/users"
            headers = {
                "apikey": SUPABASE_SECRET_KEY,
                "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
                "Content-Type": "application/json"
            }
            
            # Supabase Admin API 支持通过 email 查询参数过滤
            # 但可能需要先获取所有用户，然后过滤
            # 为了效率，我们先尝试直接查询，如果失败则获取所有用户
            logger.info(f"开始检查用户是否存在: email={email}")
            
            # 方法1：尝试直接通过 email 参数查询（某些版本的 Supabase 支持）
            resp = requests.get(
                admin_url, 
                headers=headers, 
                params={"email": email}, 
                timeout=10
            )
            
            logger.debug(f"Admin API 响应状态: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                logger.debug(f"Admin API 响应数据: {data}")
                
                # 处理不同的响应格式
                if isinstance(data, dict):
                    users = data.get("users", [])
                elif isinstance(data, list):
                    users = data
                else:
                    users = []
                
                # 检查是否有匹配的邮箱（不区分大小写）
                exists = any(
                    str(user.get("email", "")).lower() == email.lower() 
                    for user in users
                )
                logger.info(f"检查用户是否存在结果: email={email}, exists={exists}, 找到用户数={len(users)}")
                return exists
            else:
                # 如果直接查询失败，尝试获取所有用户然后过滤（效率较低，但更可靠）
                logger.warning(f"直接查询失败 (HTTP {resp.status_code})，尝试获取所有用户后过滤")
                resp_all = requests.get(admin_url, headers=headers, timeout=10)
                
                if resp_all.status_code == 200:
                    data_all = resp_all.json()
                    if isinstance(data_all, dict):
                        users_all = data_all.get("users", [])
                    elif isinstance(data_all, list):
                        users_all = data_all
                    else:
                        users_all = []
                    
                    # 过滤匹配的邮箱
                    exists = any(
                        str(user.get("email", "")).lower() == email.lower() 
                        for user in users_all
                    )
                    logger.info(f"检查用户是否存在结果（全量查询）: email={email}, exists={exists}")
                    return exists
                else:
                    logger.error(f"获取所有用户失败: HTTP {resp_all.status_code}, response: {resp_all.text[:200]}")
                    return False
                
        except requests.exceptions.Timeout:
            logger.error(f"检查用户是否存在超时: email={email}")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"检查用户是否存在网络错误: {e}")
            return False
        except Exception as e:
            logger.error(f"检查用户是否存在出错: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return False
    
    def ensure_user_profile(self, user_id: str) -> Dict[str, Any]:
        """
        确保用户的 profile 存在，如果不存在则创建
        
        :param user_id: 用户 ID (UUID)
        :return: 包含 created, success, message 的字典
        """
        if not self.client:
            logger.warning("Supabase 服务不可用，无法确保 profile 存在")
            return {
                "created": False,
                "success": False,
                "message": "Supabase 服务不可用"
            }
        
        try:
            # 先检查 profile 是否已存在
            result = self.client.table("profiles").select("user_id").eq("user_id", user_id).execute()
            
            if result.data and len(result.data) > 0:
                # profile 已存在
                logger.info(f"用户 {user_id} 的 profile 已存在")
                return {
                    "created": False,
                    "success": True,
                    "message": "Profile 已存在"
                }
            
            # profile 不存在，创建它
            logger.info(f"为用户 {user_id} 创建 profile")
            insert_result = self.client.table("profiles").insert({
                "user_id": user_id,
                "plan": "free"
            }).execute()
            
            if insert_result.data and len(insert_result.data) > 0:
                logger.info(f"成功为用户 {user_id} 创建 profile")
                return {
                    "created": True,
                    "success": True,
                    "message": "Profile 创建成功"
                }
            else:
                logger.warning(f"为用户 {user_id} 创建 profile 时未返回数据")
                return {
                    "created": False,
                    "success": False,
                    "message": "创建 profile 时未返回数据"
                }
                
        except Exception as e:
            logger.error(f"确保用户 profile 存在时出错: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return {
                "created": False,
                "success": False,
                "message": f"创建 profile 失败: {str(e)}"
            }
    


# 全局单例
_supabase_service = None

def get_supabase_service() -> SupabaseService:
    """获取 Supabase 服务单例"""
    global _supabase_service
    if _supabase_service is None:
        _supabase_service = SupabaseService()
    return _supabase_service

