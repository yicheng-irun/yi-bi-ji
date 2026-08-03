package com.biji.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.io.IOException
import java.util.concurrent.TimeUnit

@Serializable
data class NoteDto(
    val id: Int,
    val committedTitle: String = "",
    val committedContent: String = "",
    val draftTitle: String = "",
    val draftContent: String = "",
    val draftContentVersion: Int = 1,
    val draftTitleVersion: Int = 1,
    val tags: List<String> = emptyList(),
    val hasChanges: Boolean = false,
    val updatedAt: String? = null,
)

@Serializable
data class ThreadDto(val id: String, val title: String = "")

class ApiException(val code: Int, message: String) : IOException(message)

sealed interface ChatEvent {
    data class Delta(val text: String) : ChatEvent
    data object Done : ChatEvent
    data class Error(val message: String) : ChatEvent
}

class BijiApi {
    private val json = Json { ignoreUnknownKeys = true }
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private val sseFactory = EventSources.createFactory(client)
    private val jsonType = "application/json; charset=utf-8".toMediaType()

    private fun url(base: String, path: String) = "${base.trimEnd('/')}/api$path"

    private fun Request.Builder.execute(): Response =
        client.newCall(build()).execute().also { resp ->
            if (!resp.isSuccessful) {
                val body = resp.body?.string().orEmpty()
                resp.close()
                throw ApiException(resp.code, "HTTP ${resp.code}: $body")
            }
        }

    private inline fun <reified T> Response.parse(): T =
        json.decodeFromString(body!!.string())

    suspend fun listNotes(base: String): List<NoteDto> = withContext(Dispatchers.IO) {
        Request.Builder().url(url(base, "/notes")).get().execute().parse()
    }

    suspend fun getNote(base: String, id: Int): NoteDto = withContext(Dispatchers.IO) {
        Request.Builder().url(url(base, "/notes/$id")).get().execute().parse()
    }

    suspend fun createNote(base: String): NoteDto = withContext(Dispatchers.IO) {
        Request.Builder().url(url(base, "/notes"))
            .post("""{"title":"未命名","content":""}""".toRequestBody(jsonType))
            .execute().parse()
    }

    suspend fun saveDraft(
        base: String,
        id: Int,
        title: String,
        content: String,
        baseTitleVersion: Int,
        baseContentVersion: Int,
    ): NoteDto = withContext(Dispatchers.IO) {
        val body = json.encodeToString(
            JsonObject.serializer(),
            JsonObject(
                mapOf(
                    "draftTitle" to kotlinx.serialization.json.JsonPrimitive(title),
                    "draftContent" to kotlinx.serialization.json.JsonPrimitive(content),
                    "baseTitleVersion" to kotlinx.serialization.json.JsonPrimitive(baseTitleVersion),
                    "baseContentVersion" to kotlinx.serialization.json.JsonPrimitive(baseContentVersion),
                ),
            ),
        )
        Request.Builder().url(url(base, "/notes/$id/draft"))
            .put(body.toRequestBody(jsonType))
            .execute().parse()
    }

    suspend fun commitNote(base: String, id: Int): NoteDto = withContext(Dispatchers.IO) {
        Request.Builder().url(url(base, "/notes/$id/commit"))
            .post("{}".toRequestBody(jsonType))
            .execute().parse()
    }

    suspend fun createThread(base: String, noteId: Int?): ThreadDto = withContext(Dispatchers.IO) {
        val body = if (noteId != null) """{"noteId":$noteId}""" else "{}"
        Request.Builder().url(url(base, "/chat/threads"))
            .post(body.toRequestBody(jsonType))
            .execute().parse()
    }

    fun streamChat(base: String, threadId: String, message: String): Flow<ChatEvent> = callbackFlow {
        val escaped = kotlinx.serialization.json.JsonPrimitive(message).toString()
        val request = Request.Builder()
            .url(url(base, "/chat/threads/$threadId/stream"))
            .post("""{"message":$escaped}""".toRequestBody(jsonType))
            .build()

        val listener = object : EventSourceListener() {
            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                try {
                    val obj = json.parseToJsonElement(data) as? JsonObject ?: return
                    when (obj["type"]?.jsonPrimitive?.content) {
                        "text-delta" -> trySend(ChatEvent.Delta(obj["delta"]!!.jsonPrimitive.content))
                        "finish" -> {
                            trySend(ChatEvent.Done)
                            close()
                        }
                        "error" -> {
                            trySend(ChatEvent.Error(obj["errorText"]?.jsonPrimitive?.content ?: "unknown error"))
                            close()
                        }
                    }
                } catch (_: Exception) {
                }
            }

            override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
                if (t != null) trySend(ChatEvent.Error(t.message ?: "network error"))
                else trySend(ChatEvent.Error("HTTP ${response?.code ?: "?"}"))
                close(t)
            }

            override fun onClosed(eventSource: EventSource) {
                trySend(ChatEvent.Done)
                close()
            }
        }

        val eventSource = sseFactory.newEventSource(request, listener)
        awaitClose { eventSource.cancel() }
    }
}
