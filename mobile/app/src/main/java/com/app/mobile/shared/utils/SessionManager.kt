package com.app.mobile.shared.utils

import android.content.Context

object SessionManager {

    private const val PREF_NAME      = "auth_prefs"
    private const val KEY_TOKEN      = "token"
    private const val KEY_USER_ID    = "user_id"
    private const val KEY_FIRST_NAME = "first_name"
    private const val KEY_LAST_NAME  = "last_name"
    private const val KEY_EMAIL      = "email"
    private const val KEY_ROLE       = "role"
    private const val KEY_PHONE      = "phone"

    fun saveUser(
        context: Context,
        token: String,
        firstName: String,
        lastName: String,
        email: String,
        role: String,
        userId: String = "",
        phone: String = ""
    ) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER_ID, userId)
            .putString(KEY_FIRST_NAME, firstName)
            .putString(KEY_LAST_NAME, lastName)
            .putString(KEY_EMAIL, email)
            .putString(KEY_ROLE, role)
            .putString(KEY_PHONE, phone)
            .apply()
    }

    fun isLoggedIn(context: Context): Boolean = !getToken(context).isNullOrEmpty()

    fun getToken(context: Context): String? =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getString(KEY_TOKEN, null)

    fun getUserId(context: Context): String? =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getString(KEY_USER_ID, null)

    fun getFirstName(context: Context): String? =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getString(KEY_FIRST_NAME, null)

    fun getLastName(context: Context): String? =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getString(KEY_LAST_NAME, null)

    fun getEmail(context: Context): String? =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getString(KEY_EMAIL, null)

    fun getRole(context: Context): String? =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getString(KEY_ROLE, null)

    fun getPhone(context: Context): String? =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).getString(KEY_PHONE, null)

    fun isAdmin(context: Context) = getRole(context) == "ADMIN"

    fun clearSession(context: Context) {
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
