package com.app.mobile.adapters

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.databinding.ItemFittingBookingBinding
import com.app.mobile.models.FittingBooking

class FittingBookingAdapter(
    private val onClick: (FittingBooking) -> Unit
) : ListAdapter<FittingBooking, FittingBookingAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemFittingBookingBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: FittingBooking) {
            b.tvBookingId.text    = item.bookingId
            b.tvItemName.text     = item.itemName
            b.tvCustomer.text     = item.customerName
            b.tvDateTime.text     = "${item.fittingDate} at ${item.fittingTime}"
            b.tvSize.text         = "Size: ${item.preferredSize}"
            b.tvStatus.text       = item.status
            applyStatusStyle(item.status)
            b.root.setOnClickListener { onClick(item) }
        }

        private fun applyStatusStyle(status: String) {
            val ctx = b.root.context
            val (bg, txt) = when (status) {
                "Pending"   -> Color.parseColor("#FEF3C7") to Color.parseColor("#92400E")
                "Confirmed" -> Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
                "Completed" -> Color.parseColor("#EDE9FE") to Color.parseColor("#5B21B6")
                "Cancelled" -> Color.parseColor("#FEE2E2") to Color.parseColor("#991B1B")
                else        -> Color.parseColor("#F3F4F6") to Color.parseColor("#374151")
            }
            b.tvStatus.setBackgroundColor(bg)
            b.tvStatus.setTextColor(txt)
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemFittingBookingBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<FittingBooking>() {
            override fun areItemsTheSame(a: FittingBooking, b: FittingBooking) = a.id == b.id
            override fun areContentsTheSame(a: FittingBooking, b: FittingBooking) = a == b
        }
    }
}
