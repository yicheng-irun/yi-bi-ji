package com.biji.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "settings")

class Settings(private val context: Context) {
    private val keyBaseUrl = stringPreferencesKey("base_url")

    val baseUrl: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[keyBaseUrl] ?: DEFAULT_BASE_URL
    }

    suspend fun setBaseUrl(url: String) {
        context.dataStore.edit { it[keyBaseUrl] = url.trim().trimEnd('/') }
    }

    companion object {
        const val DEFAULT_BASE_URL = "http://10.0.2.2:15201"
    }
}
