package com.app.mobile.features.auth.activities

import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.text.method.HideReturnsTransformationMethod
import android.text.method.PasswordTransformationMethod
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.app.mobile.R
import com.app.mobile.features.auth.repositories.AuthRepository
import com.google.android.material.button.MaterialButton

class ForgotPasswordActivity : AppCompatActivity() {

    private enum class Step { EMAIL, OTP, RESET, SUCCESS }

    private var currentStep = Step.EMAIL
    private var pendingEmail = ""
    private var pendingOtp   = ""

    private var resendTimer: CountDownTimer? = null
    private var isNewPasswordVisible    = false
    private var isConfirmPasswordVisible = false

    private val PASSWORD_PATTERN = Regex("^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#\$%^&+=!])(?=\\S+\$).{8,}\$")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_forgot_password)

        val btnBack = findViewById<MaterialButton>(R.id.btnFpBack)

        val layoutEmail   = findViewById<LinearLayout>(R.id.layoutFpEmail)
        val layoutOtp     = findViewById<LinearLayout>(R.id.layoutFpOtp)
        val layoutReset   = findViewById<LinearLayout>(R.id.layoutFpReset)
        val layoutSuccess = findViewById<LinearLayout>(R.id.layoutFpSuccess)

        val stepCircle1 = findViewById<TextView>(R.id.tvStep1Circle)
        val stepCircle2 = findViewById<TextView>(R.id.tvStep2Circle)
        val stepCircle3 = findViewById<TextView>(R.id.tvStep3Circle)
        val stepLine1   = findViewById<View>(R.id.viewStepLine1)
        val stepLine2   = findViewById<View>(R.id.viewStepLine2)

        val etFpEmail  = findViewById<EditText>(R.id.etFpEmail)
        val btnSendOtp = findViewById<MaterialButton>(R.id.btnSendOtp)

        val otpBoxes = arrayOf(
            findViewById<EditText>(R.id.etOtp1),
            findViewById<EditText>(R.id.etOtp2),
            findViewById<EditText>(R.id.etOtp3),
            findViewById<EditText>(R.id.etOtp4),
            findViewById<EditText>(R.id.etOtp5),
            findViewById<EditText>(R.id.etOtp6)
        )
        val tvOtpHint      = findViewById<TextView>(R.id.tvOtpHint)
        val btnVerifyOtp   = findViewById<MaterialButton>(R.id.btnVerifyOtp)
        val btnResendOtp   = findViewById<MaterialButton>(R.id.btnResendOtp)
        val tvChangeEmail  = findViewById<TextView>(R.id.tvChangeEmail)

        val etNewPassword     = findViewById<EditText>(R.id.etFpNewPassword)
        val etConfirmPassword = findViewById<EditText>(R.id.etFpConfirmPassword)
        val ivToggleNew       = findViewById<ImageView>(R.id.ivToggleFpNew)
        val ivToggleConfirm   = findViewById<ImageView>(R.id.ivToggleFpConfirm)
        val btnResetPassword  = findViewById<MaterialButton>(R.id.btnResetPassword)

        val btnBackToSignIn = findViewById<MaterialButton>(R.id.btnFpSuccessSignIn)

        fun showStep(step: Step) {
            currentStep = step
            layoutEmail.visibility   = if (step == Step.EMAIL)   View.VISIBLE else View.GONE
            layoutOtp.visibility     = if (step == Step.OTP)     View.VISIBLE else View.GONE
            layoutReset.visibility   = if (step == Step.RESET)   View.VISIBLE else View.GONE
            layoutSuccess.visibility = if (step == Step.SUCCESS) View.VISIBLE else View.GONE

            val burgundy    = getColor(R.color.brand_burgundy)
            val subtitleClr = getColor(R.color.brand_text_subtitle)
            val white       = getColor(android.R.color.white)

            fun styleCircle(circle: TextView, index: Int) {
                val activeIdx = when (step) {
                    Step.EMAIL   -> 0
                    Step.OTP     -> 1
                    Step.RESET   -> 2
                    Step.SUCCESS -> 3
                }
                when {
                    index < activeIdx -> {
                        circle.text = "✓"
                        circle.setBackgroundResource(R.drawable.bg_step_done)
                        circle.setTextColor(white)
                    }
                    index == activeIdx -> {
                        circle.text = "${index + 1}"
                        circle.setBackgroundResource(R.drawable.bg_step_active)
                        circle.setTextColor(white)
                    }
                    else -> {
                        circle.text = "${index + 1}"
                        circle.setBackgroundResource(R.drawable.bg_step_pending)
                        circle.setTextColor(subtitleClr)
                    }
                }
            }
            styleCircle(stepCircle1, 0)
            styleCircle(stepCircle2, 1)
            styleCircle(stepCircle3, 2)
        }

        showStep(Step.EMAIL)

        btnBack.setOnClickListener {
            when (currentStep) {
                Step.EMAIL   -> finish()
                Step.OTP     -> showStep(Step.EMAIL)
                Step.RESET   -> showStep(Step.OTP)
                Step.SUCCESS -> finish()
            }
        }

        for (i in otpBoxes.indices) {
            otpBoxes[i].addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
                override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    if ((s?.length ?: 0) == 1 && i < otpBoxes.size - 1) {
                        otpBoxes[i + 1].requestFocus()
                    }
                }
            })
            otpBoxes[i].setOnKeyListener { _, keyCode, _ ->
                if (keyCode == android.view.KeyEvent.KEYCODE_DEL &&
                    otpBoxes[i].text.isEmpty() && i > 0) {
                    otpBoxes[i - 1].requestFocus()
                    otpBoxes[i - 1].text.clear()
                    true
                } else false
            }
        }

        fun getOtpValue() = otpBoxes.joinToString("") { it.text.toString() }

        fun clearOtpBoxes() { otpBoxes.forEach { it.text.clear() }; otpBoxes[0].requestFocus() }

        fun startResendCooldown() {
            resendTimer?.cancel()
            btnResendOtp.isEnabled = false
            resendTimer = object : CountDownTimer(60_000, 1_000) {
                override fun onTick(ms: Long) {
                    btnResendOtp.text = "Resend in ${ms / 1000}s"
                }
                override fun onFinish() {
                    btnResendOtp.isEnabled = true
                    btnResendOtp.text = "Resend OTP"
                }
            }.start()
        }

        btnSendOtp.setOnClickListener {
            val email = etFpEmail.text.toString().trim()
            when {
                email.isEmpty() -> toast("Please enter your email address.")
                !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches() ->
                    toast("Please enter a valid email address.")
                else -> {
                    btnSendOtp.isEnabled = false
                    btnSendOtp.text = "SENDING..."
                    pendingEmail = email
                    AuthRepository.forgotPassword(email,
                        onSuccess = {
                            runOnUiThread {
                                btnSendOtp.isEnabled = true
                                btnSendOtp.text = "SEND OTP  →"
                                tvOtpHint.text = "Enter the 6-digit code sent to $email. It expires in 10 minutes."
                                showStep(Step.OTP)
                                startResendCooldown()
                                otpBoxes[0].requestFocus()
                            }
                        },
                        onError = { msg ->
                            runOnUiThread {
                                toast(msg)
                                btnSendOtp.isEnabled = true
                                btnSendOtp.text = "SEND OTP  →"
                            }
                        }
                    )
                }
            }
        }

        btnVerifyOtp.setOnClickListener {
            val otp = getOtpValue()
            if (otp.length != 6) { toast("Please enter the 6-digit OTP."); return@setOnClickListener }
            btnVerifyOtp.isEnabled = false
            btnVerifyOtp.text = "VERIFYING..."
            AuthRepository.verifyOtp(pendingEmail, otp,
                onSuccess = {
                    runOnUiThread {
                        pendingOtp = otp
                        btnVerifyOtp.isEnabled = true
                        btnVerifyOtp.text = "VERIFY OTP  →"
                        showStep(Step.RESET)
                        etNewPassword.requestFocus()
                    }
                },
                onError = { msg ->
                    runOnUiThread {
                        toast(msg)
                        btnVerifyOtp.isEnabled = true
                        btnVerifyOtp.text = "VERIFY OTP  →"
                    }
                }
            )
        }

        btnResendOtp.setOnClickListener {
            clearOtpBoxes()
            AuthRepository.forgotPassword(pendingEmail,
                onSuccess = {
                    runOnUiThread {
                        startResendCooldown()
                        toast("A new OTP has been sent to your email.")
                        otpBoxes[0].requestFocus()
                    }
                },
                onError = { msg -> runOnUiThread { toast(msg) } }
            )
        }

        tvChangeEmail.setOnClickListener { showStep(Step.EMAIL) }

        ivToggleNew.setOnClickListener {
            isNewPasswordVisible = !isNewPasswordVisible
            etNewPassword.transformationMethod =
                if (isNewPasswordVisible) HideReturnsTransformationMethod.getInstance()
                else PasswordTransformationMethod.getInstance()
            ivToggleNew.setImageResource(
                if (isNewPasswordVisible) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
            etNewPassword.setSelection(etNewPassword.text.length)
        }

        ivToggleConfirm.setOnClickListener {
            isConfirmPasswordVisible = !isConfirmPasswordVisible
            etConfirmPassword.transformationMethod =
                if (isConfirmPasswordVisible) HideReturnsTransformationMethod.getInstance()
                else PasswordTransformationMethod.getInstance()
            ivToggleConfirm.setImageResource(
                if (isConfirmPasswordVisible) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
            etConfirmPassword.setSelection(etConfirmPassword.text.length)
        }

        btnResetPassword.setOnClickListener {
            val newPwd  = etNewPassword.text.toString()
            val confirm = etConfirmPassword.text.toString()

            when {
                newPwd.isEmpty() -> { toast("Please enter a new password."); return@setOnClickListener }
                !PASSWORD_PATTERN.matches(newPwd) -> {
                    val missing = mutableListOf<String>()
                    if (newPwd.length < 8)                        missing += "at least 8 characters"
                    if (!newPwd.any { it.isUpperCase() })         missing += "one uppercase letter"
                    if (!newPwd.any { it.isLowerCase() })         missing += "one lowercase letter"
                    if (!newPwd.any { it.isDigit() })             missing += "one number"
                    if (!newPwd.any { it in "@#\$%^&+=!" })       missing += "one special character (@#\$%^&+=!)"
                    toast("Password must contain ${missing.joinToString(", ")}.")
                    return@setOnClickListener
                }
                confirm.isEmpty()     -> { toast("Please confirm your new password."); return@setOnClickListener }
                newPwd != confirm     -> { toast("Passwords do not match."); return@setOnClickListener }
            }

            btnResetPassword.isEnabled = false
            btnResetPassword.text = "RESETTING..."
            AuthRepository.resetPassword(pendingEmail, pendingOtp, newPwd,
                onSuccess = {
                    runOnUiThread {
                        btnResetPassword.isEnabled = true
                        btnResetPassword.text = "RESET PASSWORD  →"
                        showStep(Step.SUCCESS)
                    }
                },
                onError = { msg ->
                    runOnUiThread {
                        toast(msg)
                        btnResetPassword.isEnabled = true
                        btnResetPassword.text = "RESET PASSWORD  →"
                    }
                }
            )
        }

        btnBackToSignIn.setOnClickListener {
            startActivity(Intent(this, Auth::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra("TAB", "signin")
            })
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        resendTimer?.cancel()
    }

    private fun toast(msg: String) =
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
}
