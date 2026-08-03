package com.biji.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.biji.app.data.ApiException
import com.biji.app.data.BijiApi
import com.biji.app.data.NoteDto
import com.biji.app.data.Settings
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@OptIn(FlowPreview::class)
class NoteEditorViewModel(
    private val api: BijiApi,
    private val settings: Settings,
    private val noteId: Int,
) : ViewModel() {
    private val _note = MutableStateFlow<NoteDto?>(null)
    val note: StateFlow<NoteDto?> = _note

    val title = MutableStateFlow("")
    val content = MutableStateFlow("")

    private val _saving = MutableStateFlow(false)
    val saving: StateFlow<Boolean> = _saving

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message

    private var loaded = false

    init {
        viewModelScope.launch {
            load()
            kotlinx.coroutines.flow.merge(title, content)
                .debounce(1000)
                .collect { if (loaded) save() }
        }
    }

    suspend fun load() {
        try {
            val n = api.getNote(settings.baseUrl.first(), noteId)
            _note.value = n
            title.value = n.draftTitle
            content.value = n.draftContent
            loaded = true
        } catch (e: Exception) {
            _message.value = e.message ?: "加载失败"
        }
    }

    fun save() {
        val n = _note.value ?: return
        if (title.value == n.draftTitle && content.value == n.draftContent) return
        viewModelScope.launch {
            _saving.value = true
            try {
                val updated = api.saveDraft(
                    settings.baseUrl.first(),
                    noteId,
                    title.value,
                    content.value,
                    n.draftTitleVersion,
                    n.draftContentVersion,
                )
                _note.value = updated
            } catch (e: ApiException) {
                if (e.code == 409) {
                    _message.value = "草稿被别处修改，已刷新为最新版本"
                    load()
                } else {
                    _message.value = e.message
                }
            } catch (e: Exception) {
                _message.value = e.message ?: "保存失败"
            } finally {
                _saving.value = false
            }
        }
    }

    fun commit() {
        viewModelScope.launch {
            try {
                save()
                _note.value = api.commitNote(settings.baseUrl.first(), noteId)
                _message.value = "已提交"
            } catch (e: Exception) {
                _message.value = e.message ?: "提交失败"
            }
        }
    }

    fun clearMessage() {
        _message.value = null
    }
}
