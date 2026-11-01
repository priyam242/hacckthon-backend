use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
    time::{SystemTime, UNIX_EPOCH},
};
use tower_http::cors::{Any, CorsLayer};

#[derive(Serialize)]
struct ProblemDetails {
    #[serde(rename = "type")]
    problem_type: String,
    title: String,
    status: u16,
    detail: String,
    instance: String,
}

impl IntoResponse for ProblemDetails {
    fn into_response(self) -> Response {
        let status = StatusCode::from_u16(self.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        let mut res = (status, Json(self)).into_response();
        res.headers_mut().insert(
            header::CONTENT_TYPE,
            "application/problem+json".parse().unwrap(),
        );
        res
    }
}

fn problem(status: StatusCode, title: &str, detail: &str, instance: &str) -> ProblemDetails {
    ProblemDetails {
        problem_type: "about:blank".to_string(),
        title: title.to_string(),
        status: status.as_u16(),
        detail: detail.to_string(),
        instance: instance.to_string(),
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct User {
    id: String,
    username: String,
    email: String,
    password_hash: String,
}

#[derive(Clone)]
struct AppState {
    users: Arc<RwLock<HashMap<String, User>>>,
    jwt_secret: String,
}

#[derive(Deserialize)]
struct SignupDto {
    username: String,
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginDto {
    username_or_email: String,
    password: String,
}

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: String,
    username: String,
    exp: usize,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "hackathon-rust-axum-super-secret-key-change-in-production".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());

    let state = AppState {
        users: Arc::new(RwLock::new(HashMap::new())),
        jwt_secret,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/", get(health_check))
        .route("/api/auth/signup", post(signup))
        .route("/api/auth/login", post(login))
        .route("/api/auth/me", get(me))
        .route("/api/ai/generate", post(ai_generate))
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    println!("[Rust Axum Backend] Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "framework": "Rust Axum",
        "service": "hackathon-rust-axum",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

async fn signup(
    State(state): State<AppState>,
    Json(payload): Json<SignupDto>,
) -> Result<impl IntoResponse, ProblemDetails> {
    if payload.email.is_empty() || payload.username.is_empty() || payload.password.is_empty() {
        return Err(problem(
            StatusCode::BAD_REQUEST,
            "Validation Error",
            "Username, email, and password are required.",
            "/api/auth/signup",
        ));
    }

    let mut users = state.users.write().unwrap();
    for u in users.values() {
        if u.email == payload.email || u.username == payload.username {
            return Err(problem(
                StatusCode::CONFLICT,
                "Conflict",
                "User with this email or username already exists.",
                "/api/auth/signup",
            ));
        }
    }

    let hashed = bcrypt::hash(&payload.password, 4).map_err(|_| {
        problem(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal Error",
            "Failed to hash password.",
            "/api/auth/signup",
        )
    })?;

    let id = format!("usr_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis());
    let new_user = User {
        id: id.clone(),
        username: payload.username.clone(),
        email: payload.email.clone(),
        password_hash: hashed,
    };
    users.insert(id.clone(), new_user);

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": id,
            "username": payload.username,
            "email": payload.email
        })),
    ))
}

async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginDto>,
) -> Result<impl IntoResponse, ProblemDetails> {
    let users = state.users.read().unwrap();
    let mut found = None;

    for u in users.values() {
        if u.email == payload.username_or_email || u.username == payload.username_or_email {
            found = Some(u.clone());
            break;
        }
    }

    let user = found.ok_or_else(|| {
        problem(
            StatusCode::UNAUTHORIZED,
            "Unauthorized",
            "Invalid credentials.",
            "/api/auth/login",
        )
    })?;

    if !bcrypt::verify(&payload.password, &user.password_hash).unwrap_or(false) {
        return Err(problem(
            StatusCode::UNAUTHORIZED,
            "Unauthorized",
            "Invalid credentials.",
            "/api/auth/login",
        ));
    }

    let exp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize
        + 86400;

    let claims = Claims {
        sub: user.id.clone(),
        username: user.username.clone(),
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )
    .map_err(|_| {
        problem(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Internal Error",
            "Failed to create JWT token.",
            "/api/auth/login",
        )
    })?;

    Ok(Json(serde_json::json!({
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    })))
}

async fn me(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ProblemDetails> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| {
            problem(
                StatusCode::UNAUTHORIZED,
                "Unauthorized",
                "Missing Authorization header.",
                "/api/auth/me",
            )
        })?;

    if !auth_header.starts_with("Bearer ") {
        return Err(problem(
            StatusCode::UNAUTHORIZED,
            "Unauthorized",
            "Invalid Bearer token prefix.",
            "/api/auth/me",
        ));
    }

    let token_str = &auth_header[7..];
    let validation = jsonwebtoken::Validation::default();
    let token_data = jsonwebtoken::decode::<Claims>(
        token_str,
        &jsonwebtoken::DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|_| {
        problem(
            StatusCode::UNAUTHORIZED,
            "Unauthorized",
            "Invalid or expired token.",
            "/api/auth/me",
        )
    })?;

    let users = state.users.read().unwrap();
    let user = users.get(&token_data.claims.sub).ok_or_else(|| {
        problem(
            StatusCode::NOT_FOUND,
            "Not Found",
            "User does not exist.",
            "/api/auth/me",
        )
    })?;

    Ok(Json(serde_json::json!({
        "id": user.id,
        "username": user.username,
        "email": user.email
    })))
}

#[derive(Deserialize)]
struct AiDto {
    prompt: String,
}

async fn ai_generate(Json(payload): Json<AiDto>) -> Result<impl IntoResponse, ProblemDetails> {
    if payload.prompt.is_empty() {
        return Err(problem(
            StatusCode::BAD_REQUEST,
            "Validation Error",
            "Field 'prompt' is required.",
            "/api/ai/generate",
        ));
    }

    Ok(Json(serde_json::json!({
        "prompt": payload.prompt,
        "response": format!("[Rust Axum AI Engine] Query '{}' processed in microsecond latency. Hackathon ready.", payload.prompt),
        "model": "rust-axum-engine"
    })))
}

