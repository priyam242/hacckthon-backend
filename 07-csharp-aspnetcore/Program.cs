using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddProblemDetails();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
    });
});

// JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "hackathon-aspnetcore-super-secret-key-that-is-at-least-32-chars-long";
var key = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseStatusCodePages();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

// In-Memory user store for instant hackathon usage
var users = new Dictionary<string, UserRecord>();

// Health Check
app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    framework = "ASP.NET Core (.NET 8/9)",
    service = "hackathon-csharp-backend",
    timestamp = DateTime.UtcNow
}));

app.MapGet("/", () => Results.Ok(new
{
    message = "ASP.NET Core Hackathon Backend is running!",
    health = "/health",
    auth = "/api/auth"
}));

// Auth: Signup
app.MapPost("/api/auth/signup", (SignupDto dto) =>
{
    if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
    {
        return Results.Problem(detail: "Email, username, and password are required.", statusCode: 400);
    }

    if (users.Values.Any(u => u.Email.Equals(dto.Email, StringComparison.OrdinalIgnoreCase) ||
                              u.Username.Equals(dto.Username, StringComparison.OrdinalIgnoreCase)))
    {
        return Results.Problem(detail: "User with this email or username already exists.", statusCode: 409);
    }

    var id = Guid.NewGuid().ToString();
    var hashed = BCrypt.Net.BCrypt.HashPassword(dto.Password);
    var newUser = new UserRecord(id, dto.Username, dto.Email, hashed);
    users[id] = newUser;

    return Results.Created($"/api/auth/users/{id}", new { id, username = dto.Username, email = dto.Email });
});

// Auth: Login
app.MapPost("/api/auth/login", (LoginDto dto) =>
{
    var user = users.Values.FirstOrDefault(u =>
        u.Username.Equals(dto.UsernameOrEmail, StringComparison.OrdinalIgnoreCase) ||
        u.Email.Equals(dto.UsernameOrEmail, StringComparison.OrdinalIgnoreCase));

    if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.HashedPassword))
    {
        return Results.Problem(detail: "Invalid credentials.", statusCode: 401);
    }

    var tokenHandler = new JwtSecurityTokenHandler();
    var tokenDescriptor = new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Name, user.Username)
        }),
        Expires = DateTime.UtcNow.AddHours(24),
        SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
    };

    var token = tokenHandler.CreateToken(tokenDescriptor);
    return Results.Ok(new
    {
        access_token = tokenHandler.WriteToken(token),
        token_type = "bearer",
        user = new { id = user.Id, username = user.Username, email = user.Email }
    });
});

// Protected: Current User
app.MapGet("/api/auth/me", (ClaimsPrincipal principal) =>
{
    var id = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    if (id != null && users.TryGetValue(id, out var user))
    {
        return Results.Ok(new { id = user.Id, username = user.Username, email = user.Email });
    }
    return Results.Problem(detail: "User not found.", statusCode: 404);
}).RequireAuthorization();

// AI Endpoint
app.MapPost("/api/ai/generate", (AiPromptDto dto, ClaimsPrincipal principal) =>
{
    if (string.IsNullOrWhiteSpace(dto.Prompt))
    {
        return Results.Problem(detail: "Prompt field is required.", statusCode: 400);
    }

    return Results.Ok(new
    {
        prompt = dto.Prompt,
        response = $"[C# .NET AI Engine] Analysis for '{dto.Prompt}' concluded. Optimal architecture selected.",
        model = "aspnetcore-hackathon-engine"
    });
}).RequireAuthorization();

app.Run();

record UserRecord(string Id, string Username, string Email, string HashedPassword);
record SignupDto(string Username, string Email, string Password);
record LoginDto(string UsernameOrEmail, string Password);
record AiPromptDto(string Prompt);
