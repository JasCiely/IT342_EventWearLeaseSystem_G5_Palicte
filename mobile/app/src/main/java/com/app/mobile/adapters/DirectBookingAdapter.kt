package com.app.mobile.adapters

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.databinding.ItemDirectBookingBinding
import com.app.mobile.models.DirectBooking

class DirectBookingAdapter(
    private val onClick: (DirectBooking) -> Unit
) : ListAdapter<DirectBooking, DirectBookingAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemDirectBookingBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: DirectBooking) {
            b.tvItemName.text  = item.itemName
            b.tvCustomer.text  = item.customerName
            b.tvDates.text     = "${item.startDate} → ${item.endDate} (${item.totalDays} days)"
            b.tvPrice.text     = "₱${String.format("%.2f", item.finalPrice)}"
            b.tvStatus.text    = item.bookingStatus
            if (item.extended) b.tvExtended.text = "Extended" else b.tvExtended.text = ""
            applyStatusStyle(item.bookingStatus)
            b.root.setOnClickListener { onClick(item) }
        }

        private fun applyStatusStyle(status: String) {
            val (bg, txt) = when (status) {
                "Pending"      -> Color.parseColor("#FEF3C7") to Color.parseColor("#92400E")
                "Confirmed"    -> Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
                "Active Lease" -> Color.parseColor("#DBEAFE") to Color.parseColor("#1E40AF")
                "Returned"     -> Color.parseColor("#EDE9FE") to Color.parseColor("#5B21B6")
                "Completed"    -> Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
                "Cancelled"    -> Color.parseColor("#FEE2E2") to Color.parseColor("#991B1B")
                else           -> Color.parseColor("#F3F4F6") to Color.parseColor("#374151")
            }
            b.tvStatus.setBackgroundColor(bg)
            b.tvStatus.setTextColor(txt)
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemDirectBookingBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<DirectBooking>() {
            override fun areItemsTheSame(a: DirectBooking, b: DirectBooking) = a.id == b.id
            override fun areContentsTheSame(a: DirectBooking, b: DirectBooking) = a == b
        }
    }
}
