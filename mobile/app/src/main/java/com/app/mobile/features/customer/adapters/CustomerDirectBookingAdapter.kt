package com.app.mobile.features.customer.adapters

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.R
import com.app.mobile.shared.models.DirectBooking
import java.text.SimpleDateFormat
import java.util.Locale

class CustomerDirectBookingAdapter(
    private val onClick: (DirectBooking) -> Unit
) : ListAdapter<DirectBooking, CustomerDirectBookingAdapter.VH>(DIFF) {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val accent: View           = view.findViewById(R.id.statusAccent)
        val tvItem: TextView       = view.findViewById(R.id.tvItemName)
        val tvDate: TextView       = view.findViewById(R.id.tvDateInfo)
        val tvSize: TextView       = view.findViewById(R.id.tvSize)
        val tvStatus: TextView     = view.findViewById(R.id.tvStatus)
        val tvPaymentBadge: TextView = view.findViewById(R.id.tvPaymentBadge)
        val tvPrice: TextView      = view.findViewById(R.id.tvPrice)
        val tvLabel: TextView      = view.findViewById(R.id.tvPriceLabel)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(LayoutInflater.from(parent.context).inflate(R.layout.item_customer_booking, parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val b = getItem(position)
        holder.tvItem.text = b.itemName
        holder.tvDate.text = "${formatDate(b.startDate)} → ${formatDate(b.endDate)} · ${b.totalDays} day${if (b.totalDays != 1) "s" else ""}"

        val sizeVal = b.preferredSize
        if (!sizeVal.isNullOrBlank() && !sizeVal.equals("No Preference", ignoreCase = true)) {
            holder.tvSize.visibility = View.VISIBLE
            holder.tvSize.text = "Size: $sizeVal"
        } else {
            holder.tvSize.visibility = View.GONE
        }

        val (bg, fg, accentColor, statusLabel) = statusColors(b.bookingStatus)
        holder.tvStatus.text = statusLabel
        holder.tvStatus.setBackgroundColor(bg)
        holder.tvStatus.setTextColor(fg)
        holder.accent.setBackgroundColor(accentColor)

        holder.tvPrice.text = "₱${String.format("%.0f", b.finalPrice)}"
        holder.tvLabel.text = "total"

        val isPaid = b.paymentStatus?.equals("Paid", ignoreCase = true) == true
        holder.tvPaymentBadge.visibility = View.VISIBLE
        holder.tvPaymentBadge.text = if (isPaid) "✓ Paid" else "Unpaid"
        holder.tvPaymentBadge.setBackgroundColor(
            if (isPaid) Color.parseColor("#DCFCE7") else Color.parseColor("#FEF3C7")
        )
        holder.tvPaymentBadge.setTextColor(
            if (isPaid) Color.parseColor("#15803D") else Color.parseColor("#92400E")
        )

        holder.itemView.setOnClickListener { onClick(b) }
    }

    private fun statusColors(status: String): CustomerFittingBookingAdapter.StatusStyle {
        return when (status.uppercase()) {
            "PENDING"   -> CustomerFittingBookingAdapter.StatusStyle(Color.parseColor("#FEF3C7"), Color.parseColor("#92400E"), Color.parseColor("#F59E0B"), "Pending")
            "APPROVED"  -> CustomerFittingBookingAdapter.StatusStyle(Color.parseColor("#DBEAFE"), Color.parseColor("#1E40AF"), Color.parseColor("#3B82F6"), "Approved")
            "ACTIVE"    -> CustomerFittingBookingAdapter.StatusStyle(Color.parseColor("#D1FAE5"), Color.parseColor("#065F46"), Color.parseColor("#10B981"), "Active")
            "RETURNED"  -> CustomerFittingBookingAdapter.StatusStyle(Color.parseColor("#EDE9FE"), Color.parseColor("#5B21B6"), Color.parseColor("#8B5CF6"), "Returned")
            "COMPLETED" -> CustomerFittingBookingAdapter.StatusStyle(Color.parseColor("#D1FAE5"), Color.parseColor("#065F46"), Color.parseColor("#10B981"), "Completed")
            "CANCELLED" -> CustomerFittingBookingAdapter.StatusStyle(Color.parseColor("#F3F4F6"), Color.parseColor("#6B7280"), Color.parseColor("#9CA3AF"), "Cancelled")
            else        -> CustomerFittingBookingAdapter.StatusStyle(Color.parseColor("#F3E8F0"), Color.parseColor("#6B2D39"), Color.parseColor("#6B2D39"), status)
        }
    }

    private fun formatDate(dateStr: String): String = try {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(sdf.parse(dateStr)!!)
    } catch (_: Exception) { dateStr }

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<DirectBooking>() {
            override fun areItemsTheSame(a: DirectBooking, b: DirectBooking) = a.id == b.id
            override fun areContentsTheSame(a: DirectBooking, b: DirectBooking) = a == b
        }
    }
}
