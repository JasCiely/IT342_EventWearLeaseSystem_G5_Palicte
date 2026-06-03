package com.app.mobile.features.customer.dialogs

import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.R
import com.app.mobile.features.admin.dialogs.CalendarPickerDialog
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.*
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class EditDirectDatesDialog : DialogFragment() {

    private lateinit var booking: DirectBooking

    private var selectedStart = ""
    private var selectedEnd   = ""
    private var bookingSettings: BookingSettings? = null
    private var inventorySettings: InventorySettings? = null
    private var occupiedRanges: List<OccupiedDateRange> = emptyList()

    private val isActiveLease get() = booking.bookingStatus.uppercase() == "ACTIVE LEASE" ||
            booking.bookingStatus.uppercase() == "ACTIVE"

    var onRescheduled: (() -> Unit)? = null

    companion object {
        fun newInstance(booking: DirectBooking): EditDirectDatesDialog {
            return EditDirectDatesDialog().also { it.booking = booking }
        }
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): android.app.Dialog {
        val d = super.onCreateDialog(savedInstanceState)
        d.window?.requestFeature(Window.FEATURE_NO_TITLE)
        return d
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        inflater.inflate(R.layout.dialog_edit_direct_dates, container, false)

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            (resources.displayMetrics.widthPixels * 0.93).toInt(),
            (resources.displayMetrics.heightPixels * 0.88).toInt()
        )
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvItemName       = view.findViewById<TextView>(R.id.tvItemName)
        val tvCurrentDates   = view.findViewById<TextView>(R.id.tvCurrentDates)
        val tvActiveLeaseNote = view.findViewById<TextView>(R.id.tvActiveLeasNote)
        val btnPickStart     = view.findViewById<LinearLayout>(R.id.btnPickStart)
        val tvStartDate      = view.findViewById<TextView>(R.id.tvStartDate)
        val btnPickEnd       = view.findViewById<LinearLayout>(R.id.btnPickEnd)
        val tvEndDate        = view.findViewById<TextView>(R.id.tvEndDate)
        val cardPriceSummary = view.findViewById<LinearLayout>(R.id.cardPriceSummary)
        val tvDuration       = view.findViewById<TextView>(R.id.tvDuration)
        val tvBasePrice      = view.findViewById<TextView>(R.id.tvBasePrice)
        val rowDiscount      = view.findViewById<LinearLayout>(R.id.rowDiscount)
        val tvDiscount       = view.findViewById<TextView>(R.id.tvDiscount)
        val tvTotal          = view.findViewById<TextView>(R.id.tvTotal)
        val btnConfirm       = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnConfirm)
        val btnDismiss       = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnDismiss)

        tvItemName.text    = booking.itemName
        tvCurrentDates.text = "${formatDate(booking.startDate)} → ${formatDate(booking.endDate)} · ${booking.totalDays} day${if (booking.totalDays != 1) "s" else ""}"

        // Pre-fill with current dates
        selectedStart = booking.startDate
        selectedEnd   = booking.endDate
        tvStartDate.text = booking.startDate
        tvStartDate.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
        tvEndDate.text = booking.endDate
        tvEndDate.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))

        if (isActiveLease) {
            tvActiveLeaseNote.visibility = View.VISIBLE
            // Lock start date — disable the start date picker
            btnPickStart.isEnabled = false
            btnPickStart.alpha = 0.5f
        }

        loadSettings()

        fun updatePriceSummary() {
            if (selectedStart.isEmpty() || selectedEnd.isEmpty()) {
                cardPriceSummary.visibility = View.GONE
                return
            }
            try {
                val sdf   = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                val start = sdf.parse(selectedStart)!!
                val end   = sdf.parse(selectedEnd)!!
                if (end < start) { cardPriceSummary.visibility = View.GONE; return }
                val days  = (((end.time - start.time) / 86_400_000L).toInt() + 1).coerceAtLeast(1)
                val base  = booking.basePrice / booking.totalDays.coerceAtLeast(1) * days

                val weeklyDisc  = if (days >= 7) (inventorySettings?.weeklyDiscount ?: 0).toDouble() else 0.0
                val monthlyDisc = if (days >= 30) (inventorySettings?.monthlyDiscountCap ?: 0).toDouble() else 0.0
                val discount    = weeklyDisc + monthlyDisc

                tvDuration.text  = "$days day${if (days != 1) "s" else ""}"
                tvBasePrice.text = "₱${String.format("%.2f", base)}"

                if (discount > 0) {
                    rowDiscount.visibility = View.VISIBLE
                    tvDiscount.text = "-₱${String.format("%.2f", discount)}"
                } else {
                    rowDiscount.visibility = View.GONE
                }

                tvTotal.text = "₱${String.format("%.2f", (base - discount).coerceAtLeast(0.0))}"
                cardPriceSummary.visibility = View.VISIBLE
            } catch (_: Exception) {
                cardPriceSummary.visibility = View.GONE
            }
        }

        updatePriceSummary()

        btnPickStart.setOnClickListener {
            val cal = CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                itemId               = booking.inventoryItemId ?: ""
                passedSettings       = bookingSettings
                passedOccupiedRanges = occupiedRangesExcludingCurrent()
                minDate              = minLeasingStart()
                currentValue         = selectedStart
                onDateSelected       = { date ->
                    selectedStart = date
                    tvStartDate.text = date
                    tvStartDate.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
                    if (selectedEnd.isNotEmpty() && selectedEnd <= selectedStart) {
                        selectedEnd = ""
                        tvEndDate.text = "Tap to select end date"
                        tvEndDate.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle))
                    }
                    updatePriceSummary()
                }
            }
            cal.show(childFragmentManager, "cal_edit_start")
        }

        btnPickEnd.setOnClickListener {
            val minEnd = if (isActiveLease) booking.startDate else selectedStart
            if (minEnd.isEmpty()) {
                toast("Please select a start date first")
                return@setOnClickListener
            }
            val cal = CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                itemId               = booking.inventoryItemId ?: ""
                passedSettings       = bookingSettings
                passedOccupiedRanges = occupiedRangesExcludingCurrent()
                minDate              = minEnd
                currentValue         = selectedEnd
                onDateSelected       = { date ->
                    selectedEnd = date
                    tvEndDate.text = date
                    tvEndDate.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
                    updatePriceSummary()
                }
            }
            cal.show(childFragmentManager, "cal_edit_end")
        }

        btnConfirm.setOnClickListener {
            if (selectedStart.isEmpty()) { toast("Please select a start date"); return@setOnClickListener }
            if (selectedEnd.isEmpty())   { toast("Please select an end date");   return@setOnClickListener }
            if (selectedEnd < selectedStart) { toast("End date cannot be before start date"); return@setOnClickListener }

            if (!isActiveLease && selectedStart < minLeasingStart()) {
                val advanceDays = inventorySettings?.minLeaseDays ?: 2
                toast("Bookings must be made at least $advanceDays days in advance.")
                return@setOnClickListener
            }

            when (classifyDateRange(selectedStart, selectedEnd)) {
                "blocked" -> {
                    toast("Selected dates are not available — a confirmed booking exists for those dates.")
                    return@setOnClickListener
                }
                "pending" -> {
                    toast("Note: a pending booking overlaps your selected dates.")
                }
            }

            btnConfirm.isEnabled = false
            btnConfirm.text = "Saving…"

            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    ApiClient.customerApi.editDirectBookingDates(
                        ApiClient.bearerToken(),
                        booking.id,
                        UpdateDatesRequest(startDate = selectedStart, endDate = selectedEnd)
                    )
                    toast("Rental dates updated successfully.")
                    onRescheduled?.invoke()
                    dismiss()
                } catch (e: HttpException) {
                    when (e.code()) {
                        401  -> (activity as? DashboardActivity)?.showSessionExpiredDialog()
                        409  -> toast("These dates are not available.")
                        else -> toast("Update failed: ${e.message()}")
                    }
                    btnConfirm.isEnabled = true
                    btnConfirm.text = "Save New Dates"
                } catch (_: Exception) {
                    toast("Network error. Please try again.")
                    btnConfirm.isEnabled = true
                    btnConfirm.text = "Save New Dates"
                }
            }
        }

        btnDismiss.setOnClickListener { dismiss() }
    }

    private fun loadSettings() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                bookingSettings   = ApiClient.customerApi.getBookingSettings()
                inventorySettings = ApiClient.customerApi.getInventorySettings(ApiClient.bearerToken())
                occupiedRanges    = ApiClient.customerApi.getOccupiedDates(
                    ApiClient.bearerToken(), booking.inventoryItemId ?: ""
                )
            } catch (_: Exception) {
                bookingSettings   = null
                inventorySettings = InventorySettings()
            }
        }
    }

    private fun occupiedRangesExcludingCurrent(): List<OccupiedDateRange> =
        occupiedRanges.filter { range ->
            !(range.startDate == booking.startDate && range.endDate == booking.endDate)
        }

    private fun minLeasingStart(): String {
        val advanceDays = inventorySettings?.minLeaseDays ?: 2
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_MONTH, advanceDays)
        return "${cal.get(Calendar.YEAR)}-${(cal.get(Calendar.MONTH)+1).toString().padStart(2,'0')}-${cal.get(Calendar.DAY_OF_MONTH).toString().padStart(2,'0')}"
    }

    private fun classifyDateRange(startDate: String, endDate: String): String {
        if (occupiedRanges.isEmpty()) return "free"
        var hasPending = false
        for (r in occupiedRangesExcludingCurrent()) {
            if (startDate > r.endDate || endDate < r.startDate) continue
            when (r.status) {
                "Approved", "Confirmed", "Active Lease", "Under Maintenance" -> return "blocked"
                "Pending" -> hasPending = true
                else -> return "blocked"
            }
        }
        return if (hasPending) "pending" else "free"
    }

    private fun formatDate(dateStr: String): String = try {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(sdf.parse(dateStr)!!)
    } catch (_: Exception) { dateStr }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
}
