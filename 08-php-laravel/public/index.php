<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Helper: send RFC 7807 problem details
function sendProblem($status, $title, $detail) {
    header("Content-Type: application/problem+json");
    http_response_code($status);
    echo json_encode([
        "type" => "about:blank",
        "title" => $title,
        "status" => $status,
        "detail" => $detail,
        "instance" => $_SERVER['REQUEST_URI'] ?? ""
    ]);
    exit;
}

function sendJson($data, $status = 200) {
    header("Content-Type: application/json");
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// In-memory or session storage file for hackathon speed
$usersFile = __DIR__ . '/../storage/users.json';
if (!file_exists(dirname($usersFile))) {
    mkdir(dirname($usersFile), 0777, true);
}
$users = file_exists($usersFile) ? json_decode(file_get_contents($usersFile), true) : [];

$input = json_decode(file_get_contents('php://input'), true) ?? [];

// Routes
if ($method === 'GET' && ($uri === '/' || $uri === '/health')) {
    sendJson([
        "status" => "healthy",
        "framework" => "PHP Laravel Native API",
        "service" => "hackathon-php-laravel",
        "timestamp" => date('c')
    ]);
}

if ($method === 'POST' && $uri === '/api/auth/signup') {
    $email = $input['email'] ?? null;
    $username = $input['username'] ?? null;
    $password = $input['password'] ?? null;

    if (!$email || !$username || !$password) {
        sendProblem(400, "Validation Error", "Email, username, and password are required.");
    }

    foreach ($users as $u) {
        if ($u['email'] === $email || $u['username'] === $username) {
            sendProblem(409, "Conflict", "User with this email or username already exists.");
        }
    }

    $id = "usr_" . bin2hex(random_bytes(5));
    $newUser = [
        "id" => $id,
        "email" => $email,
        "username" => $username,
        "password" => password_hash($password, PASSWORD_BCRYPT),
        "created_at" => date('c')
    ];
    $users[] = $newUser;
    file_put_contents($usersFile, json_encode($users));

    sendJson(["id" => $id, "email" => $email, "username" => $username], 201);
}

if ($method === 'POST' && $uri === '/api/auth/login') {
    $usernameOrEmail = $input['username_or_email'] ?? null;
    $password = $input['password'] ?? null;

    $found = null;
    foreach ($users as $u) {
        if ($u['email'] === $usernameOrEmail || $u['username'] === $usernameOrEmail) {
            $found = $u;
            break;
        }
    }

    if (!$found || !password_verify($password, $found['password'])) {
        sendProblem(401, "Unauthorized", "Invalid credentials.");
    }

    $token = base64_encode(json_encode([
        "sub" => $found['id'],
        "username" => $found['username'],
        "exp" => time() + 86400
    ]));

    sendJson([
        "access_token" => $token,
        "token_type" => "bearer",
        "user" => [
            "id" => $found['id'],
            "username" => $found['username'],
            "email" => $found['email']
        ]
    ]);
}

if ($method === 'POST' && $uri === '/api/ai/generate') {
    $prompt = $input['prompt'] ?? null;
    if (!$prompt) {
        sendProblem(400, "Validation Error", "Prompt field is required.");
    }

    sendJson([
        "prompt" => $prompt,
        "response" => "[PHP AI Engine]: Evaluation for '{$prompt}' processed successfully. Hackathon MVP ready.",
        "model" => "php-laravel-engine"
    ]);
}

sendProblem(404, "Not Found", "Endpoint {$method} {$uri} not found.");
