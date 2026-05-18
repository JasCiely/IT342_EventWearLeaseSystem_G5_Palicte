package com.app.mobile.ui.admin

import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.mobile.ApiClient
import com.app.mobile.AdminDashboardActivity
import com.app.mobile.R
import com.app.mobile.adapters.AttendanceAdapter
import com.app.mobile.databinding.FragmentAttendanceBinding
import com.app.mobile.models.TodayAttendanceItem
import com.app.mobile.models.UpdateAttendanceRequest
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.time.LocalDate

class AttendanceFragment : Fragment() {

    private var _binding: FragmentAttendanceBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: AttendanceAdapter
    private var todayRecords = listOf<TodayAttendanceItem>()
    private var sessionLocked = true

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentAttendanceBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.toolbar.setNavigationOnClickListener { parentFragmentManager.popBackStack() }

        val today = if (android.os.Build.VERSION.SDK_INT >= 26) LocalDate.now().toString()
        else java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date())
        binding.tvDate.text = "Today: $today"

        adapter = AttendanceAdapter { record ->
            if (!sessionLocked) showEditDialog(record) else toast("Session is locked. Unlock to edit.")
        }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter

        binding.btnRecord.setOnClickListener { recordAttendance() }
        binding.btnUnlock.setOnClickListener { unlockAttendance() }
        binding.swipeRefresh.setOnRefreshListener { loadTodayAttendance() }

        loadTodayAttendance()
    }

    private fun loadTodayAttendance() {
        viewLifecycleOwner.lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            try {
                val resp = ApiClient.adminApi.getTodayAttendance(ApiClient.bearerToken())
                todayRecords = resp.records
                sessionLocked = resp.session != null
                adapter.submitList(todayRecords)
                binding.tvSessionStatus.text = if (resp.session != null) "Session recorded • ${if (sessionLocked) "Locked" else "Unlocked"}" else "No session yet"
                binding.tvEmpty.visibility = if (todayRecords.isEmpty()) View.VISIBLE else View.GONE
                binding.btnRecord.isEnabled = resp.session == null
                binding.btnUnlock.isEnabled = resp.session != null
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
            binding.swipeRefresh.isRefreshing = false
        }
    }

    private fun recordAttendance() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.recordAttendance(ApiClient.bearerToken())
                toast("Attendance recorded")
                loadTodayAttendance()
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun unlockAttendance() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.unlockAttendance(ApiClient.bearerToken())
                sessionLocked = false
                toast("Attendance unlocked for editing")
                loadTodayAttendance()
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun showEditDialog(record: TodayAttendanceItem) {
        val view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_edit_attendance, null)
        val spStatus    = view.findViewById<Spinner>(R.id.spStatus)
        val cbLate      = view.findViewById<CheckBox>(R.id.cbIsLate)
        val etLateMin   = view.findViewById<EditText>(R.id.etLateMinutes)

        val statuses = arrayOf("Present", "Absent", "Leave")
        spStatus.adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, statuses)
        spStatus.setSelection(statuses.indexOf(record.status).coerceAtLeast(0))
        cbLate.isChecked = record.isLate
        etLateMin.setText(record.lateMinutes?.toString() ?: "")

        AlertDialog.Builder(requireContext())
            .setTitle("Edit: ${record.staffName ?: record.staffId}")
            .setView(view)
            .setPositiveButton("Save") { _, _ ->
                val status = spStatus.selectedItem.toString()
                val isLate = cbLate.isChecked
                val lateMin = etLateMin.text.toString().toIntOrNull()
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.editAttendanceRecord(ApiClient.bearerToken(), record.id, UpdateAttendanceRequest(status, isLate, lateMin))
                        toast("Record updated")
                        loadTodayAttendance()
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
