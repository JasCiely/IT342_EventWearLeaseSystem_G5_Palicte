package com.app.mobile.features.admin.fragments

import android.content.Intent
import android.os.Bundle
import android.view.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import com.app.mobile.R
import com.app.mobile.databinding.FragmentMoreBinding
import com.app.mobile.features.auth.activities.Auth
import com.app.mobile.features.auth.repositories.AuthRepository
import com.app.mobile.shared.sse.SseClient
import com.app.mobile.shared.utils.SessionManager

class MoreFragment : Fragment() {

    private var _binding: FragmentMoreBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentMoreBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val ctx = requireContext()
        val firstName = SessionManager.getFirstName(ctx) ?: "Admin"
        val lastName  = SessionManager.getLastName(ctx) ?: ""
        val email     = SessionManager.getEmail(ctx) ?: ""
        binding.tvAdminName.text  = "$firstName $lastName"
        binding.tvAdminEmail.text = email
        binding.tvInitials.text   = "${firstName.firstOrNull() ?: ""}${lastName.firstOrNull() ?: ""}".uppercase()

        binding.cardCustomers.setOnClickListener { navigateTo(CustomersFragment()) }
        binding.cardUsers.setOnClickListener     { navigateTo(UsersFragment()) }
        binding.cardAttendance.setOnClickListener { navigateTo(AttendanceFragment()) }
        binding.cardProfile.setOnClickListener   { navigateTo(ProfileFragment()) }

        binding.btnLogout.setOnClickListener {
            AlertDialog.Builder(ctx)
                .setTitle("Logout")
                .setMessage("Are you sure you want to log out?")
                .setPositiveButton("Logout") { _, _ -> performLogout() }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

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

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
