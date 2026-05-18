package com.app.mobile

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.NestedScrollView
import com.google.android.material.button.MaterialButton

class GuestDashboardActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_guest_dashboard)

        // ── Views ─────────────────────────────────────────────────────
        val scrollView             = findViewById<NestedScrollView>(R.id.scrollView)
        val btnBrowseOutfits       = findViewById<MaterialButton>(R.id.btnBrowseOutfits)
        val btnHeaderSignIn        = findViewById<MaterialButton>(R.id.btnHeaderSignIn)
        val btnCreateAccountBanner = findViewById<MaterialButton>(R.id.btnCreateAccountBanner)
        val btnBookOutfit1         = findViewById<MaterialButton>(R.id.btnBookOutfit1)
        val btnBookOutfit2         = findViewById<MaterialButton>(R.id.btnBookOutfit2)
        val btnBookOutfit3         = findViewById<MaterialButton>(R.id.btnBookOutfit3)
        val btnCreateAccountCta    = findViewById<MaterialButton>(R.id.btnCreateAccountCta)
        val btnSignInCta           = findViewById<MaterialButton>(R.id.btnSignInCta)
        val sectionPopularPicks    = findViewById<android.view.View>(R.id.sectionPopularPicks)

        // ── Helpers ───────────────────────────────────────────────────
        fun goToSignIn() {
            val intent = Intent(this, Auth::class.java)
            intent.putExtra("TAB", "signin")
            startActivity(intent)
            finish()
        }

        fun goToRegister() {
            val intent = Intent(this, Auth::class.java)
            intent.putExtra("TAB", "register")
            startActivity(intent)
            finish()
        }

        // ── Browse Outfits → smooth scroll to Popular Picks ───────────
        btnBrowseOutfits.setOnClickListener {
            scrollView.smoothScrollTo(0, sectionPopularPicks.top)
        }

        // ── Header Sign In ────────────────────────────────────────────
        btnHeaderSignIn.setOnClickListener { goToSignIn() }

        // ── Banner Create Account ─────────────────────────────────────
        btnCreateAccountBanner.setOnClickListener { goToRegister() }

        // ── SIGN IN TO BOOK — all route to Sign In ────────────────────
        btnBookOutfit1.setOnClickListener { goToSignIn() }
        btnBookOutfit2.setOnClickListener { goToSignIn() }
        btnBookOutfit3.setOnClickListener { goToSignIn() }

        // ── Bottom CTA ────────────────────────────────────────────────
        btnCreateAccountCta.setOnClickListener { goToRegister() }
        btnSignInCta.setOnClickListener { goToSignIn() }
    }
}