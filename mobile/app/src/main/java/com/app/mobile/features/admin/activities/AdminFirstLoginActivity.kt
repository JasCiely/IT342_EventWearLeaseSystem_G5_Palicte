package com.app.mobile.features.admin.activities

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.text.method.HideReturnsTransformationMethod
import android.text.method.PasswordTransformationMethod
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.app.mobile.R
import com.app.mobile.features.auth.repositories.AuthRepository
import com.app.mobile.shared.utils.SessionManager
import com.google.android.material.button.MaterialButton

class AdminFirstLoginActivity : AppCompatActivity() {

    private var isCurrentVisible = false
    private var isNewVisible     = false
    private var isConfirmVisible = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Guard: only accessible for admins with mustChangePassword flag
        if (!SessionManager.isAdmin(this) || !SessionManager.getMustChangePassword(this)) {
            goToDashboard()
            return
        }

        setContentView(R.layout.activity_admin_first_login)

        val etCurrent   = findViewById<EditText>(R.id.etCurrentPassword)
        val etNew       = findViewById<EditText>(R.id.etNewPassword)
        val etConfirm   = findViewById<EditText>(R.id.etConfirmPassword)

        val ivToggleCurrent = findViewById<ImageView>(R.id.ivToggleCurrent)
        val ivToggleNew     = findViewById<ImageView>(R.id.ivToggleNew)
        val ivToggleConfirm = findViewById<ImageView>(R.id.ivToggleConfirm)

        val tvErrCurrent = findViewById<TextView>(R.id.tvErrorCurrentPwd)
        val tvErrNew     = findViewById<TextView>(R.id.tvErrorNewPwd)
        val tvErrConfirm = findViewById<TextView>(R.id.tvErrorConfirmPwd)

        val layoutStrength = findViewById<LinearLayout>(R.id.layoutStrength)
        val strengthBar    = findViewById<View>(R.id.strengthBar)
        val tvStrength     = findViewById<TextView>(R.id.tvStrengthLabel)

        val reqLength  = findViewById<TextView>(R.id.reqLength)
        val reqUpper   = findViewById<TextView>(R.id.reqUpper)
        val reqLower   = findViewById<TextView>(R.id.reqLower)
        val reqNumber  = findViewById<TextView>(R.id.reqNumber)
        val reqSpecial = findViewById<TextView>(R.id.reqSpecial)

        val btnSet = findViewById<MaterialButton>(R.id.btnSetPassword)

        // Password visibility toggles
        ivToggleCurrent.setOnClickListener {
            isCurrentVisible = !isCurrentVisible
            etCurrent.transformationMethod =
                if (isCurrentVisible) HideReturnsTransformationMethod.getInstance()
                else PasswordTransformationMethod.getInstance()
            ivToggleCurrent.setImageResource(
                if (isCurrentVisible) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
            etCurrent.setSelection(etCurrent.text.length)
        }

        ivToggleNew.setOnClickListener {
            isNewVisible = !isNewVisible
            etNew.transformationMethod =
                if (isNewVisible) HideReturnsTransformationMethod.getInstance()
                else PasswordTransformationMethod.getInstance()
            ivToggleNew.setImageResource(
                if (isNewVisible) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
            etNew.setSelection(etNew.text.length)
        }

        ivToggleConfirm.setOnClickListener {
            isConfirmVisible = !isConfirmVisible
            etConfirm.transformationMethod =
                if (isConfirmVisible) HideReturnsTransformationMethod.getInstance()
                else PasswordTransformationMethod.getInstance()
            ivToggleConfirm.setImageResource(
                if (isConfirmVisible) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
            etConfirm.setSelection(etConfirm.text.length)
        }

        // Live password strength
        etNew.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val pwd = s?.toString() ?: ""
                updateStrength(pwd, layoutStrength, strengthBar, tvStrength,
                    reqLength, reqUpper, reqLower, reqNumber, reqSpecial)
                if (tvErrNew.visibility == View.VISIBLE) tvErrNew.visibility = View.GONE
            }
        })

        etCurrent.addTextChangedListener(clearErrorWatcher(tvErrCurrent))
        etConfirm.addTextChangedListener(clearErrorWatcher(tvErrConfirm))

