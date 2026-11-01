package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

// RFC 7807 Problem Details Struct
type ProblemDetails struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	Status   int    `json:"status"`
	Detail   string `json:"detail"`
	Instance string `json:"instance"`
}

func sendProblem(c *gin.Context, status int, title, detail string) {
	c.Header("Content-Type", "application/problem+json")
	c.JSON(status, ProblemDetails{
		Type:     "about:blank",
		Title:    title,
		Status:   status,
		Detail:   detail,
		Instance: c.Request.URL.Path,
	})
	c.Abort()
}

// In-memory User store
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	Password  string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

var (
	usersLock sync.RWMutex
	users     = make(map[string]*User)
	jwtSecret = []byte("hackathon-golang-jwt-super-secret-key")
)

type SignupRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Username string `json:"username" binding:"required,min=3"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginRequest struct {
	UsernameOrEmail string `json:"username_or_email" binding:"required"`
	Password        string `json:"password" binding:"required"`
}

type AiRequest struct {
	Prompt string `json:"prompt" binding:"required"`
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || len(authHeader) < 7 || authHeader[:7] != "Bearer " {
			sendProblem(c, http.StatusUnauthorized, "Unauthorized", "Missing or invalid Bearer token")
			return
		}

		tokenStr := authHeader[7:]
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			sendProblem(c, http.StatusUnauthorized, "Unauthorized", "Token is invalid or expired")
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			sendProblem(c, http.StatusUnauthorized, "Unauthorized", "Invalid token claims")
			return
		}

		c.Set("userID", claims["sub"])
		c.Next()
	}
}

func main() {
	_ = godotenv.Load()
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		jwtSecret = []byte(secret)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := gin.Default()

	// CORS Setup
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health Check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"framework": "Go Gin",
			"service":   "hackathon-golang-gin-backend",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Go Gin Hackathon Backend is running!",
			"health":  "/health",
			"auth":    "/api/auth",
			"ai":      "/api/ai",
		})
	})

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/signup", func(c *gin.Context) {
				var req SignupRequest
				if err := c.ShouldBindJSON(&req); err != nil {
					sendProblem(c, http.StatusUnprocessableEntity, "Validation Error", err.Error())
					return
				}

				usersLock.Lock()
				defer usersLock.Unlock()

				for _, u := range users {
					if u.Email == req.Email || u.Username == req.Username {
						sendProblem(c, http.StatusConflict, "Conflict", "Email or username already registered")
						return
					}
				}

				hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
				if err != nil {
					sendProblem(c, http.StatusInternalServerError, "Internal Error", "Failed to hash password")
					return
				}

				id := fmt.Sprintf("usr_%d", time.Now().UnixNano())
				newUser := &User{
					ID:        id,
					Email:     req.Email,
					Username:  req.Username,
					Password:  string(hashed),
					CreatedAt: time.Now().UTC(),
				}
				users[id] = newUser

				c.JSON(http.StatusCreated, gin.H{
					"id":         newUser.ID,
					"email":      newUser.Email,
					"username":   newUser.Username,
					"created_at": newUser.CreatedAt,
				})
			})

			auth.POST("/login", func(c *gin.Context) {
				var req LoginRequest
				if err := c.ShouldBindJSON(&req); err != nil {
					sendProblem(c, http.StatusUnprocessableEntity, "Validation Error", err.Error())
					return
				}

				usersLock.RLock()
				var found *User
				for _, u := range users {
					if u.Email == req.UsernameOrEmail || u.Username == req.UsernameOrEmail {
						found = u
						break
					}
				}
				usersLock.RUnlock()

				if found == nil || bcrypt.CompareHashAndPassword([]byte(found.Password), []byte(req.Password)) != nil {
					sendProblem(c, http.StatusUnauthorized, "Unauthorized", "Invalid credentials")
					return
				}

				claims := jwt.MapClaims{
					"sub":      found.ID,
					"username": found.Username,
					"exp":      time.Now().Add(24 * time.Hour).Unix(),
				}
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
				tokenString, err := token.SignedString(jwtSecret)
				if err != nil {
					sendProblem(c, http.StatusInternalServerError, "Internal Error", "Failed to sign token")
					return
				}

				c.JSON(http.StatusOK, gin.H{
					"access_token": tokenString,
					"token_type":   "bearer",
					"user": gin.H{
						"id":       found.ID,
						"username": found.Username,
						"email":    found.Email,
					},
				})
			})

			auth.GET("/me", authMiddleware(), func(c *gin.Context) {
				userID, _ := c.Get("userID")
				usersLock.RLock()
				user, exists := users[userID.(string)]
				usersLock.RUnlock()

				if !exists {
					sendProblem(c, http.StatusNotFound, "Not Found", "User not found")
					return
				}

				c.JSON(http.StatusOK, gin.H{
					"id":       user.ID,
					"username": user.Username,
					"email":    user.Email,
				})
			})
		}

		ai := api.Group("/ai")
		ai.Use(authMiddleware())
		{
			ai.POST("/generate", func(c *gin.Context) {
				var req AiRequest
				if err := c.ShouldBindJSON(&req); err != nil {
					sendProblem(c, http.StatusUnprocessableEntity, "Validation Error", err.Error())
					return
				}

				geminiKey := os.Getenv("GEMINI_API_KEY")
				if geminiKey != "" {
					url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s", geminiKey)
					payload := map[string]interface{}{
						"contents": []map[string]interface{}{
							{"parts": []map[string]string{{"text": req.Prompt}}},
						},
					}
					b, _ := json.Marshal(payload)
					client := &http.Client{Timeout: 10 * time.Second}
					res, err := client.Post(url, "application/json", bytes.NewBuffer(b))
					if err == nil && res.StatusCode == http.StatusOK {
						defer res.Body.Close()
						bodyBytes, _ := io.ReadAll(res.Body)
						var gRes map[string]interface{}
						if err := json.Unmarshal(bodyBytes, &gRes); err == nil {
							c.JSON(http.StatusOK, gin.H{
								"prompt":   req.Prompt,
								"response": gRes,
								"model":    "gemini-1.5-flash",
							})
							return
						}
					}
				}

				c.JSON(http.StatusOK, gin.H{
					"prompt":   req.Prompt,
					"response": fmt.Sprintf("[Go Gin AI Engine] Prompt processed: %s. Hackathon ready.", req.Prompt),
					"model":    "golang-gin-engine",
				})
			})
		}
	}

	fmt.Printf("[Go Gin Backend] Listening on :%s\n", port)
	_ = r.Run(":" + port)
}
