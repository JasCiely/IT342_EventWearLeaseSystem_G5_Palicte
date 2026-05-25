package com.app.mobile.features.customer.fragments

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
import com.app.mobile.features.auth.activities.Auth
import com.app.mobile.features.auth.repositories.AuthRepository
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.ChangePasswordRequest
import com.app.mobile.shared.models.UpdateProfileRequest
import com.app.mobile.shared.utils.SessionManager
import com.bumptech.glide.Glide
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException

class CustomerProfileFragment : Fragment() {

    private lateinit var avatarContainer: FrameLayout
    private lateinit var tvInitials: TextView
    private lateinit var ivProfilePhoto: ImageView
    private lateinit var tvFullName: TextView
    private lateinit var tvEmail: TextView
    private lateinit var tvRole: TextView
    private lateinit var tvFirstName: TextView
    private lateinit var tvLastName: TextView
    private lateinit var tvEmailField: TextView
    private lateinit var tvPhone: TextView
    private lateinit var btnEditProfile: TextView
    private lateinit var btnChangePassword: MaterialButton
    private lateinit var btnLogout: MaterialButton

    private val pickImage = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri ?: return@registerForActivityResult
        uploadPhoto(uri)
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        inflater.inflate(R.layout.fragment_customer_profile, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        avatarContainer   = view.findViewById(R.id.avatarContainer)
        tvInitials        = view.findViewById(R.id.tvInitials)
        ivProfilePhoto    = view.findViewById(R.id.ivProfilePhoto)
        tvFullName        = view.findViewById(R.id.tvFullName)
        tvEmail           = view.findViewById(R.id.tvEmail)
        tvRole            = view.findViewById(R.id.tvRole)
        tvFirstName       = view.findViewById(R.id.tvFirstName)
        tvLastName        = view.findViewById(R.id.tvLastName)
        tvEmailField      = view.findViewById(R.id.tvEmailField)
        tvPhone           = view.findViewById(R.id.tvPhone)
        btnEditProfile    = view.findViewById(R.id.btnEditProfile)
        btnChangePassword = view.findViewById(R.id.btnChangePassword)
        btnLogout         = view.findViewById(R.id.btnLogout)

        populateFromSession()
        loadProfile()

        avatarContainer.setOnClickListener { pickImage.launch("image/*") }
        btnEditProfile.setOnClickListener { showEditProfileDialog() }
        btnChangePassword.setOnClickListener { showChangePasswordDialog() }

        btnLogout.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle("Sign Out")
                .setMessage("Are you sure you want to sign out?")
                .setPositiveButton("Sign Out") { _, _ ->
                    val token = SessionManager.getToken(requireContext())
                    AuthRepository.logout(
                        token = token,
                        onSuccess = { activity?.runOnUiThread { goToAuth() } },
                        onError   = { activity?.runOnUiThread { goToAuth() } }
                    )
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    private fun populateFromSession() {
        val ctx       = requireContext()
        val firstName = SessionManager.getFirstName(ctx) ?: ""
        val lastName  = SessionManager.getLastName(ctx) ?: ""
        val email     = SessionManager.getEmail(ctx) ?: ""

        tvInitials.text   = "${firstName.firstOrNull() ?: ""}${lastName.firstOrNull() ?: ""}".uppercase()
        tvFullName.text   = "$firstName $lastName".trim()
        tvEmail.text      = email
        tvFirstName.text  = firstName
        tvLastName.text   = lastName
        tvEmailField.text = email

        prefs().getString(KEY_PHOTO_URL, null)?.let { showPhotoFromUrl(it) }
    }

    private fun loadProfile() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val profile = ApiClient.customerApi.getProfile(ApiClient.bearerToken())
                val ctx     = requireContext()

                tvInitials.text   = profile.initials
                tvFullName.text   = profile.fullName
                tvEmail.text      = profile.email
                tvFirstName.text  = profile.firstName
                tvLastName.text   = profile.lastName
                tvEmailField.text = profile.email
                tvPhone.text      = profile.phone?.takeIf { it.isNotBlank() } ?: "—"
                tvRole.text       = profile.role

                SessionManager.saveUser(
                    ctx,
                    token     = SessionManager.getToken(ctx) ?: "",
                    userId    = profile.id,
                    firstName = profile.firstName,
                    lastName  = profile.lastName,
                    email     = profile.email,
                    role      = profile.role,
                    phone     = profile.phone ?: ""
                )

                profile.profilePhotoUrl?.let { url ->
                    prefs().edit().putString(KEY_PHOTO_URL, url).apply()
                    showPhotoFromUrl(url)
                }
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? DashboardActivity)?.showSessionExpiredDialog()
            } catch (_: Exception) {}
        }
    }

    private fun uploadPhoto(uri: Uri) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val ctx      = requireContext()
                val mimeType = ctx.contentResolver.getType(uri) ?: "image/jpeg"
                val ext = when (mimeType) {
                    "image/png"  -> "png"
                    "image/webp" -> "webp"
                    else         -> "jpg"
                }
                val bytes = withContext(Dispatchers.IO) {
                    ctx.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                } ?: run {
                    Toast.makeText(ctx, "Could not read image", Toast.LENGTH_SHORT).show()
                    return@launch
                }

                val body    = bytes.toRequestBody(mimeType.toMediaType())
                val part    = MultipartBody.Part.createFormData("photo", "photo.$ext", body)
                val updated = ApiClient.customerApi.uploadProfilePhoto(ApiClient.bearerToken(), part)

                updated.profilePhotoUrl?.let { url ->
                    prefs().edit().putString(KEY_PHOTO_URL, url).apply()
                    showPhotoFromUrl(url)
                }
                Toast.makeText(ctx, "Photo updated", Toast.LENGTH_SHORT).show()
            } catch (e: HttpException) {
                if (e.code() == 401) {
                    (activity as? DashboardActivity)?.showSessionExpiredDialog()
                } else {
                    Toast.makeText(requireContext(), "Upload failed", Toast.LENGTH_SHORT).show()
                }
            } catch (_: Exception) {
                Toast.makeText(requireContext(), "Could not upload photo", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showPhotoFromUrl(url: String) {
        if (!isAdded) return
        Glide.with(this)
            .load(url)
            .circleCrop()
            .into(ivProfilePhoto)
        ivProfilePhoto.visibility = View.VISIBLE
        tvInitials.visibility     = View.GONE
    }

    private fun showEditProfileDialog() {
        val ctx  = requireContext()
        val view = layoutInflater.inflate(R.layout.dialog_edit_profile, null)
        val etFirstName = view.findViewById<EditText>(R.id.etFirstName)
        val etLastName  = view.findViewById<EditText>(R.id.etLastName)
        val etEmail     = view.findViewById<EditText>(R.id.etEmail)
        val etPhone     = view.findViewById<EditText>(R.id.etPhone)

        etFirstName.setText(tvFirstName.text)
        etLastName.setText(tvLastName.text)
        etEmail.setText(tvEmailField.text)
        etPhone.setText(if (tvPhone.text == "—") "" else tvPhone.text)

        AlertDialog.Builder(ctx)
            .setTitle("Edit Profile")
            .setView(view)
            .setPositiveButton("Save") { _, _ ->
                val fn    = etFirstName.text.toString().trim()
                val ln    = etLastName.text.toString().trim()
                val email = etEmail.text.toString().trim()
                val phone = etPhone.text.toString().trim().ifEmpty { null }

                if (fn.isEmpty() || ln.isEmpty() || email.isEmpty()) {
                    Toast.makeText(ctx, "Name and email are required", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        val updated = ApiClient.customerApi.updateProfile(
                            ApiClient.bearerToken(),
                            UpdateProfileRequest(fn, ln, email, phone)
                        )
                        SessionManager.saveUser(
                            ctx,
                            token     = SessionManager.getToken(ctx) ?: "",
                            userId    = updated.id,
                            firstName = updated.firstName,
                            lastName  = updated.lastName,
                            email     = updated.email,
                            role      = updated.role,
                            phone     = updated.phone ?: ""
                        )
                        (activity as? DashboardActivity)?.let {
                            val initials = "${updated.firstName.firstOrNull() ?: ""}${updated.lastName.firstOrNull() ?: ""}".uppercase()
                            it.findViewById<TextView>(R.id.tvHeaderInitials)?.text = initials
                        }
                        populateFromSession()
                        Toast.makeText(ctx, "Profile updated!", Toast.LENGTH_SHORT).show()
                    } catch (e: HttpException) {
                        if (e.code() == 401) (activity as? DashboardActivity)?.showSessionExpiredDialog()
                        else Toast.makeText(ctx, "Failed to update profile", Toast.LENGTH_SHORT).show()
                    } catch (_: Exception) {
                        Toast.makeText(ctx, "Network error", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showChangePasswordDialog() {
        val ctx  = requireContext()
        val view = layoutInflater.inflate(R.layout.dialog_change_password, null)
        val etOld     = view.findViewById<EditText>(R.id.etOldPassword)
        val etNew     = view.findViewById<EditText>(R.id.etNewPassword)
        val etConfirm = view.findViewById<EditText>(R.id.etConfirmPassword)

        AlertDialog.Builder(ctx)
            .setTitle("Change Password")
            .setView(view)
            .setPositiveButton("Update") { _, _ ->
                val old     = etOld.text.toString()
                val newPass = etNew.text.toString()
                val confirm = etConfirm.text.toString()

                if (old.isEmpty() || newPass.isEmpty()) {
                    Toast.makeText(ctx, "All fields are required", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                if (newPass != confirm) {
                    Toast.makeText(ctx, "Passwords don't match", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                if (newPass.length < 8) {
                    Toast.makeText(ctx, "Password must be at least 8 characters", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.customerApi.changePassword(
                            ApiClient.bearerToken(),
                            ChangePasswordRequest(old, newPass)
                        )
                        Toast.makeText(ctx, "Password updated successfully!", Toast.LENGTH_SHORT).show()
                    } catch (e: HttpException) {
                        when (e.code()) {
                            400  -> Toast.makeText(ctx, "Current password is incorrect", Toast.LENGTH_SHORT).show()
                            401  -> (activity as? DashboardActivity)?.showSessionExpiredDialog()
                            else -> Toast.makeText(ctx, "Failed to update password", Toast.LENGTH_SHORT).show()
                        }
                    } catch (_: Exception) {
                        Toast.makeText(ctx, "Network error", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun prefs() =
        requireContext().getSharedPreferences("customer_profile_prefs", Context.MODE_PRIVATE)

    private fun goToAuth() {
        SessionManager.clearSession(requireContext())
        startActivity(Intent(requireContext(), Auth::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        })
    }

    companion object {
        private const val KEY_PHOTO_URL = "profile_photo_url"
    }
}
