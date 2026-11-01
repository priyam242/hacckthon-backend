package com.hackathon.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
            "status", "healthy",
            "framework", "Spring Boot 3",
            "service", "hackathon-java-springboot",
            "timestamp", Instant.now().toString()
        );
    }

    @GetMapping("/")
    public Map<String, Object> root() {
        return Map.of(
            "message", "Spring Boot Hackathon Backend is running!",
            "health", "/health",
            "auth", "/api/auth"
        );
    }
}
