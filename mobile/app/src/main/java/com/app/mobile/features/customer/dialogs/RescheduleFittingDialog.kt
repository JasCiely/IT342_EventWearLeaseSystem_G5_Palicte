package com.app.mobile.features.customer.dialogs

import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.R
import com.app.mobile.features.admin.dialogs.CalendarPickerDialog
import com.app.mobile.features.admin.dialogs.TimeSlotPickerDialog
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.*
import kotlinx.coroutines.launch
import retrofit2.HttpException

class RescheduleFittingDialog : DialogFragment() {

    private lateinit var booking: FittingBooking

    private var selectedDate = ""
    private var selectedTime = ""
    private var bookingSettings: BookingSettings? = null
    private var timeSlots: List<String> = emptyList()
    private var bookedSlots: List<String> = emptyList()

    var onRescheduled: (() -> Unit)? = null

    companion object {
        fun newInstance(booking: FittingBooking): RescheduleFittingDialog {
            return RescheduleFittingDialog().also { it.booking = booking }
        }
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): android.app.Dialog {
        val d = super.onCreateDialog(savedInstanceState)
        d.window?.requestFeature(Window.FEATURE_NO_TITLE)
        return d
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        inflater.inflate(R.layout.dialog_reschedule_fitting, container, false)

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            (resources.displayMetrics.widthPixels * 0.93).toInt(),
            (resources.displayMetrics.heightPixels * 0.75).toInt()
        )
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvItemName     = view.findViewById<TextView>(R.id.tvItemName)
        val tvCurrentSlot  = view.findViewById<TextView>(R.id.tvCurrentSlot)
        val btnPickDate    = view.findViewById<LinearLayout>(R.id.btnPickDate)
        val tvSelectedDate = view.findViewById<TextView>(R.id.tvSelectedDate)
        val btnPickTime    = view.findViewById<LinearLayout>(R.id.btnPickTime)
        val tvSelectedTime = view.findViewById<TextView>(R.id.tvSelectedTime)
        val btnConfirm     = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnConfirm)
        val btnDismiss     = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnDismiss)

        tvItemName.text    = booking.itemName
        tvCurrentSlot.text = "${booking.fittingDate} at ${booking.fittingTime}"

        loadBookingSettings()

        btnPickDate.setOnClickListener {
            val cal = CalendarPickerDialog().apply {
                mode           = CalendarPickerDialog.Mode.FITTING
                itemId         = booking.itemId ?: ""
                passedSettings = bookingSettings
                currentValue   = selectedDate
                onDateSelected = { date ->
                    selectedDate = date
                    tvSelectedDate.text = date
                    tvSelectedDate.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
                    selectedTime = ""
                    tvSelectedTime.text = "Tap to select time"
                    tvSelectedTime.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle))
                    loadTimeSlotsForDate(date)
                }
            }
            cal.show(childFragmentManager, "cal_reschedule_fitting")
        }

        btnPickTime.setOnClickListener {
            if (selectedDate.isEmpty()) {
                toast("Please select a date first")
                return@setOnClickListener
            }
            val picker = TimeSlotPickerDialog().apply {
                this.timeSlots    = this@RescheduleFittingDialog.timeSlots
                this.bookedSlots  = this@RescheduleFittingDialog.bookedSlots
                this.currentValue = selectedTime
                onSlotSelected = { slot ->
                    selectedTime = slot
                    tvSelectedTime.text = slot
                    tvSelectedTime.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
                }
            }
            picker.show(childFragmentManager, "time_reschedule_fitting")
        }

        btnConfirm.setOnClickListener {
            if (selectedDate.isEmpty()) { toast("Please select a new date"); return@setOnClickListener }
            if (selectedTime.isEmpty()) { toast("Please select a new time slot"); return@setOnClickListener }

            btnConfirm.isEnabled = false
            btnConfirm.text = "Rescheduling…"

            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    ApiClient.customerApi.rescheduleFittingBooking(
                        ApiClient.bearerToken(),
                        booking.id,
                        RescheduleRequest(fittingDate = selectedDate, fittingTime = selectedTime)
                    )
                    toast("Appointment rescheduled successfully.")
                    onRescheduled?.invoke()
                    dismiss()
                } catch (e: HttpException) {
                    when (e.code()) {
                        401  -> (activity as? DashboardActivity)?.showSessionExpiredDialog()
                        409  -> toast("This slot is not available. Please choose another.")
                        else -> toast("Reschedule failed: ${e.message()}")
                    }
                    btnConfirm.isEnabled = true
                    btnConfirm.text = "Confirm Reschedule"
                } catch (_: Exception) {
                    toast("Network error. Please try again.")
                    btnConfirm.isEnabled = true
                    btnConfirm.text = "Confirm Reschedule"
                }
            }
        }

        btnDismiss.setOnClickListener { dismiss() }
    }

    private fun loadBookingSettings() {
        viewLifecycleOwner.lifecycleScope.launch {
            bookingSettings = try {
                ApiClient.customerApi.getBookingSettings(ApiClient.bearerToken())
            } catch (_: Exception) { null }
            timeSlots = CalendarPickerDialog.buildTimeSlots(bookingSettings)
        }
    }

    private fun loadTimeSlotsForDate(date: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            bookedSlots = try {
                ApiClient.customerApi.getBookedFittingSlots(booking.itemId ?: "", date)
            } catch (_: Exception) { emptyList() }
        }
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
}
