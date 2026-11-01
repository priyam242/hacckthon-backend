package com.hackathon

import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.http.*
import kotlinx.serialization.Serializable
import java.time.Instant

@Serializable
data class ProblemDetails(
    val type: String = "about:blank",
    val title: String,
    val status: Int,
    val detail: String,
    val instance: String = ""
)

fun main() {
    embeddedServer(Netty, port = 8080, host = "0.0.0.0") {
        install(ContentNegotiation) {
            json()
        }
        install(CORS) {
            anyHost()
            allowHeader(HttpHeaders.ContentType)
            allowHeader(HttpHeaders.Authorization)
        }
        install(StatusPages) {
            exception<Throwable> { call, cause ->
                call.respond(
                    HttpStatusCode.InternalServerError,
                    ProblemDetails(
                        title = "Internal Server Error",
                        status = 500,
                        detail = cause.message ?: "An unexpected error occurred"
                    )
                )
            }
        }
        routing {
            get("/health") {
                call.respond(mapOf(
                    "status" to "healthy",
                    "framework" to "Kotlin Ktor",
                    "service" to "hackathon-kotlin-ktor",
                    "timestamp" to Instant.now().toString()
                ))
            }
            get("/") {
                call.respond(mapOf(
                    "message" to "Kotlin Ktor Hackathon Backend is running!",
                    "health" to "/health"
                ))
            }
            post("/api/ai/generate") {
                call.respond(mapOf(
                    "prompt" to "Hackathon prompt",
                    "response" to "[Kotlin Ktor AI Engine] High-throughput coroutine processed prompt.",
                    "model" to "kotlin-ktor-engine"
                ))
            }
        }
    }.start(wait = true)
}
