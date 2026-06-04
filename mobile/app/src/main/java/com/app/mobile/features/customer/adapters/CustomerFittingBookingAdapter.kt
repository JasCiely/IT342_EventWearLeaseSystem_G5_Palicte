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
import com.app.mobile.shared.models.FittingBooking

class CustomerFittingBookingAdapter(
    private val onClick: (FittingBooking) -> Unit
) : ListAdapter<FittingBooking, CustomerFittingBookingAdapter.VH>(DIFF) {

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val accent: View       = view.findViewById(R.id.statusAccent)
        val tvItem: TextView   = view.findViewById(R.id.tvItemName)
        val tvDate: TextView   = view.findViewById(R.id.tvDateInfo)
        val tvSize: TextView   = view.findViewById(R.id.tvSize)
        val tvStatus: TextView = view.findViewById(R.id.tvStatus)
        val tvPrice: TextView  = view.findViewById(R.id.tvPrice)
        val tvLabel: TextView  = view.findViewById(R.id.tvPriceLabel)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(LayoutInflater.from(parent.context).inflate(R.layout.item_customer_booking, parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val b = getItem(position)
        holder.tvItem.text = b.itemName
        holder.tvDate.text = "${b.fittingDate} at ${b.fittingTime}"

        if (!b.preferredSize.isNullOrBlank() && !b.preferredSize.equals("No Preference", ignoreCase = true)) {
            holder.tvSize.visibility = View.VISIBLE
            holder.tvSize.text = "Size: ${b.preferredSize}"
        } else {
            holder.tvSize.visibility = View.GONE
        }

        val (bg, fg, accentColor, statusLabel) = statusColors(b.status)
        holder.tvStatus.text = statusLabel
        holder.tvStatus.setBackgroundColor(bg)
        holder.tvStatus.setTextColor(fg)
        holder.accent.setBackgroundColor(accentColor)

        holder.tvPrice.text  = "Fitting"
        holder.tvLabel.text  = "appointment"

        holder.itemView.setOnClickListener { onClick(b) }
    }

    private fun statusColors(status: String): StatusStyle {
        return when (status.uppercase()) {
            "PENDING"   -> StatusStyle(Color.parseColor("#FEF3C7"), Color.parseColor("#92400E"), Color.parseColor("#F59E0B"), "Pending")
            "CONFIRMED" -> StatusStyle(Color.parseColor("#DBEAFE"), Color.parseColor("#1E40AF"), Color.parseColor("#3B82F6"), "Confirmed")
            "COMPLETED" -> StatusStyle(Color.parseColor("#D1FAE5"), Color.parseColor("#065F46"), Color.parseColor("#10B981"), "Completed")
            "CANCELLED" -> StatusStyle(Color.parseColor("#F3F4F6"), Color.parseColor("#6B7280"), Color.parseColor("#9CA3AF"), "Cancelled")
            else        -> StatusStyle(Color.parseColor("#F3E8F0"), Color.parseColor("#6B2D39"), Color.parseColor("#6B2D39"), status)
        }
    }

    data class StatusStyle(val bg: Int, val fg: Int, val accent: Int, val label: String)

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<FittingBooking>() {
            override fun areItemsTheSame(a: FittingBooking, b: FittingBooking) = a.id == b.id
            override fun areContentsTheSame(a: FittingBooking, b: FittingBooking) = a == b
        }
    }
}
