package com.app.mobile.features.customer.activities

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.R
import com.app.mobile.features.auth.activities.Auth
import com.app.mobile.features.customer.fragments.*
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.sse.SseClient
import com.app.mobile.shared.utils.SessionManager
import kotlinx.coroutines.launch

class DashboardActivity : AppCompatActivity(), SseClient.SseListener {

    private lateinit var tvHeaderTitle: TextView
    private lateinit var tvHeaderSubtitle: TextView
    private lateinit var tvHeaderInitials: TextView

    private lateinit var navBrowse: LinearLayout
    private lateinit var navMyBookings: LinearLayout
    private lateinit var navNotifications: LinearLayout
    private lateinit var navProfile: LinearLayout

    private lateinit var tvNavBrowse: TextView
    private lateinit var tvNavBookings: TextView
    private lateinit var tvNavNotifications: TextView
    private lateinit var tvNavProfile: TextView

    private lateinit var ivNavBrowse: ImageView
    private lateinit var ivNavBookings: ImageView
    private lateinit var ivNavNotifications: ImageView
    private lateinit var ivNavProfile: ImageView

    private lateinit var tvAlertBadge: TextView

    private var activeTab = "Browse"

    // Newest createdAt string from the last badge refresh — kept in memory
    private var latestAlertTs = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dashboard)

        tvHeaderTitle      = findViewById(R.id.tvHeaderTitle)
        tvHeaderSubtitle   = findViewById(R.id.tvHeaderSubtitle)
        tvHeaderInitials   = findViewById(R.id.tvHeaderInitials)

        navBrowse          = findViewById(R.id.navBrowse)
        navMyBookings      = findViewById(R.id.navMyBookings)
        navNotifications   = findViewById(R.id.navNotifications)
        navProfile         = findViewById(R.id.navProfile)

        tvNavBrowse        = findViewById(R.id.tvNavBrowse)
        tvNavBookings      = findViewById(R.id.tvNavBookings)
        tvNavNotifications = findViewById(R.id.tvNavNotifications)
        tvNavProfile       = findViewById(R.id.tvNavProfile)

        ivNavBrowse        = findViewById(R.id.ivNavBrowse)
        ivNavBookings      = findViewById(R.id.ivNavBookings)
        ivNavNotifications = findViewById(R.id.ivNavNotifications)
        ivNavProfile       = findViewById(R.id.ivNavProfile)

        tvAlertBadge       = findViewById(R.id.tvAlertBadge)

        val firstName = SessionManager.getFirstName(this) ?: "U"
        val lastName  = SessionManager.getLastName(this) ?: ""
        tvHeaderInitials.text = "${firstName.firstOrNull() ?: ""}${lastName.firstOrNull() ?: ""}".uppercase()

        navBrowse.setOnClickListener        { setActiveTab("Browse") }
        navMyBookings.setOnClickListener    { setActiveTab("MyBookings") }
        navNotifications.setOnClickListener { setActiveTab("Notifications") }
        navProfile.setOnClickListener       { setActiveTab("Profile") }

        if (savedInstanceState == null) setActiveTab("Browse")

        SseClient.connect()
        SseClient.addListener(this)
    }

    override fun onEvent(type: String, data: String) {
        if (type == "BOOKING_UPDATE") refreshAlertBadge()
    }

    fun setActiveTab(tab: String) {
        activeTab = tab

        // Opening Alerts → mark everything seen and clear the badge immediately
        if (tab == "Notifications") {
            saveLastSeenTs(latestAlertTs)
            showAlertBadge(0)
        }

        val burgundy = ContextCompat.getColor(this, R.color.brand_burgundy)
        val subtle   = ContextCompat.getColor(this, R.color.brand_text_subtitle)

        listOf(tvNavBrowse, tvNavBookings, tvNavNotifications, tvNavProfile).forEach {
            it.setTextColor(subtle)
            it.paint.isFakeBoldText = false
        }
        listOf(ivNavBrowse, ivNavBookings, ivNavNotifications, ivNavProfile).forEach {
            it.imageTintList = android.content.res.ColorStateList.valueOf(subtle)
        }

        fun activate(tv: TextView, iv: ImageView) {
            tv.setTextColor(burgundy)
            tv.paint.isFakeBoldText = true
            iv.imageTintList = android.content.res.ColorStateList.valueOf(burgundy)
        }

        val (title, subtitle, fragment) = when (tab) {
            "Browse"        -> Triple("Browse Collection", "Find your perfect outfit",    CustomerBrowseFragment() as Fragment)
            "MyBookings"    -> Triple("My Bookings",       "Track your reservations",     CustomerMyBookingsFragment())
            "Notifications" -> Triple("Notifications",     "Stay up to date",             CustomerNotificationsFragment())
            "Profile"       -> Triple("My Profile",        "Manage your account",         CustomerProfileFragment())
            else            -> Triple("Browse Collection", "Find your perfect outfit",    CustomerBrowseFragment())
        }

        tvHeaderTitle.text    = title
        tvHeaderSubtitle.text = subtitle

        when (tab) {
            "Browse"        -> activate(tvNavBrowse, ivNavBrowse)
            "MyBookings"    -> activate(tvNavBookings, ivNavBookings)
            "Notifications" -> activate(tvNavNotifications, ivNavNotifications)
            "Profile"       -> activate(tvNavProfile, ivNavProfile)
        }

        supportFragmentManager.beginTransaction()
            .replace(R.id.fragmentContainer, fragment)
            .commit()
    }

    fun goToMyBookings() = setActiveTab("MyBookings")

    /**
     * Called by CustomerNotificationsFragment once it finishes loading.
     * [newest] is the largest createdAt string from the response.
     * Saves it as last-seen since the user is actively viewing the tab.
     */
    fun onAlertsLoaded(newest: String) {
        latestAlertTs = newest
        saveLastSeenTs(newest)
        showAlertBadge(0)
    }

    // Fetches alerts in the background and updates the badge count.
    private fun refreshAlertBadge() {
        if (!SessionManager.isLoggedIn(this)) return
        lifecycleScope.launch {
            try {
                val fittings = ApiClient.customerApi.getMyFittingBookings(ApiClient.bearerToken())
                val directs  = ApiClient.customerApi.getAllMyDirectBookings(ApiClient.bearerToken())

                val allTs = fittings.map { it.createdAt } + directs.map { it.createdAt }
                if (allTs.isEmpty()) {
                    showAlertBadge(0)
                    return@launch
                }

                val newest   = allTs.max()
                latestAlertTs = newest

                val lastSeen = getLastSeenTs()
                val unseen   = allTs.count { it > lastSeen }

                if (activeTab != "Notifications") showAlertBadge(unseen)
            } catch (_: Exception) {}
        }
    }

    fun showAlertBadge(count: Int) {
        if (count <= 0) {
            tvAlertBadge.visibility = View.GONE
        } else {
            tvAlertBadge.text       = if (count > 9) "9+" else count.toString()
            tvAlertBadge.visibility = View.VISIBLE
        }
    }

    private fun saveLastSeenTs(ts: String) {
        if (ts.isBlank()) return
        getSharedPreferences("alert_prefs", MODE_PRIVATE)
            .edit().putString("last_seen_ts", ts).apply()
    }

    private fun getLastSeenTs(): String =
        getSharedPreferences("alert_prefs", MODE_PRIVATE)
            .getString("last_seen_ts", "") ?: ""

    fun showSessionExpiredDialog() {
        if (isFinishing || isDestroyed) return
        SessionManager.clearSession(this)
        AlertDialog.Builder(this)
            .setTitle("Session Expired")
            .setMessage("Your session has expired. Please sign in again.")
            .setCancelable(false)
            .setPositiveButton("Sign In") { _, _ -> goToAuth() }
            .show()
    }

    override fun onResume() {
        super.onResume()
        if (!SessionManager.isLoggedIn(this)) goToAuth()
        else refreshAlertBadge()
    }

    private fun goToAuth() {
        SseClient.disconnect()
        startActivity(Intent(this, Auth::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        SseClient.removeListener(this)
        SseClient.disconnect()
    }
}
