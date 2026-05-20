package com.app.mobile.ui.admin

import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.app.mobile.AdminDashboardActivity
import com.app.mobile.ApiClient
import com.app.mobile.R
import com.app.mobile.models.*
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.util.*

class FittingBookingBottomSheet : BottomSheetDialogFragment() {

    lateinit var booking: FittingBooking
    var allItems: List<InventoryItem> = emptyList()
    var onReload: (() -> Unit)? = null
    var onReschedule: ((FittingBooking) -> Unit)? = null
    var onProceedToLease: ((FittingBooking) -> Unit)? = null

    private var settings: BookingSettings? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.bottom_sheet_fitting_booking, container, false)

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

        // Fetch booking settings async, then enable/disable Done button and show in-progress banner
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                settings = ApiClient.adminApi.getBookingSettings(ApiClient.bearerToken())
            } catch (_: Exception) { }
            val v = this@FittingBookingBottomSheet.view ?: return@launch
            updateDoneButtonState(v)
            updateInProgressBanner(v)
        }
    }

    // ── Binding ───────────────────────────────────────────────────────────────

    private fun normalizeStatus(s: String) = when (s.uppercase()) {
        "PENDING"               -> "Pending"
        "CONFIRMED"             -> "Confirmed"
        "COMPLETED"             -> "Completed"
        "CANCELLED", "CANCELED" -> "Cancelled"
        "REJECTED"              -> "Rejected"
        "LEASE_CONVERTED"       -> "Lease Converted"
        else                    -> s
    }

    private fun bindHeader(v: View) {
        v.findViewById<TextView>(R.id.tvBookingId).text = "#${booking.bookingId}"
        v.findViewById<TextView>(R.id.tvCustomerName).text = booking.customerName
        val tvStatus = v.findViewById<TextView>(R.id.tvStatusBadge)
        val ns = normalizeStatus(booking.status)
        tvStatus.text = ns
        applyStatusBadge(tvStatus, ns)
    }

    private fun bindDetails(v: View) {
        val hasLeaseStarted = booking.leaseStarted || !booking.leaseBookingId.isNullOrEmpty()

        // Lease started banner
        if (hasLeaseStarted) {
            val suffix = if (!booking.leaseBookingId.isNullOrEmpty())
                " #${booking.leaseBookingId!!.takeLast(8)}" else ""
            v.findViewById<TextView>(R.id.tvLeaseStartedMsg).text =
                "Rental booking$suffix has been created from this fitting."
            v.findViewById<View>(R.id.layoutLeaseStartedBanner).visibility = View.VISIBLE
        }

        // Item
        v.findViewById<TextView>(R.id.tvItemName).text = booking.itemName
        val tvSize = v.findViewById<TextView>(R.id.tvItemSize)
        if (!booking.preferredSize.isNullOrEmpty()) {
            tvSize.text = "Size: ${booking.preferredSize}"
            tvSize.visibility = View.VISIBLE
        }

        // Customer
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

        // Fitting schedule
        v.findViewById<TextView>(R.id.tvFittingDate).text = booking.fittingDate
        v.findViewById<TextView>(R.id.tvFittingTime).text = booking.fittingTime

        // Notes
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
        val btnEditSchedule    = v.findViewById<Button>(R.id.btnEditSchedule)
        val btnComplete        = v.findViewById<Button>(R.id.btnComplete)
        val btnConfirm         = v.findViewById<Button>(R.id.btnConfirm)
        val btnCompleteNoLease = v.findViewById<Button>(R.id.btnCompleteNoLease)
        val btnReschedule      = v.findViewById<Button>(R.id.btnReschedule)
        val btnProceedToLease  = v.findViewById<Button>(R.id.btnProceedToLease)
        val btnResendEmail     = v.findViewById<Button>(R.id.btnResendEmail)
        val btnCancel          = v.findViewById<Button>(R.id.btnCancel)

        val hasLeaseStarted = booking.leaseStarted || !booking.leaseBookingId.isNullOrEmpty()
        val statusNorm = normalizeStatus(booking.status)
        val isTerminal = statusNorm in listOf("Completed", "Cancelled", "Rejected", "Lease Converted")

        when (statusNorm) {
            "Pending" -> {
                btnConfirm.visibility = View.VISIBLE
                if (!hasLeaseStarted) btnCancel.visibility = View.VISIBLE
            }
            "Confirmed" -> {
                if (!hasLeaseStarted) {
                    btnComplete.visibility        = View.VISIBLE  // Skip to Rental (purple)
                    btnCompleteNoLease.visibility = View.VISIBLE  // Done — disabled until settings load
                    btnCompleteNoLease.isEnabled  = false
                    btnCompleteNoLease.alpha      = 0.5f
                    btnCompleteNoLease.text       = "Mark Done (loading…)"
                    btnReschedule.visibility      = View.VISIBLE
                    btnEditSchedule.visibility    = View.VISIBLE
                    btnCancel.visibility          = View.VISIBLE
                }
            }
            "Completed" -> {
                if (!hasLeaseStarted) btnProceedToLease.visibility = View.VISIBLE
            }
        }

        // Inline edit: hide for terminal statuses or when lease already started
        if (isTerminal || hasLeaseStarted) btnEditSchedule.visibility = View.GONE

        btnResendEmail.visibility = View.VISIBLE

        btnConfirm.setOnClickListener         { updateStatus("Confirmed") }
        btnCancel.setOnClickListener          { confirmCancelBooking() }
        btnComplete.setOnClickListener        { showFittingToLeaseDialog() }
        btnProceedToLease.setOnClickListener  { showFittingToLeaseDialog() }
        btnCompleteNoLease.setOnClickListener { confirmCompleteNoLease() }
        btnReschedule.setOnClickListener      { showRescheduleDialog() }
        btnEditSchedule.setOnClickListener    { showRescheduleDialog() }
        btnResendEmail.setOnClickListener     { resendEmail() }
    }

    // ── Async updates after settings load ────────────────────────────────────

    private fun updateDoneButtonState(v: View) {
        val btn  = v.findViewById<Button>(R.id.btnCompleteNoLease)
        val hint = v.findViewById<TextView>(R.id.tvDoneHint)
        if (btn.visibility != View.VISIBLE) return
        val active = isDoneWindowActive()
        btn.text = "Mark Done (No Rental)"
        btn.isEnabled = active
        btn.alpha = if (active) 1f else 0.5f
        if (!active) {
            val closeTime = settings?.shopCloseTime ?: "17:00"
            hint.text = "Done is active only during the fitting window: ${booking.fittingTime} – $closeTime"
            hint.visibility = View.VISIBLE
        } else {
            hint.visibility = View.GONE
        }
    }

    private fun updateInProgressBanner(v: View) {
        if (normalizeStatus(booking.status) != "Confirmed") return
        val hasLeaseStarted = booking.leaseStarted || !booking.leaseBookingId.isNullOrEmpty()
        if (hasLeaseStarted) return
        if (isDoneWindowActive()) {
            v.findViewById<View>(R.id.layoutFittingInProgress).visibility = View.VISIBLE
        }
    }

    // ── Fitting window logic (mirrors web isFittingInAttentionWindow) ─────────

    private fun isDoneWindowActive(): Boolean {
        if (booking.fittingDate.isNullOrEmpty() || booking.fittingTime.isNullOrEmpty()) return false
        if (booking.fittingDate != CalendarPickerDialog.todayStr()) return false

        val now = Calendar.getInstance()
        val nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)

        val startParts = booking.fittingTime.split(":")
        val startMin = (startParts.getOrNull(0)?.toIntOrNull() ?: return false) * 60 +
                       (startParts.getOrNull(1)?.toIntOrNull() ?: 0)

        val closeParts = (settings?.shopCloseTime ?: "17:00").split(":")
        val closeMin = (closeParts.getOrNull(0)?.toIntOrNull() ?: 17) * 60 +
                       (closeParts.getOrNull(1)?.toIntOrNull() ?: 0)

        return nowMin >= startMin && nowMin < closeMin
    }

    // ── Status badge ──────────────────────────────────────────────────────────

    private fun applyStatusBadge(tv: TextView, status: String) {
        val (bgColor, textColor) = when (status) {
            "Pending"   -> Pair(
                ContextCompat.getColor(requireContext(), R.color.status_pending_bg),
                ContextCompat.getColor(requireContext(), R.color.status_pending_text)
            )
            "Confirmed" -> Pair(
                ContextCompat.getColor(requireContext(), R.color.status_confirmed_bg),
                ContextCompat.getColor(requireContext(), R.color.status_confirmed_text)
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

    // ── API calls ─────────────────────────────────────────────────────────────

    private fun updateStatus(status: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.updateFittingStatus(ApiClient.bearerToken(), booking.id, status)
                toast("Status updated to $status")
                onReload?.invoke()
                dismiss()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Failed: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun confirmCancelBooking() {
        val etReason = EditText(requireContext()).apply {
            hint = "Reason for cancellation (optional)"
            maxLines = 3
            setPadding(48, 16, 48, 8)
        }
        AlertDialog.Builder(requireContext())
            .setTitle("Cancel Booking")
            .setMessage("${booking.customerName} — ${booking.itemName}\n\nThis will cancel the fitting appointment.")
            .setView(etReason)
            .setPositiveButton("Cancel Booking") { _, _ -> updateStatus("Cancelled") }
            .setNegativeButton("Back", null)
            .show()
    }

    private fun confirmCompleteNoLease() {
        AlertDialog.Builder(requireContext())
            .setTitle("Mark Done Without Rental")
            .setMessage("Complete this fitting session without converting to a rental?\n\n${booking.customerName} — ${booking.itemName}")
            .setPositiveButton("Mark Done") { _, _ ->
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.completeFittingNoLease(ApiClient.bearerToken(), booking.id)
                        toast("Fitting completed (no rental)")
                        onReload?.invoke()
                        dismiss()
                    } catch (e: HttpException) {
                        if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                        else toast("Failed: ${e.message()}")
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Back", null)
            .show()
    }

    private fun resendEmail() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.resendFittingEmail(ApiClient.bearerToken(), booking.id)
                toast("Email sent")
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Failed: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    // ── Sub-dialogs (delegate to parent fragment so CalendarPickerDialog works) ─

    private fun showFittingToLeaseDialog() {
        dismiss()
        onProceedToLease?.invoke(booking)
    }

    private fun showRescheduleDialog() {
        dismiss()
        onReschedule?.invoke(booking)
    }

    private fun toast(msg: String) =
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
}
