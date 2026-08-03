package com.biji.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Face
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.biji.app.data.BijiApi
import com.biji.app.data.Settings
import com.biji.app.ui.ChatPanel
import com.biji.app.ui.ChatViewModel
import com.biji.app.ui.NoteEditorScreen
import com.biji.app.ui.NoteEditorViewModel
import com.biji.app.ui.NotesListScreen
import com.biji.app.ui.NotesViewModel
import com.biji.app.ui.SettingsScreen

class MainActivity : ComponentActivity() {
    private val api = BijiApi()
    private lateinit var settings: Settings

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = Settings(applicationContext)
        enableEdgeToEdge()

        setContent {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) {
                    val nav = rememberNavController()
                    val notesVm: NotesViewModel = viewModel(factory = factory { NotesViewModel(api, settings) })
                    val chatVm: ChatViewModel = viewModel(factory = factory { ChatViewModel(api, settings) })
                    val chatOpen by chatVm.open.collectAsState()
                    val backStack by nav.currentBackStackEntryAsState()
                    val currentNoteId = backStack?.arguments?.getInt("noteId")

                    Box(Modifier.fillMaxSize()) {
                        NavHost(navController = nav, startDestination = "notes") {
                            composable("notes") {
                                NotesListScreen(
                                    vm = notesVm,
                                    onOpenNote = { nav.navigate("note/$it") },
                                    onOpenSettings = { nav.navigate("settings") },
                                )
                            }
                            composable(
                                "note/{noteId}",
                                arguments = listOf(navArgument("noteId") { type = NavType.IntType }),
                            ) { entry ->
                                val noteId = entry.arguments!!.getInt("noteId")
                                val editorVm: NoteEditorViewModel = viewModel(
                                    key = "note-$noteId",
                                    factory = factory { NoteEditorViewModel(api, settings, noteId) },
                                )
                                NoteEditorScreen(vm = editorVm, onBack = { nav.popBackStack() })
                            }
                            composable("settings") {
                                SettingsScreen(settings = settings, onBack = { nav.popBackStack() })
                            }
                        }

                        if (!chatOpen) {
                            FloatingActionButton(
                                onClick = { chatVm.open.value = true },
                                modifier = Modifier
                                    .align(Alignment.CenterEnd)
                                    .padding(end = 4.dp),
                            ) {
                                Icon(Icons.Default.Face, contentDescription = "Agent")
                            }
                        }
                        ChatPanel(vm = chatVm, currentNoteId = currentNoteId)
                    }
                }
            }
        }
    }

    private fun <T : ViewModel> factory(create: () -> T) = object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <M : ViewModel> create(modelClass: Class<M>): M = create() as M
    }
}
