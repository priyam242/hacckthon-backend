<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Request-Id");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

function sendProblem($status, $title, $detail) {
    header("Content-Type: application/problem+json");
    http_response_code($status);
    echo json_encode([
        "success" => false,
        "type" => "about:blank",
        "title" => $title,
        "status" => $status,
        "message" => $detail,
        "error" => ["code" => $status === 401 ? "UNAUTHORIZED" : ($status === 422 ? "VALIDATION_ERROR" : "BAD_REQUEST"), "details" => []],
        "detail" => $detail,
        "instance" => $_SERVER['REQUEST_URI'] ?? ""
    ]);
    exit;
}

function sendJson($data, $status = 200, $message = "Success", $meta = null) {
    header("Content-Type: application/json");
    http_response_code($status);
    echo json_encode([
        "success" => true,
        "message" => $message,
        "data" => $data,
        "meta" => $meta,
        "access_token" => $data['accessToken'] ?? ($data['access_token'] ?? null),
        "status" => $data['status'] ?? null
    ]);
    exit;
}

$usersFile = __DIR__ . '/../storage/users.json';
if (!file_exists(dirname($usersFile))) {
    mkdir(dirname($usersFile), 0777, true);
}
$users = file_exists($usersFile) ? json_decode(file_get_contents($usersFile), true) : [];
$input = json_decode(file_get_contents('php://input'), true) ?? [];

// Health Checks
if ($method === 'GET' && ($uri === '/' || $uri === '/health' || $uri === '/api/health')) {
    sendJson([
        "status" => "healthy",
        "framework" => "PHP Laravel Native API",
        "service" => "hackathon-php-laravel",
        "timestamp" => date('c')
    ]);
}

// Auth: Register / Signup
if ($method === 'POST' && ($uri === '/api/auth/signup' || $uri === '/api/auth/register')) {
    $email = $input['email'] ?? null;
    $password = $input['password'] ?? null;
    $username = $input['username'] ?? ($email ? explode('@', $email)[0] : null);
    $name = $input['name'] ?? $username;

    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$password || strlen($password) < 6) {
        sendProblem(422, "Validation Error", "Valid email and password (min 6 chars) are required.");
    }

    foreach ($users as $u) {
        if ($u['email'] === $email || $u['username'] === $username) {
            sendProblem(409, "Conflict", "User with this email or username already exists.");
        }
    }

    $id = "usr_" . bin2hex(random_bytes(5));
    $newUser = [
        "id" => $id,
        "name" => $name,
        "email" => $email,
        "username" => $username,
        "password" => password_hash($password, PASSWORD_BCRYPT),
        "created_at" => date('c')
    ];
    $users[] = $newUser;
    file_put_contents($usersFile, json_encode($users));

    $token = base64_encode(json_encode(["sub" => $id, "email" => $email, "exp" => time() + 86400]));
    sendJson([
        "user" => ["id" => $id, "email" => $email, "username" => $username],
        "accessToken" => $token,
        "access_token" => $token
    ], 201, "Registered successfully");
}

// Auth: Login
if ($method === 'POST' && $uri === '/api/auth/login') {
    $identifier = $input['email'] ?? ($input['username'] ?? ($input['username_or_email'] ?? ($input['usernameOrEmail'] ?? null)));
    $password = $input['password'] ?? null;

    if (!$identifier || !$password) {
        sendProblem(422, "Validation Error", "Credentials are required.");
    }

    $found = null;
    foreach ($users as $u) {
        if ($u['email'] === $identifier || $u['username'] === $identifier) {
            $found = $u;
            break;
        }
    }

    if (!$found || !password_verify($password, $found['password'])) {
        sendProblem(401, "Unauthorized", "Invalid credentials.");
    }

    $token = base64_encode(json_encode(["sub" => $found['id'], "email" => $found['email'], "exp" => time() + 86400]));
    sendJson([
        "user" => ["id" => $found['id'], "username" => $found['username'], "email" => $found['email']],
        "accessToken" => $token,
        "access_token" => $token
    ]);
}

// Auth: Me
if ($method === 'GET' && $uri === '/api/auth/me') {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s(\S+)/', $auth, $matches)) {
        sendProblem(401, "Unauthorized", "Missing token");
    }
    $decoded = json_decode(base64_decode($matches[1]), true);
    if (!$decoded) {
        sendProblem(401, "Unauthorized", "Invalid token");
    }
    sendJson(["id" => $decoded['sub'], "email" => $decoded['email']]);
}

// Items: List
if ($method === 'GET' && $uri === '/api/items') {
    $sampleItems = [
        ["id" => "itm_1", "title" => "PHP Edge Unit", "price" => 150000],
        ["id" => "itm_2", "title" => "Laravel Cloud Worker", "price" => 250000]
    ];
    sendJson($sampleItems, 200, "Items retrieved", [
        "page" => 1,
        "limit" => 10,
        "totalCount" => 2,
        "totalPages" => 1
    ]);
}

// AI Endpoint
if ($method === 'POST' && $uri === '/api/ai/generate') {
    $prompt = $input['prompt'] ?? null;
    if (!$prompt) {
        sendProblem(422, "Validation Error", "Prompt field is required.");
    }

    sendJson([
        "prompt" => $prompt,
        "response" => "[PHP Laravel AI Engine]: Evaluated prompt '{$prompt}'. Ready for pitch.",
        "model" => "php-laravel-engine"
    ]);
}

sendProblem(404, "Not Found", "Endpoint {$method} {$uri} not found.");
