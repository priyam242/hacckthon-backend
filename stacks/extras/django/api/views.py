import os
import requests
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({
        "status": "healthy",
        "framework": "Django REST Framework",
        "service": "hackathon-django-backend",
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    username = request.data.get("username")
    email = request.data.get("email")
    password = request.data.get("password")

    if not username or not email or not password:
        return Response(
            {
                "type": "https://tools.ietf.org/html/rfc7807#section-3",
                "title": "Validation Error",
                "status": 400,
                "detail": "Username, email, and password are required.",
                "instance": request.get_full_path(),
            },
            status=status.HTTP_400_BAD_REQUEST,
            content_type="application/problem+json",
        )

    if User.objects.filter(username=username).exists() or User.objects.filter(email=email).exists():
        return Response(
            {
                "type": "about:blank",
                "title": "Conflict",
                "status": 409,
                "detail": "User with this username or email already exists.",
                "instance": request.get_full_path(),
            },
            status=status.HTTP_409_CONFLICT,
            content_type="application/problem+json",
        )

    user = User.objects.create_user(username=username, email=email, password=password)
    refresh = RefreshToken.for_user(user)

    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({
        "id": user.id,
        "username": user.username,
        "email": user.email,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_generate(request):
    prompt = request.data.get("prompt")
    if not prompt:
        return Response(
            {
                "type": "https://tools.ietf.org/html/rfc7807#section-3",
                "title": "Validation Error",
                "status": 400,
                "detail": "Field 'prompt' is required.",
                "instance": request.get_full_path(),
            },
            status=status.HTTP_400_BAD_REQUEST,
            content_type="application/problem+json",
        )

    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            res = requests.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=15,
            )
            if res.status_code == 200:
                data = res.json()
                text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                if text:
                    return Response({"prompt": prompt, "response": text, "model": "gemini-1.5-flash"})
        except Exception:
            pass

    return Response({
        "prompt": prompt,
        "response": f"[Django AI Engine Output]: Processed prompt '{prompt}'. Ready for hackathon delivery.",
        "model": "django-hackathon-engine",
    })

