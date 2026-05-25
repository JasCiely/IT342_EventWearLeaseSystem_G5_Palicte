package com.app.mobile.features.admin.fragments

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.R
import com.google.android.material.button.MaterialButton
import com.app.mobile.databinding.FragmentProfileBinding
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.ChangePasswordRequest
import com.app.mobile.shared.models.UpdateProfileRequest
import com.app.mobile.shared.utils.SessionManager
import kotlinx.coroutines.launch
import retrofit2.HttpException

class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.toolbar.setNavigationOnClickListener { parentFragmentManager.popBackStack() }

        loadProfile()

        binding.etPhone.addTextChangedListener(object : TextWatcher {
            private var isFormatting = false
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (isFormatting || s == null) return
                isFormatting = true
                val digits    = extractLocalDigits(s.toString())
                val formatted = formatPhoneDisplay(digits)
                if (s.toString() != formatted) {
                    s.replace(0, s.length, formatted)
                    try { binding.etPhone.setSelection(formatted.length) } catch (_: Exception) {}
                }
                isFormatting = false
            }
        })

        binding.btnSaveProfile.setOnClickListener { saveProfile() }
        binding.btnChangePassword.setOnClickListener { showChangePasswordDialog() }
    }

    private fun loadProfile() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val profile = ApiClient.adminApi.getProfile(ApiClient.bearerToken())
                binding.etFirstName.setText(profile.firstName)
                binding.etLastName.setText(profile.lastName)
                binding.etEmail.setText(profile.email)
                val storedPhone = profile.phone ?: ""
                binding.etPhone.setText(if (storedPhone.isNotEmpty()) formatPhoneDisplay(extractLocalDigits(storedPhone)) else "")
                binding.tvInitials.text = profile.initials
                binding.tvName.text = profile.fullName
                binding.tvRole.text = profile.role
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else {
                    val ctx = requireContext()
                    binding.etFirstName.setText(SessionManager.getFirstName(ctx) ?: "")
                    binding.etLastName.setText(SessionManager.getLastName(ctx) ?: "")
                    binding.etEmail.setText(SessionManager.getEmail(ctx) ?: "")
                    val fallbackPhone = SessionManager.getPhone(ctx) ?: ""
                    binding.etPhone.setText(if (fallbackPhone.isNotEmpty()) formatPhoneDisplay(extractLocalDigits(fallbackPhone)) else "")
                    val fn = SessionManager.getFirstName(ctx) ?: ""
                    val ln = SessionManager.getLastName(ctx) ?: ""
                    binding.tvInitials.text = "${fn.firstOrNull() ?: ""}${ln.firstOrNull() ?: ""}".uppercase()
                    binding.tvName.text = "$fn $ln"
                    binding.tvRole.text = SessionManager.getRole(ctx) ?: "ADMIN"
                }
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun saveProfile() {
        val firstName = binding.etFirstName.text.toString().trim()
        val lastName  = binding.etLastName.text.toString().trim()
        val email     = binding.etEmail.text.toString().trim()
        val phone     = binding.etPhone.text.toString().trim().ifEmpty { null }

        if (firstName.isEmpty() || lastName.isEmpty() || email.isEmpty()) {
            toast("First name, last name, and email are required"); return
        }
        if (phone != null && !isValidPhilippinePhone(phone)) {
            toast("Invalid phone number. Use +63 followed by 10 digits (e.g. +639XXXXXXXXX)"); return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val updated = ApiClient.adminApi.updateProfile(ApiClient.bearerToken(), UpdateProfileRequest(firstName, lastName, email, phone?.replace(" ", "")))
                binding.tvName.text = updated.fullName
                binding.tvInitials.text = updated.initials
                toast("Profile updated")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun showChangePasswordDialog() {
        val view            = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_change_password, null)
        val etOld           = view.findViewById<EditText>(R.id.etOldPassword)
        val etNew           = view.findViewById<EditText>(R.id.etNewPassword)
        val etConfirm       = view.findViewById<EditText>(R.id.etConfirmPassword)
        val ivToggleOld     = view.findViewById<ImageView>(R.id.ivToggleOld)
        val ivToggleNew     = view.findViewById<ImageView>(R.id.ivToggleNew)
        val ivToggleConfirm = view.findViewById<ImageView>(R.id.ivToggleConfirm)
        val btnUpdate       = view.findViewById<MaterialButton>(R.id.btnUpdatePassword)

        val dialog = AlertDialog.Builder(requireContext())
            .setTitle("Change Password")
            .setView(view)
            .setNegativeButton("Cancel", null)
            .create()

        fun toggleVis(et: EditText, iv: ImageView) {
            val hidden = et.transformationMethod is android.text.method.PasswordTransformationMethod
            et.transformationMethod = if (hidden) android.text.method.HideReturnsTransformationMethod.getInstance()
                                      else android.text.method.PasswordTransformationMethod.getInstance()
            iv.setImageResource(if (hidden) R.drawable.ic_visibility else R.drawable.ic_visibility_off)
            et.setSelection(et.text.length)
        }
        ivToggleOld.setOnClickListener     { toggleVis(etOld, ivToggleOld) }
        ivToggleNew.setOnClickListener     { toggleVis(etNew, ivToggleNew) }
        ivToggleConfirm.setOnClickListener { toggleVis(etConfirm, ivToggleConfirm) }

        btnUpdate.setOnClickListener {
            val old  = etOld.text.toString()
            val new_ = etNew.text.toString()
            val confirm = etConfirm.text.toString()
            if (old.isEmpty() || new_.isEmpty() || confirm.isEmpty()) { toast("Fill all fields"); return@setOnClickListener }
            if (new_ != confirm) { toast("Passwords do not match"); return@setOnClickListener }
            if (new_.length < 8) { toast("Password must be at least 8 characters"); return@setOnClickListener }
            btnUpdate.isEnabled = false
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    ApiClient.adminApi.changePassword(ApiClient.bearerToken(), ChangePasswordRequest(currentPassword = old, newPassword = new_))
                    dialog.dismiss()
                    toast("Password changed successfully")
                } catch (e: HttpException) {
                    toast(if (e.code() == 400) "Current password is incorrect" else getString(R.string.error_network))
                    btnUpdate.isEnabled = true
                } catch (_: Exception) {
                    toast(getString(R.string.error_network))
                    btnUpdate.isEnabled = true
                }
            }
        }

        dialog.show()
    }

    private fun isValidPhilippinePhone(phone: String) =
        Regex("^\\+639\\d{9}$").matches(phone.replace(" ", ""))

    private fun formatPhoneDisplay(localDigits: String): String {
        val d = localDigits.take(10)
        val body = when {
            d.length <= 3 -> d
            d.length <= 6 -> "${d.substring(0, 3)} ${d.substring(3)}"
            else          -> "${d.substring(0, 3)} ${d.substring(3, 6)} ${d.substring(6)}"
        }
        return "+63 $body"
    }

    private fun extractLocalDigits(raw: String): String {
        val withoutCountry = if (raw.startsWith("+63")) raw.substring(3) else raw
        val digits = withoutCountry.filter { it.isDigit() }
        return if (digits.startsWith("0")) digits.substring(1).take(10) else digits.take(10)
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
