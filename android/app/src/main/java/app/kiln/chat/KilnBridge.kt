package app.kiln.chat

import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.InetAddress
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class KilnBridge(private val webView: WebView) {
    private val calls = ConcurrentHashMap<String, okhttp3.Call>()
    private val pool: ExecutorService = Executors.newFixedThreadPool(2)
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .callTimeout(120, TimeUnit.SECONDS)
        .followRedirects(false)
        .followSslRedirects(false)
        .retryOnConnectionFailure(true)
        .build()
        .also {
            it.dispatcher.maxRequests = 4
            it.dispatcher.maxRequestsPerHost = 2
        }

    fun shutdown() {
        calls.values.forEach { runCatching { it.cancel() } }
        calls.clear()
        pool.shutdownNow()
        client.dispatcher.cancelAll()
    }

    @JavascriptInterface
    fun cancel(id: String) {
        if (!ID.matches(id)) return
        calls.remove(id)?.cancel()
    }

    @JavascriptInterface
    fun request(id: String, method: String, url: String, headersJson: String, bodyBase64: String) {
        if (!ID.matches(id)) return
        pool.execute {
            try {
                perform(id, method, url, headersJson, bodyBase64)
            } catch (error: Exception) {
                end(id, "The network request failed.")
            }
        }
    }

    private fun perform(id: String, method: String, url: String, headersJson: String, bodyBase64: String) {
        val verb = method.uppercase()
        if (verb != "GET" && verb != "POST") {
            end(id, "That request is not allowed.")
            return
        }
        val parsed = url.toHttpUrlOrNull()
        if (parsed == null || parsed.scheme != "https" || blocked(parsed.host)) {
            end(id, "That address is not allowed.")
            return
        }
        if (headersJson.length > 16_000) {
            end(id, "That request is too large for this phone.")
            return
        }
        val headers = runCatching {
            org.json.JSONObject(headersJson.ifBlank { "{}" })
        }.getOrElse {
            end(id, "That request is not allowed.")
            return
        }
        val bytes = if (bodyBase64.isBlank()) {
            ByteArray(0)
        } else {
            runCatching { Base64.decode(bodyBase64, Base64.DEFAULT) }.getOrElse {
                end(id, "That request is not allowed.")
                return
            }
        }
        if (bytes.size > 8_000_000) {
            end(id, "That upload is too large for this phone.")
            return
        }
        var contentType = "application/octet-stream"
        val builder = Request.Builder().url(parsed)
        val keys = headers.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val lower = key.lowercase()
            if (lower !in ALLOWED_HEADERS) continue
            val value = headers.optString(key)
            if (value.isBlank() || value.length > 4000) continue
            if (lower == "content-type") contentType = value
            builder.header(key, value)
        }
        if (verb == "POST") {
            builder.post(bytes.toRequestBody(contentType.toMediaTypeOrNull()))
        } else {
            builder.get()
        }
        val call = client.newCall(builder.build())
        calls[id] = call
        val response = try {
            call.execute()
        } catch (error: Exception) {
            calls.remove(id)
            if (!call.isCanceled()) end(id, "The network request failed.")
            return
        }
        response.use {
            val ctype = it.header("Content-Type") ?: "application/octet-stream"
            val head = org.json.JSONObject().put("content-type", ctype).toString()
            emit("window.__kilnHead&&window.__kilnHead(${js(id)},${it.code},${js(b64(head))})")
            val source = it.body?.byteStream()
            if (source == null) {
                calls.remove(id)
                end(id, "")
                return
            }
            val buf = ByteArray(8192)
            var total = 0
            source.use { input ->
                while (true) {
                    if (call.isCanceled()) return
                    val n = input.read(buf)
                    if (n < 0) break
                    total += n
                    if (total > 4_000_000) {
                        call.cancel()
                        calls.remove(id)
                        end(id, "That response was too large for this phone.")
                        return
                    }
                    val slice = buf.copyOf(n)
                    val payload = Base64.encodeToString(slice, Base64.NO_WRAP)
                    emit("window.__kilnChunk&&window.__kilnChunk(${js(id)},${js(payload)})")
                }
            }
            calls.remove(id)
            end(id, "")
        }
    }

    private fun end(id: String, message: String) {
        calls.remove(id)
        val encoded = if (message.isEmpty()) "" else b64(message)
        emit("window.__kilnEnd&&window.__kilnEnd(${js(id)},${js(encoded)})")
    }

    private fun emit(script: String) {
        webView.post {
            runCatching { webView.evaluateJavascript(script, null) }
        }
    }

    private fun blocked(host: String): Boolean {
        val name = host.lowercase().trim().removePrefix("[").removeSuffix("]")
        if (name.isBlank() || name == "localhost" || name.endsWith(".local") || name.endsWith(".internal")) return true
        if (name in KNOWN) return false
        if (name == "0.0.0.0" || name == "::1" || name == "::") return true
        val literal = name.matches(IPV4) || name.contains(":")
        val address = if (literal) {
            runCatching { InetAddress.getByName(name) }.getOrNull() ?: return true
        } else {
            runCatching { InetAddress.getByName(name) }.getOrNull() ?: return true
        }
        return address.isAnyLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress || address.isSiteLocalAddress
    }

    private fun b64(value: String): String = Base64.encodeToString(value.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)

    private fun js(value: String): String = "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"

    companion object {
        private val ID = Regex("^[A-Za-z0-9]{6,40}$")
        private val IPV4 = Regex("""^\d{1,3}(\.\d{1,3}){3}$""")
        private val ALLOWED_HEADERS = setOf(
            "authorization",
            "content-type",
            "accept",
            "x-api-key",
            "anthropic-version",
            "x-goog-api-key",
            "model",
            "http-referer",
            "x-title",
        )
        private val KNOWN = setOf(
            "api.openai.com",
            "api.anthropic.com",
            "generativelanguage.googleapis.com",
            "api.groq.com",
            "api.deepseek.com",
            "api.x.ai",
            "api.mistral.ai",
            "openrouter.ai",
            "api.elevenlabs.io",
            "api.fish.audio",
        )
    }
}
