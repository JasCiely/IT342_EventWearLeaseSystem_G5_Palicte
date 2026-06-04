package com.app.mobile.features.admin.fragments

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.features.admin.adapters.CustomerAdapter
import com.app.mobile.R
import com.app.mobile.databinding.FragmentCustomersBinding
import com.app.mobile.databinding.DialogCustomerDetailBinding
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.AdminUser
import com.app.mobile.shared.models.StatusRequest
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import retrofit2.HttpException

class CustomersFragment : Fragment() {

    private var _binding: FragmentCustomersBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: CustomerAdapter

    private var currentPage  = 0
    private var totalPages   = 1
    private var totalItems   = 0
    private val pageSize     = 8
    private var searchQuery  = ""
    private var statusFilter = ""

    private val searchHandler = Handler(Looper.getMainLooper())
    private val searchRunnable = Runnable { loadPage(0) }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentCustomersBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.toolbar.setNavigationOnClickListener { parentFragmentManager.popBackStack() }

        adapter = CustomerAdapter { user -> showCustomerDetail(user) }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter

        setFilterSelected(binding.btnFilterAll)
        binding.btnFilterAll.setOnClickListener      { applyFilter("") }
        binding.btnFilterActive.setOnClickListener   { applyFilter("active") }
        binding.btnFilterInactive.setOnClickListener { applyFilter("inactive") }

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                searchQuery = s.toString().trim()
                searchHandler.removeCallbacks(searchRunnable)
                searchHandler.postDelayed(searchRunnable, 300)
            }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        binding.btnPrev.setOnClickListener { if (currentPage > 0) loadPage(currentPage - 1) }
        binding.btnNext.setOnClickListener { if (currentPage < totalPages - 1) loadPage(currentPage + 1) }

        binding.swipeRefresh.setOnRefreshListener { loadStats(); loadPage(currentPage) }

        loadStats()
        loadPage(0)
    }

    private fun applyFilter(status: String) {
        statusFilter = status
        when (status) {
            ""         -> setFilterSelected(binding.btnFilterAll)
            "active"   -> setFilterSelected(binding.btnFilterActive)
            "inactive" -> setFilterSelected(binding.btnFilterInactive)
        }
        loadPage(0)
    }

    private fun setFilterSelected(selected: com.google.android.material.button.MaterialButton) {
        val btns = listOf(binding.btnFilterAll, binding.btnFilterActive, binding.btnFilterInactive)
        btns.forEach { btn ->
            if (btn === selected) {
                btn.backgroundTintList = ContextCompat.getColorStateList(requireContext(), R.color.brand_burgundy)
                btn.setTextColor(ContextCompat.getColor(requireContext(), android.R.color.white))
            } else {
                btn.backgroundTintList = ContextCompat.getColorStateList(requireContext(), android.R.color.transparent)
                btn.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_burgundy))
            }
        }
    }

    private fun loadStats() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val token = ApiClient.bearerToken()
                val allDef      = async { ApiClient.adminApi.getUsers(token, page = 0, size = 1, search = "", status = "") }
                val activeDef   = async { ApiClient.adminApi.getUsers(token, page = 0, size = 1, search = "", status = "active") }
                val inactiveDef = async { ApiClient.adminApi.getUsers(token, page = 0, size = 1, search = "", status = "inactive") }
                val allRes      = allDef.await()
                val activeRes   = activeDef.await()
                val inactiveRes = inactiveDef.await()
                binding.tvTotalCount.text    = allRes.totalElements.toString()
                binding.tvActiveCount.text   = activeRes.totalElements.toString()
                binding.tvInactiveCount.text = inactiveRes.totalElements.toString()
            } catch (_: Exception) { }
        }
    }

    private fun loadPage(page: Int) {
        viewLifecycleOwner.lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            try {
                val resp = ApiClient.adminApi.getUsers(
                    ApiClient.bearerToken(),
                    page   = page,
                    size   = pageSize,
                    search = searchQuery,
                    status = statusFilter
                )
                currentPage = resp.number
                totalPages  = resp.totalPages.coerceAtLeast(1)
                totalItems  = resp.totalElements

                adapter.submitList(resp.content)
                binding.tvEmpty.visibility = if (resp.content.isEmpty()) View.VISIBLE else View.GONE

                if (totalItems > pageSize) {
                    binding.paginationRow.visibility = View.VISIBLE
                    val start = currentPage * pageSize + 1
                    val end   = minOf((currentPage + 1) * pageSize, totalItems)
                    binding.tvPageInfo.text = "Showing $start–$end of $totalItems"
                    binding.btnPrev.isEnabled = currentPage > 0
                    binding.btnNext.isEnabled = currentPage < totalPages - 1
                } else {
                    binding.paginationRow.visibility = View.GONE
                }
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Error: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
            binding.swipeRefresh.isRefreshing = false
        }
    }

    private fun showCustomerDetail(user: AdminUser) {
        val dialogView  = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_customer_detail, null)
        val db          = DialogCustomerDetailBinding.bind(dialogView)
        val avatarColor = CustomerAdapter.avatarColor(user.id)

        db.cdAvatarFrame.setBackgroundColor(avatarColor)
        db.cdInitials.text  = user.initials
        db.cdFullName.text  = user.fullName
        db.cdRole.text      = user.role
        db.cdEmail.text     = user.email
        db.cdPhone.text     = if (!user.phone.isNullOrBlank()) user.phone else "—"
        db.cdJoined.text    = CustomerAdapter.fmtDate(user.createdAt)
        db.cdLastLogin.text = CustomerAdapter.fmtDate(user.lastLoginAt)

        val ctx = requireContext()
        if (user.active) {
            db.cdStatus.text = "Active"
            db.cdStatus.setTextColor(ContextCompat.getColor(ctx, R.color.status_confirmed_text))
            db.cdStatus.setBackgroundColor(ContextCompat.getColor(ctx, R.color.status_confirmed_bg))
            db.cdBtnToggle.text = "Deactivate Customer"
            db.cdBtnToggle.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.error_red)
        } else {
            db.cdStatus.text = "Inactive"
            db.cdStatus.setTextColor(ContextCompat.getColor(ctx, R.color.status_cancelled_text))
            db.cdStatus.setBackgroundColor(ContextCompat.getColor(ctx, R.color.status_cancelled_bg))
            db.cdBtnToggle.text = "Activate Customer"
            db.cdBtnToggle.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.success_green)
        }

        val dialog = AlertDialog.Builder(requireContext())
            .setTitle("Customer Details")
            .setView(dialogView)
            .setNegativeButton("Close", null)
            .create()

        db.cdBtnToggle.setOnClickListener {
            dialog.dismiss()
            toggleStatus(user)
        }

        dialog.show()
    }

    private fun toggleStatus(user: AdminUser) {
        val newActive = !user.active
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.updateUserStatus(ApiClient.bearerToken(), user.id, StatusRequest(newActive))
                toast("Customer ${if (newActive) "activated" else "deactivated"}")
                loadStats()
                loadPage(currentPage)
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Failed: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        searchHandler.removeCallbacks(searchRunnable)
        super.onDestroyView()
        _binding = null
    }
}
