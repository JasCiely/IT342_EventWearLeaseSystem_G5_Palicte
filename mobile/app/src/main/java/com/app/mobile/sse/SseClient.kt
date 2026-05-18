package com.app.mobile.sse

import android.os.Handler
import android.os.Looper
import com.app.mobile.ApiClient
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Request
import okhttp3.Response
import java.io.IOException

object SseClient {

    private var call: Call? = null
    private val listeners = mutableSetOf<SseListener>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var reconnectRunnable: Runnable? = null

    interface SseListener {
        fun onEvent(type: String, data: String)
    }

    fun connect() {
        val token = com.app.mobile.SessionManager.getToken(com.app.mobile.App.instance) ?: return
        disconnect()

        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/api/sse/events")
            .header("Authorization", "Bearer $token")
            .header("Accept", "text/event-stream")
            .header("Cache-Control", "no-cache")
            .build()

        call = ApiClient.http.newCall(request)
        call?.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                scheduleReconnect()
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) { scheduleReconnect(); return }
                try {
                    val source = response.body?.source() ?: run { scheduleReconnect(); return }
                    var eventType = ""
                    val dataBuffer = StringBuilder()
                    while (!source.exhausted() && !call.isCanceled()) {
                        val line = source.readUtf8Line() ?: break
                        when {
                            line.startsWith("event:") -> eventType = line.removePrefix("event:").trim()
                            line.startsWith("data:") -> dataBuffer.append(line.removePrefix("data:").trim())
                            line.isEmpty() && dataBuffer.isNotEmpty() -> {
                                val type = eventType.ifEmpty { "MESSAGE" }
                                val data = dataBuffer.toString()
                                mainHandler.post { listeners.forEach { it.onEvent(type, data) } }
                                eventType = ""
                                dataBuffer.clear()
                            }
                        }
                    }
                } catch (_: Exception) {}
                if (!call.isCanceled()) scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        reconnectRunnable?.let { mainHandler.removeCallbacks(it) }
        reconnectRunnable = Runnable { connect() }.also { mainHandler.postDelayed(it, 5_000) }
    }

    fun addListener(listener: SseListener) { listeners.add(listener) }
    fun removeListener(listener: SseListener) { listeners.remove(listener) }

    fun disconnect() {
        reconnectRunnable?.let { mainHandler.removeCallbacks(it) }
        reconnectRunnable = null
        call?.cancel()
        call = null
    }
}
