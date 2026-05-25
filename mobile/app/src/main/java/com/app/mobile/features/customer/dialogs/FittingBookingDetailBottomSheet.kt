package com.app.mobile.features.customer.dialogs

import android.graphics.Color
import android.os.Bundle
import android.view.*
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.lifecycle.lifecycleScope
import com.app.mobile.R
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.FittingBooking
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import retrofit2.HttpException

class FittingBookingDetailBottomSheet : BottomSheetDialogFragment() {

    private lateinit var booking: FittingBooking
    var onCancelled: (() -> Unit)? = null

    companion object {
        fun newInstance(booking: FittingBooking): FittingBookingDetailBottomSheet {
            return FittingBookingDetailBottomSheet().also { it.booking = booking }
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        inflater.inflate(R.layout.bottom_sheet_customer_fitting_detail, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvStatus   = view.findViewById<TextView>(R.id.tvStatus)
        val tvItemName = view.findViewById<TextView>(R.id.tvItemName)
        val tvDateTime = view.findViewById<TextView>(R.id.tvDateTime)
        val tvSize     = view.findViewById<TextView>(R.id.tvSize)
        val labelNotes = view.findViewById<TextView>(R.id.labelNotes)
        val tvNotes    = view.findViewById<TextView>(R.id.tvNotes)
        val btnCancel  = view.findViewById<MaterialButton>(R.id.btnCancel)
        val btnClose   = view.findViewById<MaterialButton>(R.id.btnClose)

        tvItemName.text = booking.itemName
        tvDateTime.text = "${booking.fittingDate} at ${booking.fittingTime}"
        tvSize.text = booking.preferredSize?.ifBlank { "No preference" } ?: "No preference"

        booking.notes?.takeIf { it.isNotBlank() }?.let {
            labelNotes.visibility = View.VISIBLE
            tvNotes.visibility = View.VISIBLE
            tvNotes.text = it
        }

        val (bg, fg) = when (booking.status.uppercase()) {
            "PENDING"   -> Color.parseColor("#FEF3C7") to Color.parseColor("#92400E")
            "CONFIRMED" -> Color.parseColor("#DBEAFE") to Color.parseColor("#1E40AF")
            "COMPLETED" -> Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
            "CANCELLED" -> Color.parseColor("#F3F4F6") to Color.parseColor("#6B7280")
            else        -> Color.parseColor("#F3E8F0") to Color.parseColor("#6B2D39")
        }
        tvStatus.text = booking.status.replaceFirstChar { it.uppercase() }
        tvStatus.setBackgroundColor(bg)
        tvStatus.setTextColor(fg)

        val canCancel = booking.status.uppercase() == "PENDING"
        btnCancel.visibility = if (canCancel) View.VISIBLE else View.GONE

        btnCancel.setOnClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle("Cancel Booking")
                .setMessage("Cancel your fitting appointment for \"${booking.itemName}\"?")
                .setPositiveButton("Yes, Cancel") { _, _ -> cancelBooking() }
                .setNegativeButton("Keep Booking", null)
                .show()
        }

        btnClose.setOnClickListener { dismiss() }
    }

    private fun cancelBooking() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.customerApi.cancelFittingBooking(ApiClient.bearerToken(), booking.id)
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
