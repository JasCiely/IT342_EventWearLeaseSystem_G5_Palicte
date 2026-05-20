package com.app.mobile.features.admin.fragments

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.mobile.R
import com.app.mobile.databinding.FragmentStaffBinding
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.features.admin.adapters.StaffAdapter
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.CreateStaffRequest
import com.app.mobile.shared.models.Staff
import kotlinx.coroutines.launch
import retrofit2.HttpException

class StaffFragment : Fragment() {

    private var _binding: FragmentStaffBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: StaffAdapter
    private var allStaff = listOf<Staff>()
    private var searchQuery = ""

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentStaffBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = StaffAdapter { staff -> showStaffActions(staff) }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { searchQuery = s.toString(); applyFilter() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        binding.swipeRefresh.setOnRefreshListener { loadStaff() }
        binding.fabAdd.setOnClickListener { showStaffDialog(null) }
        loadStaff()
    }

    private fun loadStaff() {
        viewLifecycleOwner.lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            try {
                val resp = ApiClient.adminApi.getStaff(ApiClient.bearerToken())
                allStaff = resp.content
                applyFilter()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Error: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
            binding.swipeRefresh.isRefreshing = false
        }
    }

    private fun applyFilter() {
        val filtered = if (searchQuery.isEmpty()) allStaff
        else allStaff.filter {
            it.fullName.contains(searchQuery, true) ||
            it.email.contains(searchQuery, true) ||
            it.role.contains(searchQuery, true) ||
            it.status.contains(searchQuery, true)
        }
        adapter.submitList(filtered)
        binding.tvEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun showStaffActions(staff: Staff) {
        AlertDialog.Builder(requireContext())
            .setTitle(staff.fullName)
            .setMessage("${staff.role} | ${staff.status}\nDays worked: ${staff.daysWorked}")
            .setItems(arrayOf("Edit", "Delete")) { _, idx ->
                if (idx == 0) showStaffDialog(staff) else confirmDelete(staff)
            }.show()
    }

    private fun showStaffDialog(staff: Staff?) {
        val view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_staff, null)
        val etName       = view.findViewById<android.widget.EditText>(R.id.etFullName)
        val etEmail      = view.findViewById<android.widget.EditText>(R.id.etEmail)
        val etRole       = view.findViewById<android.widget.EditText>(R.id.etRole)
        val spStatus     = view.findViewById<Spinner>(R.id.spStatus)
        val etCustomRate = view.findViewById<android.widget.EditText>(R.id.etCustomRate)

        val statuses = arrayOf("On Duty", "Off Duty")
        spStatus.adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, statuses)

        staff?.let {
            etName.setText(it.fullName)
            etEmail.setText(it.email)
            etRole.setText(it.role)
            spStatus.setSelection(statuses.indexOf(it.status).coerceAtLeast(0))
            it.customRate?.let { r -> etCustomRate.setText(r.toString()) }
        }

        AlertDialog.Builder(requireContext())
            .setTitle(if (staff == null) "Add Staff" else "Edit Staff")
            .setView(view)
            .setPositiveButton(if (staff == null) "Add" else "Save") { _, _ ->
                val name   = etName.text.toString().trim()
                val email  = etEmail.text.toString().trim()
                val role   = etRole.text.toString().trim()
                val status = spStatus.selectedItem.toString()
                val rate   = etCustomRate.text.toString().toDoubleOrNull()
                if (name.isEmpty() || email.isEmpty() || role.isEmpty()) {
                    toast("Name, email, and role are required"); return@setPositiveButton
                }
                val body = CreateStaffRequest(name, email, role, status, rate)
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        if (staff == null) ApiClient.adminApi.createStaff(ApiClient.bearerToken(), body)
                        else ApiClient.adminApi.updateStaff(ApiClient.bearerToken(), staff.id, body)
                        toast(if (staff == null) "Staff added" else "Staff updated")
                        loadStaff()
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun confirmDelete(staff: Staff) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete Staff")
            .setMessage("Remove ${staff.fullName}?")
            .setPositiveButton("Delete") { _, _ ->
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.deleteStaff(ApiClient.bearerToken(), staff.id)
                        toast("Staff removed")
                        loadStaff()
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
