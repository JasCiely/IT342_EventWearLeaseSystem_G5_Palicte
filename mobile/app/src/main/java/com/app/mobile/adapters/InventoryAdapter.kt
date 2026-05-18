package com.app.mobile.adapters

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.databinding.ItemInventoryBinding
import com.app.mobile.models.InventoryItem
import com.bumptech.glide.Glide

class InventoryAdapter(
    private val onClick: (InventoryItem) -> Unit
) : ListAdapter<InventoryItem, InventoryAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemInventoryBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: InventoryItem) {
            b.tvName.text     = item.name
            b.tvCategory.text = item.category + (item.subtype?.let { " · $it" } ?: "")
            b.tvPrice.text    = "₱${String.format("%.2f", item.price)}"
            b.tvStatus.text   = item.status
            item.size?.let { b.tvSize.text = "Size: $it" } ?: run { b.tvSize.text = "" }

            val (bg, txt) = if (item.isAvailable)
                Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
            else
                Color.parseColor("#FEF3C7") to Color.parseColor("#92400E")
            b.tvStatus.setBackgroundColor(bg)
            b.tvStatus.setTextColor(txt)

            val imgUrl = item.firstImageUrl
            if (!imgUrl.isNullOrEmpty()) {
                Glide.with(b.root.context).load(imgUrl).centerCrop().into(b.ivThumbnail)
            } else {
                b.ivThumbnail.setImageResource(android.R.drawable.ic_menu_gallery)
            }

            b.root.setOnClickListener { onClick(item) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemInventoryBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<InventoryItem>() {
            override fun areItemsTheSame(a: InventoryItem, b: InventoryItem) = a.id == b.id
            override fun areContentsTheSame(a: InventoryItem, b: InventoryItem) = a == b
        }
    }
}
