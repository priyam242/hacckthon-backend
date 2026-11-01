package com.hackathon.backend.controller;

import com.hackathon.backend.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final Map<String, UserRecord> users = new ConcurrentHashMap<>();

    public record UserRecord(String id, String username, String email, String password) {}

    public AuthController(JwtUtil jwtUtil, PasswordEncoder passwordEncoder) {
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String email = body.get("email");
        String password = body.get("password");

        if (username == null || email == null || password == null) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Username, email, and password are required"
            );
            problem.setType(URI.create("about:blank"));
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(problem);
        }

        for (UserRecord u : users.values()) {
            if (u.username().equalsIgnoreCase(username) || u.email().equalsIgnoreCase(email)) {
                ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                    HttpStatus.CONFLICT, "User already exists with this username or email"
                );
                return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
            }
        }

        String id = "usr_" + System.currentTimeMillis();
        UserRecord user = new UserRecord(id, username, email, passwordEncoder.encode(password));
        users.put(id, user);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
            "id", user.id(),
            "username", user.username(),
            "email", user.email()
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String usernameOrEmail = body.get("username_or_email");
        String password = body.get("password");

        UserRecord found = null;
        for (UserRecord u : users.values()) {
            if (u.username().equalsIgnoreCase(usernameOrEmail) || u.email().equalsIgnoreCase(usernameOrEmail)) {
                found = u;
                break;
            }
        }

        if (found == null || !passwordEncoder.matches(password, found.password())) {
            ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNAUTHORIZED, "Invalid username/email or password"
            );
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem);
        }

        String token = jwtUtil.generateToken(found.username(), found.id());
        return ResponseEntity.ok(Map.of(
            "access_token", token,
            "token_type", "bearer",
            "user", Map.of("id", found.id(), "username", found.username(), "email", found.email())
        ));
    }
}

