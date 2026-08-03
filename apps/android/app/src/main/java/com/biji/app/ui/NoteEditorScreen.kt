package com.biji.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteEditorScreen(
    vm: NoteEditorViewModel,
    onBack: () -> Unit,
) {
    val note by vm.note.collectAsState()
    val title by vm.title.collectAsState()
    val content by vm.content.collectAsState()
    val saving by vm.saving.collectAsState()
    val message by vm.message.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(message) { message?.let { snackbar.showSnackbar(it); vm.clearMessage() } }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (saving) "保存中…" else if (note?.hasChanges == true) "编辑草稿（未提交）" else "编辑草稿") },
                navigationIcon = {
                    IconButton(onClick = { vm.save(); onBack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                actions = {
                    IconButton(onClick = { vm.commit() }) {
                        Icon(Icons.Default.Check, contentDescription = "提交")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            val fieldColors = TextFieldDefaults.colors(
                focusedContainerColor = Color.Transparent,
                unfocusedContainerColor = Color.Transparent,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
            )
            TextField(
                value = title,
                onValueChange = { vm.title.value = it },
                placeholder = { Text("标题") },
                textStyle = MaterialTheme.typography.titleLarge,
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth(),
            )
            TextField(
                value = content,
                onValueChange = { vm.content.value = it },
                placeholder = { Text("正文…") },
                textStyle = MaterialTheme.typography.bodyLarge,
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
