from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# RFC 7807 Problem Details Model
class ProblemDetails(BaseModel):
    type: str = Field(default="about:blank", description="URI reference identifying the problem type")
    title: str = Field(description="Short, human-readable summary of the problem")
    status: int = Field(description="HTTP status code")
    detail: str = Field(description="Human-readable explanation specific to this occurrence")
    instance: Optional[str] = Field(default=None, description="URI reference identifying the specific occurrence")
    invalid_params: Optional[List[Dict[str, Any]]] = Field(default=None, description="Validation errors if applicable")

    model_config = ConfigDict(extra="allow")


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=100)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    username: str
    is_active: bool
    is_superuser: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 86400
    accessToken: Optional[str] = None


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None


class LoginRequest(BaseModel):
    username_or_email: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    password: str

    @property
    def identifier(self) -> str:
        return self.username_or_email or self.email or self.username or ""


# Item Schemas
class ItemBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None


class ItemCreate(ItemBase):
    pass


class ItemResponse(ItemBase):
    id: str
    owner_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# AI Request Schemas
class AiGenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, description="Prompt for the AI model")
    system_instruction: Optional[str] = Field(
        default="You are an expert AI hackathon assistant. Provide concise, high-impact responses.",
        description="Optional system instruction",
    )


class AiGenerateResponse(BaseModel):
    prompt: str
    response: str
    model: str = "mock-or-gemini"

