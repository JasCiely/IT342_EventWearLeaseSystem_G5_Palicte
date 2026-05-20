package com.app.mobile.shared.api

import com.app.mobile.App
import com.app.mobile.shared.utils.SessionManager
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    const val BASE_URL = "http://192.168.1.27:8080"

    val http: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl("$BASE_URL/")
            .client(http)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val adminApi: AdminApiService by lazy {
        retrofit.create(AdminApiService::class.java)
    }

    fun bearerToken(): String {
        val token = SessionManager.getToken(App.instance) ?: ""
        return "Bearer $token"
    }
}
