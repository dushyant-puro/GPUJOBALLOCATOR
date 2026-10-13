"""Local-demo hardening. A shared token is optional and is not production identity management."""
import os
import secrets
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


def origins():
    return [value.strip().rstrip("/") for value in os.environ.get("GPU_ALLOCATOR_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if value.strip()]


class LocalSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            if origin and origin.rstrip("/") not in {*origins(), str(request.base_url).rstrip("/")}:
                return JSONResponse({"detail": "Origin is not allowed to mutate this local simulator."}, status_code=403)
            token = os.environ.get("GPU_ALLOCATOR_API_TOKEN")
            if token:
                scheme, _, value = request.headers.get("authorization", "").partition(" ")
                supplied = value if scheme.lower() == "bearer" else ""
                if not secrets.compare_digest(supplied.encode(), token.encode()):
                    return JSONResponse({"detail": "A valid API bearer token is required."}, status_code=401)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith("/studio"):
            response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        return response
