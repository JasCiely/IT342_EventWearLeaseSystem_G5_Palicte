package com.app.mobile.features.admin.fragments

import android.app.TimePickerDialog
import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.R
import com.app.mobile.databinding.FragmentSettingsBinding
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.BookingSettings
import com.app.mobile.shared.models.InventorySettings
import com.app.mobile.shared.models.SalarySettingsRequest
import kotlinx.coroutines.launch
import retrofit2.HttpException

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.toolbar.setNavigationOnClickListener { parentFragmentManager.popBackStack() }

        setupTimePickers()
        loadSettings()

        binding.btnSaveSalary.setOnClickListener { saveSalarySettings() }
        binding.btnSaveBooking.setOnClickListener { saveBookingSettings() }
        binding.btnSaveInventory.setOnClickListener { saveInventorySettings() }
    }

    private fun setupTimePickers() {
        binding.etOpenTime.setOnClickListener { showTimePicker(binding.etOpenTime) }
        binding.etCloseTime.setOnClickListener { showTimePicker(binding.etCloseTime) }
    }

    private fun showTimePicker(target: EditText) {
        val current = target.text.toString().split(":")
        val hour   = current.getOrNull(0)?.toIntOrNull() ?: 9
        val minute = current.getOrNull(1)?.toIntOrNull() ?: 0
        TimePickerDialog(requireContext(), { _, h, m ->
            target.setText("%02d:%02d".format(h, m))
        }, hour, minute, true).show()
    }

    private fun loadSettings() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val settings = ApiClient.adminApi.getSettings(ApiClient.bearerToken())
                if (settings.defaultDailyRate > 0) {
                    binding.etBaseRate.setText(settings.defaultDailyRate.toInt().toString())    
                } else {
                    settings.salarySettings?.let { s ->
                        binding.etBaseRate.setText(s.baseRate.toString())
                        binding.etOvertimeRate.setText(s.overtimeRate.toString())
                    }
                }
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
            } catch (_: Exception) {}

            try {
                val bs = ApiClient.adminApi.getBookingSettings(ApiClient.bearerToken())
                binding.switchTimeRestrictions.isChecked = bs.enableTimeRestrictions
                binding.etOpenTime.setText(bs.shopOpenTime)
                binding.etCloseTime.setText(bs.shopCloseTime)
                val days = bs.workingDays.toSet()
                binding.cbMon.isChecked = 1 in days
                binding.cbTue.isChecked = 2 in days
                binding.cbWed.isChecked = 3 in days
                binding.cbThu.isChecked = 4 in days
                binding.cbFri.isChecked = 5 in days
                binding.cbSat.isChecked = 6 in days
                binding.cbSun.isChecked = 7 in days
                binding.etFittingDuration.setText(bs.fittingDurationMinutes.toString())
                binding.etAutoApprove.setText(bs.autoApproveThreshold.toString())
            } catch (_: Exception) {}

            try {
                val inv = ApiClient.adminApi.getInventorySettings(ApiClient.bearerToken())
                binding.etMinLeaseDays.setText(inv.minLeaseDays.toString())
                binding.etWeeklyDiscount.setText(inv.weeklyDiscount.toString())
                binding.etMonthlyDiscountCap.setText(inv.monthlyDiscountCap.toString())
            } catch (_: Exception) {}
        }
    }

    private fun saveSalarySettings() {
        val baseRate = binding.etBaseRate.text.toString().toDoubleOrNull()
        val overtimeRate = binding.etOvertimeRate.text.toString().toDoubleOrNull()
        if (baseRate == null || overtimeRate == null) { toast("Enter valid rates"); return }
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.updateSalarySettings(ApiClient.bearerToken(), SalarySettingsRequest(baseRate))
                toast("Salary settings saved")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun saveBookingSettings() {
        val openTime  = binding.etOpenTime.text.toString().trim()
        val closeTime = binding.etCloseTime.text.toString().trim()
        val duration  = binding.etFittingDuration.text.toString().toIntOrNull()
        val threshold = binding.etAutoApprove.text.toString().toIntOrNull()

        if (openTime.isEmpty() || closeTime.isEmpty() || duration == null || threshold == null) {
            toast("Fill all booking settings fields"); return
        }

        val workingDays = buildList {
            if (binding.cbMon.isChecked) add(1)
            if (binding.cbTue.isChecked) add(2)
            if (binding.cbWed.isChecked) add(3)
            if (binding.cbThu.isChecked) add(4)
            if (binding.cbFri.isChecked) add(5)
            if (binding.cbSat.isChecked) add(6)
            if (binding.cbSun.isChecked) add(7)
        }
        if (workingDays.isEmpty()) { toast("Select at least one working day"); return }

        val req = BookingSettings(
            enableTimeRestrictions = binding.switchTimeRestrictions.isChecked,
            shopOpenTime           = openTime,
            shopCloseTime          = closeTime,
            workingDays            = workingDays,
            autoApproveThreshold   = threshold,
            fittingDurationMinutes = duration
        )
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.saveBookingSettings(ApiClient.bearerToken(), req)
                toast("Booking settings saved")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun saveInventorySettings() {
        val minDays      = binding.etMinLeaseDays.text.toString().toIntOrNull()
        val weeklyDisc   = binding.etWeeklyDiscount.text.toString().toIntOrNull()
        val monthlyDisc  = binding.etMonthlyDiscountCap.text.toString().toIntOrNull()

        if (minDays == null || weeklyDisc == null || monthlyDisc == null) {
            toast("Fill all inventory settings fields"); return
        }
        val req = InventorySettings(
            minLeaseDays      = minDays,
            weeklyDiscount    = weeklyDisc,
            monthlyDiscountCap = monthlyDisc
        )
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.updateInventorySettings(ApiClient.bearerToken(), req)
                toast("Inventory settings saved")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
