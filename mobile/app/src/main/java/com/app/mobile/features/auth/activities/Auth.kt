package com.app.mobile.features.auth.activities

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.method.HideReturnsTransformationMethod
import android.text.method.PasswordTransformationMethod
import android.util.Patterns
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import com.app.mobile.R
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.features.auth.repositories.AuthRepository
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.features.guest.activities.GuestDashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.utils.LocalCallbackServer
import com.app.mobile.shared.utils.SessionManager
import com.google.android.material.button.MaterialButton

class Auth : AppCompatActivity() {

    private var isSignInPasswordVisible  = false
    private var isRegPasswordVisible     = false
    private var isConfirmPasswordVisible = false

    private val PASSWORD_PATTERN = Regex("^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#\$%^&+=!])(?=\\S+\$).{8,}\$")
    private val NAME_PATTERN     = Regex("^[a-zA-Z\\s]+\$")

    private var googleServer: LocalCallbackServer? = null
    private var isRegisterFlow = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_auth)

        if (SessionManager.isLoggedIn(this)) { goToDashboard(); return }

        val tvSignInTab       = findViewById<TextView>(R.id.tvSignInTab)
        val tvCreateAccTab    = findViewById<TextView>(R.id.tvCreateAccountTab)
        val layoutSignIn      = findViewById<LinearLayout>(R.id.layoutSignIn)
        val layoutCreateAcc   = findViewById<LinearLayout>(R.id.layoutCreateAccount)
        val tvTitle           = findViewById<TextView>(R.id.tvTitle)
        val tvSubtitle        = findViewById<TextView>(R.id.tvSubtitle)
        val layoutGoogleBtn   = findViewById<LinearLayout>(R.id.layoutGoogleBtn)
        val tvGoogleLabel     = findViewById<TextView>(R.id.tvGoogleBtnLabel)

        val etSignInEmail     = findViewById<EditText>(R.id.etSignInEmail)
        val etSignInPassword  = findViewById<EditText>(R.id.etSignInPassword)
        val ivToggleSignIn    = findViewById<ImageView>(R.id.ivToggleSignInPassword)
        val btnSignIn         = findViewById<MaterialButton>(R.id.btnSignIn)
        val btnClearSignIn    = findViewById<MaterialButton>(R.id.btnClearSignIn)
        val tvForgotPassword  = findViewById<TextView>(R.id.tvForgotPassword)
        val tvGoToSignUp      = findViewById<TextView>(R.id.tvGoToSignUp)

        val etFirstName       = findViewById<EditText>(R.id.etFirstName)
        val etLastName        = findViewById<EditText>(R.id.etLastName)
        val etRegEmail        = findViewById<EditText>(R.id.etRegEmail)
        val etRegPassword     = findViewById<EditText>(R.id.etRegPassword)
        val etConfirmPwd      = findViewById<EditText>(R.id.etConfirmPassword)
        val ivToggleRegPwd    = findViewById<ImageView>(R.id.ivToggleRegPassword)
        val ivToggleConfPwd   = findViewById<ImageView>(R.id.ivToggleConfirmPassword)
        val btnCreateAccount  = findViewById<MaterialButton>(R.id.btnCreateAccount)
        val btnClearRegister  = findViewById<MaterialButton>(R.id.btnClearRegister)
        val tvGoToSignIn      = findViewById<TextView>(R.id.tvGoToSignIn)
        val btnGuest          = findViewById<MaterialButton>(R.id.btnContinueAsGuest)

        fun isValidEmail(e: String) = Patterns.EMAIL_ADDRESS.matcher(e).matches()

        fun clearSignInForm() {
            etSignInEmail.text.clear(); etSignInPassword.text.clear()
            isSignInPasswordVisible = false
            etSignInPassword.transformationMethod = PasswordTransformationMethod.getInstance()
            ivToggleSignIn.setImageResource(R.drawable.ic_visibility_off)
        }

        fun clearRegisterForm() {
            etFirstName.text.clear(); etLastName.text.clear()
            etRegEmail.text.clear(); etRegPassword.text.clear(); etConfirmPwd.text.clear()
            isRegPasswordVisible = false; isConfirmPasswordVisible = false
            etRegPassword.transformationMethod = PasswordTransformationMethod.getInstance()
            etConfirmPwd.transformationMethod  = PasswordTransformationMethod.getInstance()
            ivToggleRegPwd.setImageResource(R.drawable.ic_visibility_off)
            ivToggleConfPwd.setImageResource(R.drawable.ic_visibility_off)
        }

        fun setTabActive(active: TextView, inactive: TextView) {
            active.setBackgroundResource(R.drawable.bg_card_white)
            active.setTextColor(getColor(R.color.brand_burgundy))
            active.paint.isFakeBoldText = true
            active.elevation = 4f
            inactive.setBackgroundColor(Color.TRANSPARENT)
            inactive.setTextColor(getColor(R.color.brand_text_subtitle))
            inactive.paint.isFakeBoldText = false
            inactive.elevation = 0f
        }

        fun showSignIn(prefillEmail: String? = null) {
            isRegisterFlow = false
            clearSignInForm()
            prefillEmail?.let { etSignInEmail.setText(it); etSignInPassword.requestFocus() }
            layoutSignIn.visibility = View.VISIBLE
            layoutCreateAcc.visibility = View.GONE
            tvTitle.text    = "Welcome Back"
            tvSubtitle.text = "Sign in to manage your bookings and rentals"
            tvGoogleLabel.text = "Sign in with Google"
            setTabActive(tvSignInTab, tvCreateAccTab)
        }

        fun showCreateAccount() {
            isRegisterFlow = true
            clearRegisterForm()
            layoutSignIn.visibility = View.GONE
            layoutCreateAcc.visibility = View.VISIBLE
            tvTitle.text    = "Create Account"
            tvSubtitle.text = "Join EventWear to get started with premium rentals"
            tvGoogleLabel.text = "Sign up with Google"
            setTabActive(tvCreateAccTab, tvSignInTab)
        }

        tvSignInTab.setOnClickListener    { showSignIn() }
        tvCreateAccTab.setOnClickListener { showCreateAccount() }
        tvGoToSignUp.setOnClickListener   { showCreateAccount() }
        tvGoToSignIn.setOnClickListener   { showSignIn() }

        layoutGoogleBtn.setOnClickListener {
            startGoogleOAuth()
        }

        ivToggleSignIn.setOnClickListener {
            isSignInPasswordVisible = !isSignInPasswordVisible
            etSignInPassword.transformationMethod =
                if (isSignInPasswordVisible) HideReturnsTransformationMethod.getInstance()
                else PasswordTransformationMethod.getInstance()
            ivToggleSignIn.setImageResource(
                if (isSignInPasswordVisible) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
            etSignInPassword.setSelection(etSignInPassword.text.length)
        }
        ivToggleRegPwd.setOnClickListener {
            isRegPasswordVisible = !isRegPasswordVisible
            etRegPassword.transformationMethod =
                if (isRegPasswordVisible) HideReturnsTransformationMethod.getInstance()
                else PasswordTransformationMethod.getInstance()
            ivToggleRegPwd.setImageResource(
                if (isRegPasswordVisible) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
            etRegPassword.setSelection(etRegPassword.text.length)
        }
        ivToggleConfPwd.setOnClickListener {
            isConfirmPasswordVisible = !isConfirmPasswordVisible
            etConfirmPwd.transformationMethod =
                if (isConfirmPasswordVisible) HideReturnsTransformationMethod.getInstance()
                else PasswordTransformationMethod.getInstance()
            ivToggleConfPwd.setImageResource(
                if (isConfirmPasswordVisible) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
            etConfirmPwd.setSelection(etConfirmPwd.text.length)
        }

        btnSignIn.setOnClickListener {
            val email    = etSignInEmail.text.toString().trim()
            val password = etSignInPassword.text.toString()
            when {
                email.isEmpty()      -> toast("Please enter your email")
                !isValidEmail(email) -> toast("Please enter a valid email address")
                password.isEmpty()   -> toast("Please enter your password")
                else -> {
                    setLoading(btnSignIn, true, "SIGNING IN...", "SIGN IN  →")
                    AuthRepository.login(email, password,
                        onSuccess = { token, firstName, lastName, respEmail, role, _ ->
                            runOnUiThread {
                                SessionManager.saveUser(this, token, firstName, lastName, respEmail, role)
                                clearSignInForm()
                                toast("Welcome back, $firstName!")
                                setLoading(btnSignIn, false, "SIGNING IN...", "SIGN IN  →")
                                goToDashboard()
                            }
                        },
                        onError = { msg ->
                            runOnUiThread {
                                toast(msg)
                                setLoading(btnSignIn, false, "SIGNING IN...", "SIGN IN  →")
                            }
                        }
                    )
                }
            }
        }

        btnCreateAccount.setOnClickListener {
            val firstName = etFirstName.text.toString().trim()
            val lastName  = etLastName.text.toString().trim()
            val email     = etRegEmail.text.toString().trim()
            val password  = etRegPassword.text.toString()
            val confirm   = etConfirmPwd.text.toString()

            val errors = mutableListOf<String>()
            when {
                firstName.isEmpty()              -> errors += "First name is required"
                !NAME_PATTERN.matches(firstName) -> errors += "Only letters and spaces allowed in first name"
                firstName.length < 2             -> errors += "First name must be at least 2 characters"
            }
            when {
                lastName.isEmpty()              -> errors += "Last name is required"
                !NAME_PATTERN.matches(lastName) -> errors += "Only letters and spaces allowed in last name"
                lastName.length < 2             -> errors += "Last name must be at least 2 characters"
            }
            if (email.isEmpty()) errors += "Please enter your email"
            else if (!isValidEmail(email)) errors += "Please enter a valid email address"

            if (password.isEmpty()) {
                errors += "Please enter a password"
            } else {
                val missing = mutableListOf<String>()
                if (password.length < 8)                  missing += "at least 8 characters"
                if (!password.any { it.isUpperCase() })   missing += "one uppercase letter"
                if (!password.any { it.isLowerCase() })   missing += "one lowercase letter"
                if (!password.any { it.isDigit() })       missing += "one number"
                if (!password.any { it in "@#\$%^&+=!" }) missing += "one special character (@#\$%^&+=!)"
                if (missing.isNotEmpty()) errors += "Password must contain ${missing.joinToString(", ")}"
            }
            if (confirm.isEmpty()) errors += "Please confirm your password"
            else if (password != confirm) errors += "Passwords do not match"

            if (errors.isNotEmpty()) { toast(errors.first()); return@setOnClickListener }

            setLoading(btnCreateAccount, true, "CREATING ACCOUNT...", "CREATE ACCOUNT  →")
            AuthRepository.register(firstName, lastName, email, password,
                onSuccess = {
                    runOnUiThread {
                        toast("Account created successfully! You can now sign in.")
                        setLoading(btnCreateAccount, false, "CREATING ACCOUNT...", "CREATE ACCOUNT  →")
                        showSignIn(prefillEmail = email)
                    }
                },
                onError = { msg ->
                    runOnUiThread {
                        toast(msg)
                        setLoading(btnCreateAccount, false, "CREATING ACCOUNT...", "CREATE ACCOUNT  →")
                    }
                }
            )
        }

        btnClearSignIn.setOnClickListener   { clearSignInForm() }
        btnClearRegister.setOnClickListener { clearRegisterForm() }

        tvForgotPassword.setOnClickListener {
            startActivity(Intent(this, ForgotPasswordActivity::class.java))
        }

        btnGuest.setOnClickListener {
            startActivity(Intent(this, GuestDashboardActivity::class.java))
            finish()
        }

        when (intent.getStringExtra("TAB")) {
            "register" -> showCreateAccount()
            else       -> showSignIn()
        }
    }

    private fun startGoogleOAuth() {
        googleServer?.stop()
        googleServer = LocalCallbackServer().apply {
            onTokenReceived = { token, email, firstName, lastName, role ->
                runOnUiThread {
                    SessionManager.saveUser(this@Auth, token, firstName, lastName, email, role)
                    toast("Welcome, $firstName!")
                    goToDashboard()
                }
            }
            onError = { msg ->
                runOnUiThread { toast(msg) }
            }
            start()
        }

        val path = if (isRegisterFlow) "google-register" else "google"
        val oauthUrl = "${ApiClient.BASE_URL}/oauth2/authorization/$path"

        val burgundy = getColor(R.color.brand_burgundy)
        val tabColorParams = CustomTabColorSchemeParams.Builder()
            .setToolbarColor(burgundy)
            .setNavigationBarColor(burgundy)
            .build()

        CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(tabColorParams)
            .setShowTitle(true)
            .build()
            .launchUrl(this, Uri.parse(oauthUrl))
    }

    override fun onResume() {
        super.onResume()
    }

    override fun onDestroy() {
        super.onDestroy()
        googleServer?.stop()
    }

    private fun goToDashboard() {
        val role = SessionManager.getRole(this)
        val dest = if (role == "ADMIN") AdminDashboardActivity::class.java else DashboardActivity::class.java
        startActivity(Intent(this, dest).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    private fun setLoading(btn: MaterialButton, loading: Boolean, loadingText: String, idleText: String) {
        btn.isEnabled = !loading
        btn.text      = if (loading) loadingText else idleText
    }
}
