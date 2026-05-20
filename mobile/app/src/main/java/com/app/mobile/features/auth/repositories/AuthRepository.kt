package com.app.mobile.features.auth.repositories

import com.app.mobile.shared.api.ApiClient
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject

object AuthRepository {

    private val JSON_TYPE = "application/json".toMediaType()

    private const val MSG_INVALID_CREDENTIALS = "Invalid email or password."
    private const val MSG_EMAIL_EXISTS        = "This email is already registered. Please use a different email or sign in."
    private const val MSG_ACCOUNT_DISABLED    = "Account is disabled. Please contact administrator."
    private const val MSG_SERVER_ERROR        = "Unable to connect to server. Please try again."
    private const val MSG_NETWORK_ERROR       = "Cannot connect to server. Please check your connection."

    private fun parseErrorMessage(responseBody: String?): String {
        if (responseBody == null) return MSG_SERVER_ERROR
        return try {
            val json = JSONObject(responseBody)
            if (json.has("validationErrors")) {
                val errs = json.getJSONObject("validationErrors")
                val firstKey = errs.keys().next()
                return errs.getString(firstKey)
            }
            val msg = json.optString("message", "").lowercase()
            when {
                msg.contains("email") && (msg.contains("already") || msg.contains("registered")) -> MSG_EMAIL_EXISTS
                msg.contains("invalid email or password") -> MSG_INVALID_CREDENTIALS
                msg.contains("invalid") && msg.contains("credentials") -> MSG_INVALID_CREDENTIALS
                msg.contains("disabled") -> MSG_ACCOUNT_DISABLED
                else -> MSG_SERVER_ERROR
            }
        } catch (e: Exception) {
            MSG_SERVER_ERROR
        }
    }

    fun login(
        email: String,
        password: String,
        onSuccess: (token: String, firstName: String, lastName: String, email: String, role: String, mustChangePassword: Boolean) -> Unit,
        onError: (message: String) -> Unit,
        onSessionExpired: (() -> Unit)? = null
    ) {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
        }.toString().toRequestBody(JSON_TYPE)

        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/api/auth/login")
            .post(body)
            .addHeader("Content-Type", "application/json")
            .build()

        ApiClient.http.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                onError(MSG_NETWORK_ERROR)
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string()
                if (response.code == 401) {
                    onSessionExpired?.invoke() ?: onError(MSG_INVALID_CREDENTIALS)
                    return
                }
                if (response.isSuccessful && responseBody != null) {
                    try {
                        val json = JSONObject(responseBody)
                        val token = json.optString("token", "")
                        if (token.isEmpty()) { onError(MSG_SERVER_ERROR); return }
                        onSuccess(
                            token,
                            json.getString("firstName"),
                            json.getString("lastName"),
                            json.getString("email"),
                            json.getString("role"),
                            json.optBoolean("mustChangePassword", false)
                        )
                    } catch (e: Exception) {
                        onError(MSG_SERVER_ERROR)
                    }
                } else {
                    onError(parseErrorMessage(responseBody))
                }
            }
        })
    }

    fun register(
        firstName: String,
        lastName: String,
        email: String,
        password: String,
        onSuccess: () -> Unit,
        onError: (message: String) -> Unit
    ) {
        val body = JSONObject().apply {
            put("firstName", firstName)
            put("lastName", lastName)
            put("email", email)
            put("password", password)
        }.toString().toRequestBody(JSON_TYPE)

        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/api/auth/register")
            .post(body)
            .addHeader("Content-Type", "application/json")
            .build()

        ApiClient.http.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                onError(MSG_NETWORK_ERROR)
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string()
                if (response.isSuccessful) {
                    onSuccess()
                } else {
                    onError(parseErrorMessage(responseBody))
                }
            }
        })
    }

    fun logout(
        token: String?,
        onSuccess: () -> Unit,
        onError: (message: String) -> Unit
    ) {
        val requestBuilder = Request.Builder()
            .url("${ApiClient.BASE_URL}/api/auth/logout")
            .post("".toRequestBody(null))
        if (!token.isNullOrEmpty()) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }

        ApiClient.http.newCall(requestBuilder.build()).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                onError(MSG_NETWORK_ERROR)
            }

            override fun onResponse(call: Call, response: Response) {
                onSuccess()
            }
        })
    }

    fun forgotPassword(
        email: String,
        onSuccess: () -> Unit,
        onError: (message: String) -> Unit
    ) {
        val body = JSONObject().apply {
            put("email", email.trim().lowercase())
        }.toString().toRequestBody(JSON_TYPE)

        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/api/auth/forgot-password")
            .post(body)
            .addHeader("Content-Type", "application/json")
            .build()

        ApiClient.http.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                onError(MSG_NETWORK_ERROR)
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) onSuccess()
                else onError("Something went wrong. Please try again.")
            }
        })
    }

    fun verifyOtp(
        email: String,
        otp: String,
        onSuccess: () -> Unit,
        onError: (message: String) -> Unit
    ) {
        val body = JSONObject().apply {
            put("email", email)
            put("otp", otp)
        }.toString().toRequestBody(JSON_TYPE)

        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/api/auth/verify-otp")
            .post(body)
            .addHeader("Content-Type", "application/json")
            .build()

        ApiClient.http.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                onError(MSG_NETWORK_ERROR)
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string()
                if (response.isSuccessful) {
                    onSuccess()
                } else {
                    val msg = try {
                        JSONObject(responseBody ?: "").optString("message", "Invalid OTP. Please try again.")
                    } catch (e: Exception) { "Invalid OTP. Please try again." }
                    onError(msg)
                }
            }
        })
    }

    fun resetPassword(
        email: String,
        otp: String,
        newPassword: String,
        onSuccess: () -> Unit,
        onError: (message: String) -> Unit
    ) {
        val body = JSONObject().apply {
            put("email", email)
            put("otp", otp)
            put("newPassword", newPassword)
        }.toString().toRequestBody(JSON_TYPE)

        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/api/auth/reset-password")
            .post(body)
            .addHeader("Content-Type", "application/json")
            .build()

        ApiClient.http.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                onError(MSG_NETWORK_ERROR)
            }

            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string()
                if (response.isSuccessful) {
                    onSuccess()
                } else {
                    val msg = try {
                        JSONObject(responseBody ?: "").optString("message", "Failed to reset password. Please try again.")
                    } catch (e: Exception) { "Failed to reset password. Please try again." }
                    onError(msg)
                }
            }
        })
    }
}
