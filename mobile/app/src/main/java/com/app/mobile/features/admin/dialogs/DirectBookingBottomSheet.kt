package com.app.mobile.features.admin.dialogs

import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.app.mobile.R
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.features.admin.fragments.DirectBookingsFragment
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.*
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.util.*

class DirectBookingBottomSheet : BottomSheetDialogFragment() {

    lateinit var booking: DirectBooking
    var onReload: (() -> Unit)? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.bottom_sheet_direct_booking, container, false)

    override fun onStart() {
        super.onStart()
        (dialog as? BottomSheetDialog)?.behavior?.apply {
            state = BottomSheetBehavior.STATE_EXPANDED
            skipCollapsed = true
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        bindHeader(view)
        bindDetails(view)
        bindActionButtons(view)
    }

    fun rebind(newBooking: DirectBooking) {
        booking = newBooking
        val v = view ?: return
        bindHeader(v)
        bindDetails(v)
        bindActionButtons(v)
    }

    private fun bindHeader(v: View) {
        v.findViewById<TextView>(R.id.tvBookingId).text = "#${booking.id.takeLast(8).uppercase()}"
        v.findViewById<TextView>(R.id.tvCustomerName).text = booking.customerName

        val tvStatus = v.findViewById<TextView>(R.id.tvStatusBadge)
        tvStatus.text = booking.bookingStatus
        applyStatusBadge(tvStatus, booking.bookingStatus)

        val tvExtended = v.findViewById<TextView>(R.id.tvExtendedBadge)
        tvExtended.visibility = if (booking.extended) View.VISIBLE else View.GONE
    }

    private fun bindDetails(v: View) {
        v.findViewById<TextView>(R.id.tvItemName).text = booking.itemName

        val tvSize = v.findViewById<TextView>(R.id.tvItemSize)
        if (!booking.preferredSize.isNullOrEmpty()) {
            tvSize.text = "Size: ${booking.preferredSize}"
            tvSize.visibility = View.VISIBLE
        }

        val tvEmail = v.findViewById<TextView>(R.id.tvCustomerEmail)
        if (!booking.customerEmail.isNullOrEmpty()) {
            tvEmail.text = "✉  ${booking.customerEmail}"
            tvEmail.visibility = View.VISIBLE
        }

        val tvPhone = v.findViewById<TextView>(R.id.tvCustomerPhone)
        if (!booking.customerPhone.isNullOrEmpty()) {
            tvPhone.text = "📞  ${booking.customerPhone}"
            tvPhone.visibility = View.VISIBLE
        }

        v.findViewById<TextView>(R.id.tvStartDate).text = booking.startDate
        v.findViewById<TextView>(R.id.tvEndDate).text   = booking.endDate
        v.findViewById<TextView>(R.id.tvTotalDays).text = booking.totalDays.toString()

        v.findViewById<TextView>(R.id.tvBasePrice).text =
            "₱${String.format("%.2f", booking.basePrice)}"
        v.findViewById<TextView>(R.id.tvFinalPrice).text =
            "₱${String.format("%.2f", booking.finalPrice)}"

        if (booking.discountAmount > 0) {
            v.findViewById<View>(R.id.rowDiscount).visibility = View.VISIBLE
            v.findViewById<TextView>(R.id.tvDiscount).text =
                "-₱${String.format("%.2f", booking.discountAmount)}"
        }

        if (!booking.notes.isNullOrEmpty()) {
            v.findViewById<View>(R.id.notesDivider).visibility = View.VISIBLE
            v.findViewById<TextView>(R.id.tvNotesLabel).visibility = View.VISIBLE
            v.findViewById<TextView>(R.id.tvNotes).apply {
                text = booking.notes
                visibility = View.VISIBLE
            }
        }
    }

    private fun bindActionButtons(v: View) {
        val btnConfirm          = v.findViewById<Button>(R.id.btnConfirm)
        val btnPickup           = v.findViewById<Button>(R.id.btnPickup)
        val btnReturn           = v.findViewById<Button>(R.id.btnReturn)
        val btnExtendLease      = v.findViewById<Button>(R.id.btnExtendLease)
        val btnEditDates        = v.findViewById<Button>(R.id.btnEditDates)
        val btnEditInline       = v.findViewById<Button>(R.id.btnEditDatesInline)
        val btnResendEmail      = v.findViewById<Button>(R.id.btnResendEmail)
        val btnCancel           = v.findViewById<Button>(R.id.btnCancel)
        val layoutPickupWarning = v.findViewById<View>(R.id.layoutPickupWarning)

        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
            .format(java.util.Date())

        when (booking.bookingStatus) {
            "Pending" -> {
                btnConfirm.visibility    = View.VISIBLE
                btnEditDates.visibility  = View.VISIBLE
                btnEditInline.visibility = View.VISIBLE
                btnCancel.visibility     = View.VISIBLE
            }
            "Approved" -> {
                if (!booking.startDate.isNullOrEmpty() && booking.startDate <= today) {
                    btnPickup.visibility          = View.VISIBLE
                    layoutPickupWarning.visibility = View.VISIBLE
                }
                btnEditDates.visibility  = View.VISIBLE
                btnEditInline.visibility = View.VISIBLE
                btnCancel.visibility     = View.VISIBLE
            }
            "Active Lease" -> {
                btnReturn.visibility      = View.VISIBLE
                btnExtendLease.visibility = View.VISIBLE
                val isReturnableToday = !booking.endDate.isNullOrEmpty() && today >= booking.endDate
                btnReturn.isEnabled = isReturnableToday
                btnReturn.alpha     = if (isReturnableToday) 1.0f else 0.4f
            }
        }
        btnResendEmail.visibility = View.VISIBLE

        btnConfirm.setOnClickListener      { updateStatus("Approved") }
        btnCancel.setOnClickListener       { updateStatus("Cancelled") }
        btnPickup.setOnClickListener       { markPickup() }
        btnReturn.setOnClickListener       { confirmReturn() }
        btnExtendLease.setOnClickListener  {
            dismiss()
            showExtendDialog()
        }
        btnEditDates.setOnClickListener    {
            dismiss()
            showEditRentalDatesDialog()
        }
        btnEditInline.setOnClickListener   {
            dismiss()
            showEditRentalDatesDialog()
        }
        btnResendEmail.setOnClickListener  { resendEmail() }
    }

    private fun applyStatusBadge(tv: TextView, status: String) {
        val (bgColor, textColor) = when (status) {
            "Pending" -> Pair(
                ContextCompat.getColor(requireContext(), R.color.status_pending_bg),
                ContextCompat.getColor(requireContext(), R.color.status_pending_text)
            )
            "Approved" -> Pair(
                ContextCompat.getColor(requireContext(), R.color.status_confirmed_bg),
                ContextCompat.getColor(requireContext(), R.color.status_confirmed_text)
            )
            "Active Lease" -> Pair(
                ContextCompat.getColor(requireContext(), R.color.status_active_bg),
                ContextCompat.getColor(requireContext(), R.color.status_active_text)
            )
            "Completed" -> Pair(
                ContextCompat.getColor(requireContext(), R.color.status_completed_bg),
                ContextCompat.getColor(requireContext(), R.color.status_completed_text)
            )
            "Cancelled" -> Pair(
                ContextCompat.getColor(requireContext(), R.color.status_cancelled_bg),
                ContextCompat.getColor(requireContext(), R.color.status_cancelled_text)
            )
            else -> Pair(
                ContextCompat.getColor(requireContext(), R.color.gray_300),
                ContextCompat.getColor(requireContext(), R.color.brand_text_dark)
            )
        }
        val bg = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            setColor(bgColor)
            cornerRadius = 20f
        }
        tv.background = bg
        tv.setTextColor(textColor)
    }

    private fun updateStatus(status: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.updateDirectStatus(ApiClient.bearerToken(), booking.id, status)
                toast("Status → $status")
                onReload?.invoke()
                dismiss()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Failed: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun markPickup() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.markPickup(ApiClient.bearerToken(), booking.id)
                toast("Marked as picked up")
                onReload?.invoke()
                dismiss()
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun confirmReturn() {
        AlertDialog.Builder(requireContext())
            .setTitle("Confirm Return")
            .setMessage("Mark this item as returned? This will complete the booking.\n\n${booking.customerName} — ${booking.itemName}")
            .setPositiveButton("Mark Returned") { _, _ ->
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.markReturn(ApiClient.bearerToken(), booking.id)
                        toast("Marked as returned")
                        onReload?.invoke()
                        dismiss()
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Back", null)
            .show()
    }

    private fun resendEmail() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.resendDirectEmail(ApiClient.bearerToken(), booking.id)
                toast("Email sent")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun showExtendDialog() {
        val parent = parentFragment as? DirectBookingsFragment ?: return
        parent.showExtendDialog(booking)
    }

    private fun showEditRentalDatesDialog() {
        val parent = parentFragment as? DirectBookingsFragment ?: return
        parent.showEditRentalDatesDialog(booking)
    }

    private fun toast(msg: String) =
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
}
