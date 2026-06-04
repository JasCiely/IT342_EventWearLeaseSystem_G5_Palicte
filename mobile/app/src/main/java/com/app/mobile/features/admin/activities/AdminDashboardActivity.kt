package com.app.mobile.features.admin.activities

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.app.mobile.R
import com.app.mobile.databinding.ActivityAdminDashboardBinding
import com.app.mobile.features.admin.fragments.BookingsFragment
import com.app.mobile.features.admin.fragments.DashboardFragment
import com.app.mobile.features.admin.fragments.InventoryFragment
import com.app.mobile.features.admin.fragments.MoreFragment
import com.app.mobile.features.auth.activities.Auth
import com.app.mobile.shared.sse.SseClient
import com.app.mobile.shared.utils.SessionManager

class AdminDashboardActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAdminDashboardBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAdminDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (savedInstanceState == null) {
            loadFragment(DashboardFragment())
        }

        binding.bottomNav.setOnItemSelectedListener { item ->
            val fragment: Fragment = when (item.itemId) {
                R.id.nav_dashboard  -> DashboardFragment()
                R.id.nav_bookings   -> BookingsFragment()
                R.id.nav_inventory  -> InventoryFragment()
                R.id.nav_more       -> MoreFragment()
                else                -> DashboardFragment()
            }
            loadFragment(fragment)
            true
        }

        SseClient.connect()
    }

    private fun loadFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragmentContainer, fragment)
            .commit()
    }

    fun navigateTo(navItemId: Int) {
        binding.bottomNav.selectedItemId = navItemId
    }

    fun showSessionExpiredDialog() {
        if (isFinishing || isDestroyed) return
        SessionManager.clearSession(this)
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.session_expired_title))
            .setMessage(getString(R.string.session_expired_message))
            .setCancelable(false)
            .setPositiveButton(getString(R.string.okay)) { _, _ -> goToAuth() }
            .show()
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
        SseClient.disconnect()
    }
}
