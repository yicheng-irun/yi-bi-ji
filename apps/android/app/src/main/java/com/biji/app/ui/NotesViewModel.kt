package com.biji.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.biji.app.data.BijiApi
import com.biji.app.data.NoteDto
import com.biji.app.data.Settings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class NotesViewModel(
    private val api: BijiApi,
    private val settings: Settings,
) : ViewModel() {
    private val _notes = MutableStateFlow<List<NoteDto>>(emptyList())
    val notes: StateFlow<List<NoteDto>> = _notes

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun refresh() {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            try {
                _notes.value = api.listNotes(settings.baseUrl.first())
            } catch (e: Exception) {
                _error.value = e.message ?: "加载失败"
            } finally {
                _loading.value = false
            }
        }
    }

    fun createNote(onCreated: (Int) -> Unit) {
        viewModelScope.launch {
            try {
                val note = api.createNote(settings.baseUrl.first())
                refresh()
                onCreated(note.id)
            } catch (e: Exception) {
                _error.value = e.message ?: "创建失败"
            }
        }
    }

    fun clearError() {
        _error.value = null
    }
}
