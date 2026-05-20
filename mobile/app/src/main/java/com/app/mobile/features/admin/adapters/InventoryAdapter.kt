package com.app.mobile.features.admin.adapters

import android.graphics.Color
import android.graphics.Paint
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.databinding.ItemInventoryBinding
import com.app.mobile.shared.models.InventoryItem
import com.app.mobile.shared.models.Promotion
import com.bumptech.glide.Glide
import java.time.LocalDate

class InventoryAdapter(
    private val onClick: (InventoryItem) -> Unit
) : ListAdapter<InventoryItem, InventoryAdapter.VH>(DIFF) {

    private var promotions: List<Promotion> = emptyList()

    fun updatePromotions(promos: List<Promotion>) {
        promotions = promos
        notifyDataSetChanged()
    }

    private fun activePromo(item: InventoryItem): Promotion? {
        val today = try { LocalDate.now().toString() } catch (_: Exception) { "" }
        if (today.isEmpty()) return null
        return promotions.find { p ->
            p.active &&
            p.items?.contains(item.id) == true &&
            p.start <= today &&
            p.end >= today
        }
    }

    inner class VH(private val b: ItemInventoryBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: InventoryItem) {
            b.tvName.text     = item.name
            b.tvCategory.text = item.category + (item.subtype?.let { " · $it" } ?: "")

            val sizeText = item.sizes?.filter { it.isNotEmpty() }?.joinToString(", ")
            b.tvSize.text = if (!sizeText.isNullOrEmpty()) "Sizes: $sizeText" else ""

            val promo = activePromo(item)
            if (promo != null) {
                val discounted = if (promo.type == "percentage")
                    item.price * (1 - promo.value / 100)
                else
                    (item.price - promo.value).coerceAtLeast(0.0)

                b.tvPriceOld.visibility = View.VISIBLE
                b.tvPriceOld.text = "₱${String.format("%.2f", item.price)}"
                b.tvPriceOld.paintFlags = b.tvPriceOld.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG

                b.tvPrice.text = "₱${String.format("%.0f", discounted)}"
                b.tvPrice.setTextColor(Color.parseColor("#15803d"))

                val savings = if (promo.type == "percentage") "${promo.value.toInt()}% off"
                              else "₱${promo.value.toInt()} off"
                b.tvPromoTag.visibility = View.VISIBLE
                b.tvPromoTag.text = "${promo.code} · $savings"
            } else {
                b.tvPriceOld.visibility = View.GONE
                b.tvPrice.text = "₱${String.format("%.2f", item.price)}"
                b.tvPrice.setTextColor(Color.parseColor("#6B2D39"))
                b.tvPromoTag.visibility = View.GONE
            }

            val (bg, txt) = if (item.isAvailable)
                Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
            else
                Color.parseColor("#FEF3C7") to Color.parseColor("#92400E")
            b.tvStatus.text = item.status
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
