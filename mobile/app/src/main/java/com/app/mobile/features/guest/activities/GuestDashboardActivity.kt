package com.app.mobile.features.guest.activities

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.NestedScrollView
import com.app.mobile.R
import com.app.mobile.features.auth.activities.Auth
import com.google.android.material.button.MaterialButton

class GuestDashboardActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_guest_dashboard)

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

        btnBrowseOutfits.setOnClickListener {
            scrollView.smoothScrollTo(0, sectionPopularPicks.top)
        }

        btnHeaderSignIn.setOnClickListener { goToSignIn() }

        btnCreateAccountBanner.setOnClickListener { goToRegister() }

        btnBookOutfit1.setOnClickListener { goToSignIn() }
        btnBookOutfit2.setOnClickListener { goToSignIn() }
        btnBookOutfit3.setOnClickListener { goToSignIn() }

        btnCreateAccountCta.setOnClickListener { goToRegister() }
        btnSignInCta.setOnClickListener { goToSignIn() }
    }
}
