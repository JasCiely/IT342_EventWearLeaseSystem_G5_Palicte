package com.app.mobile

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.NestedScrollView
import com.google.android.material.button.MaterialButton

class DashboardActivity : AppCompatActivity() {

    private var activeTab = "Overview"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dashboard)

        val firstName = SessionManager.getFirstName(this) ?: "User"

        val tvWelcome         = findViewById<TextView>(R.id.tvWelcome)
        val tvSubtitle        = findViewById<TextView>(R.id.tvHeaderSubtitle)
        val btnBrowseOutfits  = findViewById<MaterialButton>(R.id.btnBrowseOutfits)
        val btnLogout         = findViewById<MaterialButton>(R.id.btnLogout)

        val navOverview       = findViewById<LinearLayout>(R.id.navOverview)
        val navMyBookings     = findViewById<LinearLayout>(R.id.navMyBookings)
        val navNotifications  = findViewById<LinearLayout>(R.id.navNotifications)
        val navProfile        = findViewById<LinearLayout>(R.id.navProfile)

        val tvNavOverview      = findViewById<TextView>(R.id.tvNavOverview)
        val tvNavBookings      = findViewById<TextView>(R.id.tvNavBookings)
        val tvNavNotifications = findViewById<TextView>(R.id.tvNavNotifications)
        val tvNavProfile       = findViewById<TextView>(R.id.tvNavProfile)

        val layoutOverview      = findViewById<LinearLayout>(R.id.layoutOverview)
        val layoutMyBookings    = findViewById<LinearLayout>(R.id.layoutMyBookings)
        val layoutNotifications = findViewById<LinearLayout>(R.id.layoutNotifications)
        val layoutProfile       = findViewById<LinearLayout>(R.id.layoutProfile)

        val tvProfileName     = findViewById<TextView>(R.id.tvProfileName)
        val tvProfileEmail    = findViewById<TextView>(R.id.tvProfileEmail)
        val tvProfileRole     = findViewById<TextView>(R.id.tvProfileRole)
        val tvProfileInitials = findViewById<TextView>(R.id.tvProfileInitials)

        val scrollView          = findViewById<NestedScrollView>(R.id.scrollView)
        val sectionPopularPicks = findViewById<View>(R.id.sectionPopularPicks)

        tvWelcome.text  = "Welcome back, $firstName!"
        tvSubtitle.text = "Manage your bookings and explore new outfits."

        val lastName = SessionManager.getLastName(this) ?: ""
        val email    = SessionManager.getEmail(this) ?: ""
        val role     = SessionManager.getRole(this) ?: "USER"
        val initials = "${firstName.firstOrNull() ?: ""}${lastName.firstOrNull() ?: ""}".uppercase()

        tvProfileName.text     = "$firstName $lastName"
        tvProfileEmail.text    = email
        tvProfileRole.text     = role
        tvProfileInitials.text = initials

        fun setActiveTab(tab: String) {
            activeTab = tab
            layoutOverview.visibility      = View.GONE
            layoutMyBookings.visibility    = View.GONE
            layoutNotifications.visibility = View.GONE
            layoutProfile.visibility       = View.GONE

            listOf(tvNavOverview, tvNavBookings, tvNavNotifications, tvNavProfile).forEach {
                it.setTextColor(getColor(R.color.brand_text_subtitle))
                it.paint.isFakeBoldText = false
            }
            listOf(navOverview, navMyBookings, navNotifications, navProfile).forEach {
                it.setBackgroundColor(android.graphics.Color.TRANSPARENT)
            }

            when (tab) {
                "Overview" -> {
                    layoutOverview.visibility = View.VISIBLE
                    tvNavOverview.setTextColor(getColor(R.color.brand_burgundy))
                    tvNavOverview.paint.isFakeBoldText = true
                    navOverview.setBackgroundResource(R.drawable.bg_nav_active)
                }
                "MyBookings" -> {
                    layoutMyBookings.visibility = View.VISIBLE
                    tvNavBookings.setTextColor(getColor(R.color.brand_burgundy))
                    tvNavBookings.paint.isFakeBoldText = true
                    navMyBookings.setBackgroundResource(R.drawable.bg_nav_active)
                }
                "Notifications" -> {
                    layoutNotifications.visibility = View.VISIBLE
                    tvNavNotifications.setTextColor(getColor(R.color.brand_burgundy))
                    tvNavNotifications.paint.isFakeBoldText = true
                    navNotifications.setBackgroundResource(R.drawable.bg_nav_active)
                }
                "Profile" -> {
                    layoutProfile.visibility = View.VISIBLE
                    tvNavProfile.setTextColor(getColor(R.color.brand_burgundy))
                    tvNavProfile.paint.isFakeBoldText = true
                    navProfile.setBackgroundResource(R.drawable.bg_nav_active)
                }
            }
        }

        navOverview.setOnClickListener      { setActiveTab("Overview") }
        navMyBookings.setOnClickListener    { setActiveTab("MyBookings") }
        navNotifications.setOnClickListener { setActiveTab("Notifications") }
        navProfile.setOnClickListener       { setActiveTab("Profile") }

        btnBrowseOutfits.setOnClickListener {
            setActiveTab("Overview")
            scrollView.post { scrollView.smoothScrollTo(0, sectionPopularPicks.top) }
        }

        btnLogout.setOnClickListener {
            val token = SessionManager.getToken(this)
            AuthRepository.logout(
                token = token,
                onSuccess = {
                    runOnUiThread { clearSessionAndGoToAuth() }
                },
                onError = {
                    // Even on error, clear local session and go to Auth
                    runOnUiThread { clearSessionAndGoToAuth() }
                }
            )
        }

        setActiveTab("Overview")
    }

    override fun onResume() {
        super.onResume()
        // Redirect to login if session was cleared (e.g., by session expiry handler)
        if (!SessionManager.isLoggedIn(this)) {
            clearSessionAndGoToAuth()
        }
    }

    // ── Called from anywhere when the API returns 401 ──────────────────────────
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

    private fun clearSessionAndGoToAuth() {
        SessionManager.clearSession(this)
        goToAuth()
    }

    private fun goToAuth() {
        startActivity(Intent(this, Auth::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }
}
