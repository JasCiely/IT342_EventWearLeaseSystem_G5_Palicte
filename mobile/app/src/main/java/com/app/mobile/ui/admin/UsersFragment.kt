package com.app.mobile.ui.admin

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.mobile.ApiClient
import com.app.mobile.AdminDashboardActivity
import com.app.mobile.R
import com.app.mobile.adapters.UserAdapter
import com.app.mobile.databinding.FragmentUsersBinding
import com.app.mobile.models.AdminUser
import com.app.mobile.models.StatusRequest
import kotlinx.coroutines.launch
import retrofit2.HttpException

class UsersFragment : Fragment() {

    private var _binding: FragmentUsersBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: UserAdapter
    private var allUsers = listOf<AdminUser>()
    private var searchQuery = ""

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentUsersBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.toolbar.setNavigationOnClickListener { parentFragmentManager.popBackStack() }

        adapter = UserAdapter { user -> showUserActions(user) }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { searchQuery = s.toString(); applyFilter() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        binding.swipeRefresh.setOnRefreshListener { loadUsers() }
        loadUsers()
    }

    private fun loadUsers() {
        viewLifecycleOwner.lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            try {
                val resp = ApiClient.adminApi.getUsers(ApiClient.bearerToken(), size = 100)
                allUsers = resp.content
                applyFilter()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Error: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
            binding.swipeRefresh.isRefreshing = false
        }
    }

    private fun applyFilter() {
        val filtered = if (searchQuery.isEmpty()) allUsers
        else allUsers.filter {
            it.fullName.contains(searchQuery, true) ||
            it.email.contains(searchQuery, true) ||
            it.role.contains(searchQuery, true)
        }
        adapter.submitList(filtered)
        binding.tvEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun showUserActions(user: AdminUser) {
        val statusLabel = if (user.active) "Deactivate" else "Activate"
        AlertDialog.Builder(requireContext())
            .setTitle(user.fullName)
            .setMessage("${user.email}\nRole: ${user.role}\nStatus: ${if (user.active) "Active" else "Inactive"}")
            .setItems(arrayOf(statusLabel)) { _, _ ->
                updateUserStatus(user.id, !user.active)
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun updateUserStatus(id: String, active: Boolean) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.updateUserStatus(ApiClient.bearerToken(), id, StatusRequest(active))
                toast("User ${if (active) "activated" else "deactivated"}")
                loadUsers()
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
