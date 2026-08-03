package com.biji.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.biji.app.data.BijiApi
import com.biji.app.data.ChatEvent
import com.biji.app.data.Settings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChatMessageUi(
    val role: String,
    val text: String,
    val streaming: Boolean = false,
)

class ChatViewModel(
    private val api: BijiApi,
    private val settings: Settings,
) : ViewModel() {
    private val _messages = MutableStateFlow<List<ChatMessageUi>>(emptyList())
    val messages: StateFlow<List<ChatMessageUi>> = _messages

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy

    val open = MutableStateFlow(false)

    private var threadId: String? = null

    fun send(text: String, noteId: Int?) {
        if (text.isBlank() || _busy.value) return
        viewModelScope.launch {
            _busy.value = true
            _messages.update { it + ChatMessageUi("user", text) }
            _messages.update { it + ChatMessageUi("assistant", "", streaming = true) }
            try {
                val base = settings.baseUrl.first()
                val tid = threadId ?: api.createThread(base, noteId).id.also { threadId = it }
                api.streamChat(base, tid, text).collect { event ->
                    when (event) {
                        is ChatEvent.Delta -> appendDelta(event.text)
                        is ChatEvent.Done -> finishStreaming()
                        is ChatEvent.Error -> {
                            appendDelta("\n[错误] ${event.message}")
                            finishStreaming()
                        }
                    }
                }
            } catch (e: Exception) {
                appendDelta("\n[错误] ${e.message ?: "请求失败"}")
                finishStreaming()
            } finally {
                _busy.value = false
            }
        }
    }

    private fun appendDelta(delta: String) {
        _messages.update { list ->
            if (list.isEmpty()) list
            else list.dropLast(1) + list.last().copy(text = list.last().text + delta)
        }
    }

    private fun finishStreaming() {
        _messages.update { list ->
            if (list.isEmpty()) list
            else list.dropLast(1) + list.last().copy(streaming = false)
        }
    }
}
