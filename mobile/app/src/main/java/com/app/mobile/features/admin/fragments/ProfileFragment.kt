package com.app.mobile.features.admin.fragments

import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.R
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
                binding.etPhone.setText(profile.phone ?: "")
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
                    binding.etPhone.setText(SessionManager.getPhone(ctx) ?: "")
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

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val updated = ApiClient.adminApi.updateProfile(ApiClient.bearerToken(), UpdateProfileRequest(firstName, lastName, email, phone))
                binding.tvName.text = updated.fullName
                binding.tvInitials.text = updated.initials
                toast("Profile updated")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun showChangePasswordDialog() {
        val view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_change_password, null)
        val etOld = view.findViewById<EditText>(R.id.etOldPassword)
        val etNew = view.findViewById<EditText>(R.id.etNewPassword)
        val etConfirm = view.findViewById<EditText>(R.id.etConfirmPassword)

        AlertDialog.Builder(requireContext())
            .setTitle("Change Password")
            .setView(view)
            .setPositiveButton("Change") { _, _ ->
                val old     = etOld.text.toString()
                val new_    = etNew.text.toString()
                val confirm = etConfirm.text.toString()
                if (old.isEmpty() || new_.isEmpty()) { toast("Fill all fields"); return@setPositiveButton }
                if (new_ != confirm) { toast("Passwords do not match"); return@setPositiveButton }
                if (new_.length < 8) { toast("Password must be at least 8 characters"); return@setPositiveButton }
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.changePassword(ApiClient.bearerToken(), ChangePasswordRequest(old, new_))
                        toast("Password changed successfully")
                    } catch (e: HttpException) {
                        toast(if (e.code() == 400) "Current password is incorrect" else getString(R.string.error_network))
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null).show()
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
