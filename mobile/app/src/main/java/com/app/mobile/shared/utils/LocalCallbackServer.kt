package com.app.mobile.shared.utils

import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.ServerSocket
import java.net.URLDecoder
import kotlin.concurrent.thread

/**
 * Minimal HTTP server that listens on port 5173.
 *
 * The backend's OAuth2SuccessHandler redirects to:
 *   http://localhost:5173/oauth2/callback?token=...&email=...&firstName=...&lastName=...&role=...
 *
 * On the phone, localhost:5173 resolves to the phone itself — this server catches that request,
 * extracts the JWT and user info, then fires [onTokenReceived].
 */
class LocalCallbackServer {

    private var serverSocket: ServerSocket? = null
    var onTokenReceived: ((token: String, email: String, firstName: String, lastName: String, role: String) -> Unit)? = null
    var onError: ((message: String) -> Unit)? = null

    fun start() {
        thread(start = true, isDaemon = true) {
            try {
                serverSocket = ServerSocket(5173)
                val client = serverSocket!!.accept()

                val reader = BufferedReader(InputStreamReader(client.getInputStream()))
                val requestLine = reader.readLine() ?: run { client.close(); return@thread }

                // e.g. "GET /oauth2/callback?token=eyJ...&email=...&firstName=...&lastName=...&role=CUSTOMER HTTP/1.1"
                val queryString = requestLine
                    .substringAfter("?", missingDelimiterValue = "")
                    .substringBefore(" ")

                val html = """
                    <!DOCTYPE html><html><head><meta charset="utf-8">
                    <meta name="viewport" content="width=device-width,initial-scale=1">
                    <title>EventWear</title>
                    <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
                    min-height:100vh;margin:0;background:#F8F7F5}
                    .card{background:#fff;padding:40px 32px;border-radius:20px;text-align:center;
                    box-shadow:0 8px 32px rgba(107,45,57,.15);max-width:320px}
                    h2{color:#6B2D39;margin-bottom:12px}p{color:#718096;margin:0}</style></head>
                    <body><div class="card"><h2>✓ Authentication Successful</h2>
                    <p>You can close this tab and return to the EventWear app.</p></div></body></html>
                """.trimIndent()
                val response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n" +
                        "Content-Length: ${html.toByteArray().size}\r\nConnection: close\r\n\r\n$html"
                client.getOutputStream().write(response.toByteArray())
                client.getOutputStream().flush()
                client.close()

                if (queryString.contains("token=")) {
                    val params = parseQuery(queryString)
                    val token     = params["token"]     ?: ""
                    val email     = params["email"]     ?: ""
                    val firstName = params["firstName"] ?: ""
                    val lastName  = params["lastName"]  ?: ""
                    val role      = params["role"]      ?: "CUSTOMER"

                    if (token.isNotEmpty()) {
                        onTokenReceived?.invoke(token, email, firstName, lastName, role)
                    } else {
                        onError?.invoke("Google sign-in failed. No token received.")
                    }
                } else if (queryString.contains("error=")) {
                    val params = parseQuery(queryString)
                    val err = params["error"] ?: "oauth_failed"
                    onError?.invoke(when (err) {
                        "not_registered" -> "No EventWear account found for this Google email. Please sign up first."
                        "access_denied", "cancelled" -> "Google sign-in was cancelled."
                        else -> "Google sign-in failed. Please try again."
                    })
                }

            } catch (_: Exception) {
                // Socket closed intentionally on stop()
            }
        }
    }

    fun stop() {
        try { serverSocket?.close() } catch (_: Exception) {}
        serverSocket = null
    }

    private fun parseQuery(query: String): Map<String, String> {
        if (query.isBlank()) return emptyMap()
        return query.split("&").mapNotNull { part ->
            val idx = part.indexOf('=')
            if (idx < 0) return@mapNotNull null
            try {
                URLDecoder.decode(part.substring(0, idx), "UTF-8") to
                        URLDecoder.decode(part.substring(idx + 1), "UTF-8")
            } catch (_: Exception) { null }
        }.toMap()
    }
}
