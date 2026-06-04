package com.app.mobile.features.admin.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.viewpager2.adapter.FragmentStateAdapter
import androidx.viewpager2.widget.ViewPager2
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.features.admin.dialogs.CreateBookingDialogFragment
import com.app.mobile.R
import com.app.mobile.databinding.FragmentBookingsBinding
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.BookingSettings
import com.google.android.material.tabs.TabLayoutMediator
import kotlinx.coroutines.launch
import retrofit2.HttpException

class BookingsFragment : Fragment() {

    private var _binding: FragmentBookingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentBookingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.viewPager.adapter = object : FragmentStateAdapter(this) {
            override fun getItemCount() = 2
            override fun createFragment(position: Int): Fragment =
                if (position == 0) FittingBookingsFragment() else DirectBookingsFragment()
        }

        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, pos ->
            tab.text = if (pos == 0) "Fitting" else "Direct Lease"
        }.attach()

        binding.viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) { onArchivedCountChanged() }
        })

        binding.fabNewBooking.setOnClickListener {
            val dialog = CreateBookingDialogFragment()
            dialog.onSuccess = {
                childFragmentManager.fragments.forEach { f ->
                    when (f) {
                        is FittingBookingsFragment -> f.reload()
                        is DirectBookingsFragment  -> f.reload()
                    }
                }
            }
            dialog.show(childFragmentManager, "create_booking")
        }

        binding.fabArchived.setOnClickListener {
            when (val f = activeChildFragment()) {
                is FittingBookingsFragment -> f.showArchivedSheet()
                is DirectBookingsFragment  -> f.showArchivedSheet()
            }
        }

        binding.btnSettings.setOnClickListener { showSettingsDialog() }
    }

    private fun showSettingsDialog() {
        viewLifecycleOwner.lifecycleScope.launch {
            var settings = BookingSettings()
            try {
                settings = ApiClient.adminApi.getBookingSettings(ApiClient.bearerToken())
            } catch (e: HttpException) {
                if (e.code() == 401) { (activity as? AdminDashboardActivity)?.showSessionExpiredDialog(); return@launch }
            } catch (_: Exception) {}

            val view       = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_booking_settings, null)
            val switchRestr = view.findViewById<androidx.appcompat.widget.SwitchCompat>(R.id.switchTimeRestrictions)
            val layoutTime  = view.findViewById<View>(R.id.layoutTimeSettings)
            val spinOpen    = view.findViewById<Spinner>(R.id.spinnerOpenHour)
            val spinClose   = view.findViewById<Spinner>(R.id.spinnerCloseHour)
            val etAutoAppr  = view.findViewById<android.widget.EditText>(R.id.etAutoApprove)
            val etFitDur    = view.findViewById<android.widget.EditText>(R.id.etFittingDuration)

            val dayIds = listOf(R.id.daySun, R.id.dayMon, R.id.dayTue, R.id.dayWed, R.id.dayThu, R.id.dayFri, R.id.daySat)
            val dayViews = dayIds.map { view.findViewById<android.widget.TextView>(it) }
            val selectedDays = settings.workingDays.toMutableSet()

            val hourLabels = (0..23).map { h -> "${h.toString().padStart(2, '0')}:00" }
            val hourAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, hourLabels)
            spinOpen.adapter  = hourAdapter
            spinClose.adapter = hourAdapter

            val openHour  = settings.shopOpenTime.split(":").firstOrNull()?.toIntOrNull() ?: 9
            val closeHour = settings.shopCloseTime.split(":").firstOrNull()?.toIntOrNull() ?: 17
            spinOpen.setSelection(openHour)
            spinClose.setSelection(closeHour)

            etAutoAppr.setText(settings.autoApproveThreshold.toString())
            etFitDur.setText(settings.fittingDurationMinutes.toString())

            val enabled = settings.enableTimeRestrictions
            switchRestr.isChecked = enabled
            layoutTime.visibility = if (enabled) View.VISIBLE else View.GONE

            fun refreshDayButtons() {
                dayViews.forEachIndexed { idx, tv ->
                    val active = selectedDays.contains(idx)
                    tv.setBackgroundResource(if (active) R.drawable.bg_button_primary else R.drawable.bg_button_outline)
                    tv.setTextColor(ContextCompat.getColor(requireContext(), if (active) android.R.color.white else R.color.brand_text_dark))
                }
            }
            refreshDayButtons()

            switchRestr.setOnCheckedChangeListener { _, checked ->
                layoutTime.visibility = if (checked) View.VISIBLE else View.GONE
            }

            dayViews.forEachIndexed { idx, tv ->
                tv.setOnClickListener {
                    if (selectedDays.contains(idx)) selectedDays.remove(idx) else selectedDays.add(idx)
                    refreshDayButtons()
                }
            }

            AlertDialog.Builder(requireContext())
                .setTitle("Booking Settings")
                .setView(view)
                .setPositiveButton("Save") { _, _ ->
                    val openH  = spinOpen.selectedItemPosition
                    val closeH = spinClose.selectedItemPosition
                    val newSettings = BookingSettings(
                        enableTimeRestrictions = switchRestr.isChecked,
                        shopOpenTime           = "${openH.toString().padStart(2, '0')}:00",
                        shopCloseTime          = "${closeH.toString().padStart(2, '0')}:00",
                        workingDays            = selectedDays.sorted(),
                        timezone               = settings.timezone,
                        autoApproveThreshold   = etAutoAppr.text.toString().toIntOrNull() ?: 500,
                        fittingDurationMinutes = etFitDur.text.toString().toIntOrNull() ?: 30
                    )
                    viewLifecycleOwner.lifecycleScope.launch {
                        try {
                            ApiClient.adminApi.saveBookingSettings(ApiClient.bearerToken(), newSettings)
                            Toast.makeText(requireContext(), "Settings saved", Toast.LENGTH_SHORT).show()
                        } catch (e: HttpException) {
                            if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                            else Toast.makeText(requireContext(), "Failed to save", Toast.LENGTH_SHORT).show()
                        } catch (_: Exception) {
                            Toast.makeText(requireContext(), getString(R.string.error_network), Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }

    private fun activeChildFragment(): Fragment? {
        val tag = "f${binding.viewPager.currentItem}"
        return childFragmentManager.findFragmentByTag(tag)
    }

    fun onArchivedCountChanged() {
        val hasArchived = when (val f = activeChildFragment()) {
            is FittingBookingsFragment -> f.hasArchivedBookings()
            is DirectBookingsFragment  -> f.hasArchivedBookings()
            else                       -> false
        }
        binding.fabArchived.visibility = if (hasArchived) View.VISIBLE else View.GONE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