        btnSet.setOnClickListener {
            val current = etCurrent.text.toString()
            val newPwd  = etNew.text.toString()
            val confirm = etConfirm.text.toString()

            if (!validate(current, newPwd, confirm, tvErrCurrent, tvErrNew, tvErrConfirm)) return@setOnClickListener

            val token = SessionManager.getToken(this)
            if (token.isNullOrEmpty()) {
                toast("Session expired. Please log in again.")
                goToAuth()
                return@setOnClickListener
            }

            setLoading(btnSet, true)
            AuthRepository.changePassword(token, current, newPwd,
                onSuccess = {
                    runOnUiThread {
                        SessionManager.setMustChangePassword(this, false)
                        toast("Password changed successfully! Welcome, ${SessionManager.getFirstName(this)}!")
                        setLoading(btnSet, false)
                        goToDashboard()
                    }
                },
                onError = { msg ->
                    runOnUiThread {
                        setLoading(btnSet, false)
                        when {
                            msg.contains("current", ignoreCase = true) || msg.contains("incorrect", ignoreCase = true) -> {
                                showError(tvErrCurrent, msg)
                            }
                            msg.contains("expired", ignoreCase = true) || msg.contains("session", ignoreCase = true) -> {
                                toast(msg)
                                goToAuth()
                            }
                            else -> toast(msg)
                        }
                    }
                }
            )
        }
    }

    private fun validate(
        current: String, newPwd: String, confirm: String,
        tvErrCurrent: TextView, tvErrNew: TextView, tvErrConfirm: TextView
    ): Boolean {
        clearErrors(tvErrCurrent, tvErrNew, tvErrConfirm)
        var valid = true

        if (current.isEmpty()) {
            showError(tvErrCurrent, "Current password is required")
            valid = false
        }

        if (newPwd.isEmpty()) {
            showError(tvErrNew, "New password is required")
            valid = false
        } else {
            val missing = mutableListOf<String>()
            if (newPwd.length < 8)                  missing += "at least 8 characters"
            if (!newPwd.any { it.isUpperCase() })   missing += "one uppercase letter"
            if (!newPwd.any { it.isLowerCase() })   missing += "one lowercase letter"
            if (!newPwd.any { it.isDigit() })       missing += "one number"
            if (!newPwd.any { it in "@#\$%^&+=!" }) missing += "one special character"
            if (missing.isNotEmpty()) {
                showError(tvErrNew, "Password must contain ${missing.joinToString(", ")}")
                valid = false
            } else if (newPwd == current) {
                showError(tvErrNew, "New password must be different from the current password")
                valid = false
            }
        }

        if (confirm.isEmpty()) {
            showError(tvErrConfirm, "Please confirm your new password")
            valid = false
        } else if (newPwd != confirm) {
            showError(tvErrConfirm, "Passwords do not match")
            valid = false
        }

        return valid
    }

    private fun updateStrength(
        pwd: String,
        layout: LinearLayout, bar: View, label: TextView,
        reqLength: TextView, reqUpper: TextView, reqLower: TextView,
        reqNumber: TextView, reqSpecial: TextView
    ) {
        if (pwd.isEmpty()) { layout.visibility = View.GONE; return }
        layout.visibility = View.VISIBLE

        val hasLength  = pwd.length >= 8
        val hasUpper   = pwd.any { it.isUpperCase() }
        val hasLower   = pwd.any { it.isLowerCase() }
        val hasNumber  = pwd.any { it.isDigit() }
        val hasSpecial = pwd.any { it in "@#\$%^&+=!()_-[]{};':\"\\|,.<>/?" }

        val metCount = listOf(hasLength, hasUpper, hasLower, hasNumber, hasSpecial).count { it }
        val pct = metCount * 100 / 5

        val (color, text) = when {
            pct < 40 -> Pair(getColor(R.color.error_red),    "Weak Password")
            pct < 80 -> Pair(getColor(R.color.warning_amber), "Medium Password")
            else     -> Pair(getColor(R.color.success_green), "Strong Password")
        }

        val params = bar.layoutParams as FrameLayout.LayoutParams
        bar.post {
            val parentWidth = (bar.parent as FrameLayout).width
            params.width = (parentWidth * pct / 100).coerceAtLeast(1)
            bar.layoutParams = params
        }
        bar.setBackgroundColor(color)
        label.text = text
        label.setTextColor(color)

        fun markReq(tv: TextView, met: Boolean) {
            tv.setTextColor(if (met) getColor(R.color.success_green) else getColor(R.color.brand_text_subtitle))
            tv.text = "${if (met) "✓" else "•"} ${tv.text.toString().drop(2)}"
        }

        // Rebuild text to avoid double-prefixing on repeated calls
        reqLength.text  = "${if (hasLength)  "✓" else "•"} At least 8 characters"
        reqUpper.text   = "${if (hasUpper)   "✓" else "•"} One uppercase letter"
        reqLower.text   = "${if (hasLower)   "✓" else "•"} One lowercase letter"
        reqNumber.text  = "${if (hasNumber)  "✓" else "•"} One number"
        reqSpecial.text = "${if (hasSpecial) "✓" else "•"} One special character (@#\$%^&+=!)"

        reqLength.setTextColor(if (hasLength)  getColor(R.color.success_green) else getColor(R.color.brand_text_subtitle))
        reqUpper.setTextColor(if (hasUpper)    getColor(R.color.success_green) else getColor(R.color.brand_text_subtitle))
        reqLower.setTextColor(if (hasLower)    getColor(R.color.success_green) else getColor(R.color.brand_text_subtitle))
        reqNumber.setTextColor(if (hasNumber)  getColor(R.color.success_green) else getColor(R.color.brand_text_subtitle))
        reqSpecial.setTextColor(if (hasSpecial) getColor(R.color.success_green) else getColor(R.color.brand_text_subtitle))
    }

    private fun showError(tv: TextView, msg: String) {
        tv.text = msg
        tv.visibility = View.VISIBLE
    }

    private fun clearErrors(vararg tvs: TextView) = tvs.forEach { it.visibility = View.GONE }

    private fun clearErrorWatcher(tv: TextView) = object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        override fun afterTextChanged(s: Editable?) { tv.visibility = View.GONE }
    }

    private fun setLoading(btn: MaterialButton, loading: Boolean) {
        btn.isEnabled = !loading
        btn.text = if (loading) "UPDATING..." else "SET NEW PASSWORD  →"
    }

    private fun goToDashboard() {
        startActivity(Intent(this, AdminDashboardActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    private fun goToAuth() {
        SessionManager.clearSession(this)
        startActivity(Intent(this, com.app.mobile.features.auth.activities.Auth::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        finish()
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    override fun onBackPressed() {
        // Prevent back navigation — admin must change password first
    }
}
