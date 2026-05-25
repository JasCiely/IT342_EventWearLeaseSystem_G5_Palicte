package com.app.mobile.features.customer.activities

import android.content.Intent
import android.os.Bundle
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.app.mobile.R
import com.app.mobile.features.auth.activities.Auth
import com.app.mobile.features.customer.fragments.*
import com.app.mobile.shared.utils.SessionManager

class DashboardActivity : AppCompatActivity() {

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

    private var activeTab = "Browse"

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

        val firstName = SessionManager.getFirstName(this) ?: "U"
        val lastName  = SessionManager.getLastName(this) ?: ""
        tvHeaderInitials.text = "${firstName.firstOrNull() ?: ""}${lastName.firstOrNull() ?: ""}".uppercase()

        navBrowse.setOnClickListener        { setActiveTab("Browse") }
        navMyBookings.setOnClickListener    { setActiveTab("MyBookings") }
        navNotifications.setOnClickListener { setActiveTab("Notifications") }
        navProfile.setOnClickListener       { setActiveTab("Profile") }

        if (savedInstanceState == null) setActiveTab("Browse")
    }

    fun setActiveTab(tab: String) {
        activeTab = tab

        val burgundy  = ContextCompat.getColor(this, R.color.brand_burgundy)
        val subtle    = ContextCompat.getColor(this, R.color.brand_text_subtitle)

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
    }

    private fun goToAuth() {
        startActivity(Intent(this, Auth::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }
}
