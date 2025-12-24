"""
配额检查中间件：在搜索请求前检查用户配额
"""
import logging
from typing import Optional, Tuple, Dict
from fastapi import Request, HTTPException, status
from services.supabase_service import get_supabase_service

logger = logging.getLogger(__name__)


class QuotaGuard:
    """配额检查类"""
    
    def __init__(self):
        self.supabase_service = get_supabase_service()
    
    def check_quota(self, request: Request) -> Tuple[bool, Optional[str], Optional[int]]:
        """
        检查用户配额
        
        :param request: FastAPI 请求对象
        :return: (是否通过, 用户类型, 剩余次数)
                 用户类型: 'user' | 'anon' | None
                 剩余次数: int，-1 表示配额不足，999999 表示无限
        """
        # 1. 尝试从 Authorization header 获取登录用户 token
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]  # 去掉 "Bearer " 前缀
            
            if not self.supabase_service.is_available():
                logger.warning("Supabase 服务不可用，跳过配额检查（放行）")
                return True, "user", 999999
            
            # 验证 JWT token
            user_info = self.supabase_service.verify_jwt_token(token)
            if user_info and user_info.get("user_id"):
                user_id = user_info["user_id"]
                logger.info(f"检测到登录用户: {user_id}")
                
                # 扣减用户配额
                remaining = self.supabase_service.consume_user_quota(user_id)
                
                if remaining == -1:
                    # 配额不足
                    logger.warning(f"用户 {user_id} 配额已用完")
                    return False, "user", 0
                else:
                    logger.info(f"用户 {user_id} 配额检查通过，剩余: {remaining}")
                    return True, "user", remaining
            else:
                logger.warning("JWT token 验证失败，尝试作为游客处理")
                # token 无效，继续尝试作为游客处理
        
        # 2. 尝试从 X-Anon-Id header 获取游客 ID
        anon_id = request.headers.get("X-Anon-Id", "").strip()
        if anon_id:
            # 验证 UUID 格式（简单检查）
            if len(anon_id) == 36 and anon_id.count("-") == 4:
                logger.info(f"检测到游客: {anon_id}")
                
                if not self.supabase_service.is_available():
                    logger.warning("Supabase 服务不可用，跳过配额检查（放行）")
                    return True, "anon", 999999
                
                # 扣减游客配额
                remaining = self.supabase_service.consume_anon_quota(anon_id)
                
                if remaining == -1:
                    # 配额不足
                    logger.warning(f"游客 {anon_id} 配额已用完")
                    return False, "anon", 0
                else:
                    logger.info(f"游客 {anon_id} 配额检查通过，剩余: {remaining}")
                    return True, "anon", remaining
            else:
                logger.warning(f"游客 ID 格式无效: {anon_id}")
        
        # 3. 既没有登录也没有游客 ID
        logger.warning("请求缺少身份标识（Authorization 或 X-Anon-Id）")
        # 为了兼容性，暂时放行（但记录警告）
        # 生产环境可以考虑要求必须提供身份
        return True, None, 999999
    
    def get_quota_info(self, request: Request) -> Optional[Dict]:
        """
        获取用户配额信息（不扣减配额）
        
        :param request: FastAPI 请求对象
        :return: 配额信息字典，包含 user_type, remaining, limit, used_count
        """
        from typing import Dict
        
        # 1. 尝试从 Authorization header 获取登录用户 token
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            
            if not self.supabase_service.is_available():
                return None
            
            # 验证 JWT token
            user_info = self.supabase_service.verify_jwt_token(token)
            if user_info and user_info.get("user_id"):
                user_id = user_info["user_id"]
                # 获取用户配额信息（不扣减）
                quota_info = self.supabase_service.get_user_quota_info(user_id)
                if quota_info:
                    return {
                        "user_type": "user",
                        "remaining": quota_info.get("remaining", 0),
                        "limit": quota_info.get("limit", 50),
                        "used_count": quota_info.get("used_count", 0),
                        "plan": quota_info.get("plan", "free")
                    }
        
        # 2. 尝试从 X-Anon-Id header 获取游客 ID
        anon_id = request.headers.get("X-Anon-Id", "").strip()
        if anon_id and len(anon_id) == 36 and anon_id.count("-") == 4:
            if not self.supabase_service.is_available():
                return None
            
            # 获取匿名用户配额信息
            try:
                if not self.supabase_service.client:
                    return None
                result = self.supabase_service.client.table("anon_usage").select("used_count").eq("anon_id", anon_id).execute()
                used_count = 0
                if result.data and len(result.data) > 0:
                    used_count = result.data[0].get("used_count", 0)
                
                remaining = max(0, 3 - used_count)
                return {
                    "user_type": "anon",
                    "remaining": remaining,
                    "limit": 3,
                    "used_count": used_count,
                    "plan": None
                }
            except Exception as e:
                logger.error(f"获取匿名用户配额信息出错: {e}")
                return None
        
        return None
    
    def raise_quota_exceeded(self, user_type: str) -> None:
        """
        抛出配额超额异常
        
        :param user_type: 用户类型 ('user' | 'anon')
        """
        if user_type == "user":
            message = "配额已用完。登录用户免费50次，订阅后无限。"
        elif user_type == "anon":
            message = "配额已用完。游客可用3次，登录后50次，订阅无限。"
        else:
            message = "配额已用完。"
        
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "QUOTA_EXCEEDED",
                "message": message,
                "remaining": 0
            }
        )


# 全局单例
_quota_guard = None

def get_quota_guard() -> QuotaGuard:
    """获取配额检查器单例"""
    global _quota_guard
    if _quota_guard is None:
        _quota_guard = QuotaGuard()
    return _quota_guard

