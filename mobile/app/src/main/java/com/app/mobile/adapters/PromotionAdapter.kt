package com.app.mobile.adapters

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.databinding.ItemPromotionBinding
import com.app.mobile.models.Promotion

class PromotionAdapter(
    private val onClick: (Promotion) -> Unit
) : ListAdapter<Promotion, PromotionAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemPromotionBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: Promotion) {
            b.tvCode.text  = item.code
            b.tvValue.text = if (item.type == "percentage") "${item.value}% off" else "₱${item.value} off"
            b.tvDates.text = "${item.start} → ${item.end}"
            b.tvActive.text = if (item.active) "Active" else "Inactive"

            val (bg, txt) = if (item.active)
                Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
            else
                Color.parseColor("#F3F4F6") to Color.parseColor("#374151")
            b.tvActive.setBackgroundColor(bg)
            b.tvActive.setTextColor(txt)

            b.root.setOnClickListener { onClick(item) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemPromotionBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<Promotion>() {
            override fun areItemsTheSame(a: Promotion, b: Promotion) = a.id == b.id
            override fun areContentsTheSame(a: Promotion, b: Promotion) = a == b
        }
    }
}
