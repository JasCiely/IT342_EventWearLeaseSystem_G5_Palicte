package com.app.mobile.features.admin.fragments

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.R
import com.app.mobile.databinding.FragmentMoreBinding
import com.app.mobile.features.auth.activities.Auth
import com.app.mobile.features.auth.repositories.AuthRepository
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.ChangePasswordRequest
import com.app.mobile.shared.models.UpdateProfileRequest
import com.app.mobile.shared.sse.SseClient
import com.app.mobile.shared.utils.SessionManager
import com.bumptech.glide.Glide
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException

class MoreFragment : Fragment() {

    private var _binding: FragmentMoreBinding? = null
    private val binding get() = _binding!!

    private val pickImage = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri ?: return@registerForActivityResult
        uploadPhoto(uri)
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentMoreBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        loadProfile()

        binding.avatarContainer.setOnClickListener { pickImage.launch("image/*") }
        binding.btnSaveProfile.setOnClickListener { saveProfile() }
        binding.btnChangePassword.setOnClickListener { showChangePasswordDialog() }
        binding.cardCustomers.setOnClickListener { navigateTo(CustomersFragment()) }

        binding.btnLogout.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle("Logout")
                .setMessage("Are you sure you want to log out?")
                .setPositiveButton("Logout") { _, _ -> performLogout() }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    // ── Profile load ─────────────────────────────────────────────────────────

    private fun loadProfile() {
        val ctx = requireContext()
        // Instant fill from session cache
        binding.etFirstName.setText(SessionManager.getFirstName(ctx) ?: "")
        binding.etLastName.setText(SessionManager.getLastName(ctx) ?: "")
        binding.etEmail.setText(SessionManager.getEmail(ctx) ?: "")
        binding.etPhone.setText(SessionManager.getPhone(ctx) ?: "")
        applyHeader(
            SessionManager.getFirstName(ctx) ?: "Admin",
            SessionManager.getLastName(ctx) ?: "",
            SessionManager.getEmail(ctx) ?: "",
            SessionManager.getRole(ctx) ?: "ADMIN"
        )

        // Show saved photo URL immediately (from previous session)
        prefs().getString(KEY_PHOTO_URL, null)?.let { showPhotoFromUrl(it) }

        // Refresh from API in background
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val profile = ApiClient.adminApi.getProfile(ApiClient.bearerToken())
                binding.etFirstName.setText(profile.firstName)
                binding.etLastName.setText(profile.lastName)
                binding.etEmail.setText(profile.email)
                binding.etPhone.setText(profile.phone ?: "")
                applyHeader(profile.firstName, profile.lastName, profile.email, profile.role)

                // Load photo from backend if available
                profile.profilePhotoUrl?.let { url ->
                    prefs().edit().putString(KEY_PHOTO_URL, url).apply()
                    showPhotoFromUrl(url)
                }
            } catch (_: Exception) {}
        }
    }

    private fun applyHeader(firstName: String, lastName: String, email: String, role: String) {
        binding.tvAdminName.text  = "$firstName $lastName".trim()
        binding.tvAdminEmail.text = email
        binding.tvAdminRole.text  = role
        // Only update initials if no photo is showing
        if (binding.ivProfilePhoto.visibility != View.VISIBLE) {
            binding.tvInitials.text = "${firstName.firstOrNull() ?: ""}${lastName.firstOrNull() ?: ""}".uppercase()
        }
    }

    // ── Profile save ─────────────────────────────────────────────────────────

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
                val updated = ApiClient.adminApi.updateProfile(
                    ApiClient.bearerToken(),
                    UpdateProfileRequest(firstName, lastName, email, phone)
                )
                val ctx = requireContext()
                SessionManager.saveUser(
                    context   = ctx,
                    token     = SessionManager.getToken(ctx) ?: "",
                    firstName = updated.firstName,
                    lastName  = updated.lastName,
                    email     = updated.email,
                    role      = updated.role,
                    userId    = SessionManager.getUserId(ctx) ?: "",
                    phone     = updated.phone ?: ""
                )
                applyHeader(updated.firstName, updated.lastName, updated.email, updated.role)
                toast("Profile updated successfully")
            } catch (e: HttpException) {
                toast(if (e.code() == 401) "Session expired" else getString(R.string.error_network))
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    // ── Photo upload ──────────────────────────────────────────────────────────

    private fun uploadPhoto(uri: Uri) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val mimeType = requireContext().contentResolver.getType(uri) ?: "image/jpeg"
                val ext = when (mimeType) {
                    "image/png"  -> "png"
                    "image/webp" -> "webp"
                    "image/gif"  -> "gif"
                    else         -> "jpg"
                }
                val bytes = withContext(Dispatchers.IO) {
                    requireContext().contentResolver.openInputStream(uri)?.use { it.readBytes() }
                } ?: run { toast("Could not read image"); return@launch }

                val body = bytes.toRequestBody(mimeType.toMediaType())
                val part = MultipartBody.Part.createFormData("photo", "photo.$ext", body)

                val updated = ApiClient.adminApi.uploadProfilePhoto(ApiClient.bearerToken(), part)

                updated.profilePhotoUrl?.let { url ->
                    prefs().edit().putString(KEY_PHOTO_URL, url).apply()
                    showPhotoFromUrl(url)
                }
                toast("Photo updated")
            } catch (e: HttpException) {
                toast(if (e.code() == 401) "Session expired" else "Upload failed")
            } catch (_: Exception) { toast("Could not upload photo") }
        }
    }

    private fun showPhotoFromUrl(url: String) {
        if (!isAdded || _binding == null) return
        Glide.with(this)
            .load(url)
            .circleCrop()
            .into(binding.ivProfilePhoto)
        binding.ivProfilePhoto.visibility = View.VISIBLE
        binding.tvInitials.visibility = View.GONE
    }

    // ── Change password ───────────────────────────────────────────────────────

    private fun showChangePasswordDialog() {
        val view    = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_change_password, null)
        val etOld   = view.findViewById<EditText>(R.id.etOldPassword)
        val etNew   = view.findViewById<EditText>(R.id.etNewPassword)
        val etConf  = view.findViewById<EditText>(R.id.etConfirmPassword)

        AlertDialog.Builder(requireContext())
            .setTitle("Change Password")
            .setView(view)
            .setPositiveButton("Change") { _, _ ->
                val old  = etOld.text.toString()
                val new_ = etNew.text.toString()
                val conf = etConf.text.toString()
                if (old.isEmpty() || new_.isEmpty()) { toast("Fill all fields"); return@setPositiveButton }
                if (new_ != conf) { toast("Passwords do not match"); return@setPositiveButton }
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
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ── Navigation / logout ───────────────────────────────────────────────────

    private fun navigateTo(fragment: Fragment) {
        parentFragmentManager.beginTransaction()
            .replace(R.id.fragmentContainer, fragment)
            .addToBackStack(null)
            .commit()
    }

    private fun performLogout() {
        val token = SessionManager.getToken(requireContext())
        AuthRepository.logout(
            token = token,
            onSuccess = { requireActivity().runOnUiThread { doLogout() } },
            onError = { requireActivity().runOnUiThread { doLogout() } }
        )
    }

    private fun doLogout() {
        SessionManager.clearSession(requireContext())
        SseClient.disconnect()
        startActivity(Intent(requireContext(), Auth::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
        requireActivity().finish()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun prefs() =
        requireContext().getSharedPreferences("more_prefs", Context.MODE_PRIVATE)

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val KEY_PHOTO_URL = "profile_photo_url"
    }
}
