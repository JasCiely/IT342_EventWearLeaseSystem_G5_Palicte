package com.app.mobile.features.customer.dialogs

import android.graphics.Color
import android.os.Bundle
import android.view.*
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.lifecycle.lifecycleScope
import com.app.mobile.R
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.DirectBooking
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.text.SimpleDateFormat
import java.util.Locale

class DirectBookingDetailBottomSheet : BottomSheetDialogFragment() {

    private lateinit var booking: DirectBooking
    var onCancelled: (() -> Unit)? = null

    companion object {
        fun newInstance(booking: DirectBooking): DirectBookingDetailBottomSheet {
            return DirectBookingDetailBottomSheet().also { it.booking = booking }
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        inflater.inflate(R.layout.bottom_sheet_customer_direct_detail, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvStatus    = view.findViewById<TextView>(R.id.tvStatus)
        val tvItemName  = view.findViewById<TextView>(R.id.tvItemName)
        val tvDates     = view.findViewById<TextView>(R.id.tvDates)
        val tvSize      = view.findViewById<TextView>(R.id.tvSize)
        val tvBasePrice = view.findViewById<TextView>(R.id.tvBasePrice)
        val rowDiscount = view.findViewById<LinearLayout>(R.id.rowDiscount)
        val tvDiscount  = view.findViewById<TextView>(R.id.tvDiscount)
        val tvTotal     = view.findViewById<TextView>(R.id.tvTotal)
        val labelNotes  = view.findViewById<TextView>(R.id.labelNotes)
        val tvNotes     = view.findViewById<TextView>(R.id.tvNotes)
        val btnCancel   = view.findViewById<MaterialButton>(R.id.btnCancel)
        val btnClose    = view.findViewById<MaterialButton>(R.id.btnClose)

        tvItemName.text = booking.itemName
        tvDates.text    = "${formatDate(booking.startDate)} → ${formatDate(booking.endDate)} · ${booking.totalDays} day${if (booking.totalDays != 1) "s" else ""}"
        tvSize.text     = booking.preferredSize?.ifBlank { "No preference" } ?: "No preference"
        tvBasePrice.text = "₱${String.format("%.2f", booking.basePrice)}"
        tvTotal.text     = "₱${String.format("%.2f", booking.finalPrice)}"

        if (booking.discountAmount > 0) {
            rowDiscount.visibility = View.VISIBLE
            tvDiscount.text = "-₱${String.format("%.2f", booking.discountAmount)}"
        }

        booking.notes?.takeIf { it.isNotBlank() }?.let {
            labelNotes.visibility = View.VISIBLE
            tvNotes.visibility = View.VISIBLE
            tvNotes.text = it
        }

        val (bg, fg) = when (booking.bookingStatus.uppercase()) {
            "PENDING"   -> Color.parseColor("#FEF3C7") to Color.parseColor("#92400E")
            "APPROVED"  -> Color.parseColor("#DBEAFE") to Color.parseColor("#1E40AF")
            "ACTIVE"    -> Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
            "RETURNED"  -> Color.parseColor("#EDE9FE") to Color.parseColor("#5B21B6")
            "COMPLETED" -> Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
            "CANCELLED" -> Color.parseColor("#F3F4F6") to Color.parseColor("#6B7280")
            else        -> Color.parseColor("#F3E8F0") to Color.parseColor("#6B2D39")
        }
        tvStatus.text = booking.bookingStatus.replaceFirstChar { it.uppercase() }
        tvStatus.setBackgroundColor(bg)
        tvStatus.setTextColor(fg)

        val canCancel = booking.bookingStatus.uppercase() in listOf("PENDING", "APPROVED")
        btnCancel.visibility = if (canCancel) View.VISIBLE else View.GONE

        btnCancel.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle("Cancel Booking")
                .setMessage("Cancel your rental of \"${booking.itemName}\"?")
                .setPositiveButton("Yes, Cancel") { _, _ -> cancelBooking() }
                .setNegativeButton("Keep Booking", null)
                .show()
        }

        btnClose.setOnClickListener { dismiss() }
    }

    private fun formatDate(dateStr: String): String = try {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(sdf.parse(dateStr)!!)
    } catch (_: Exception) { dateStr }

    private fun cancelBooking() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.customerApi.cancelDirectBooking(ApiClient.bearerToken(), booking.id)
                Toast.makeText(requireContext(), "Booking cancelled.", Toast.LENGTH_SHORT).show()
                onCancelled?.invoke()
                dismiss()
            } catch (e: HttpException) {
                when (e.code()) {
                    401  -> (activity as? DashboardActivity)?.showSessionExpiredDialog()
                    else -> Toast.makeText(requireContext(), "Failed to cancel: ${e.message()}", Toast.LENGTH_SHORT).show()
                }
            } catch (_: Exception) {
                Toast.makeText(requireContext(), "Network error.", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
