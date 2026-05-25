package com.app.mobile.features.customer.adapters

import android.graphics.Color
import android.graphics.Paint
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.R
import com.app.mobile.shared.models.InventoryItem
import com.app.mobile.shared.models.Promotion
import com.bumptech.glide.Glide
import com.google.android.material.button.MaterialButton
import java.time.LocalDate

class CustomerInventoryAdapter(
    private val onClick: (InventoryItem) -> Unit
) : ListAdapter<InventoryItem, CustomerInventoryAdapter.VH>(DIFF) {

    private var promotions: List<Promotion> = emptyList()
    private var bookedFittingIds: Set<String> = emptySet()
    private var bookedDirectIds: Set<String>  = emptySet()

    fun updatePromotions(promos: List<Promotion>) {
        promotions = promos
        notifyDataSetChanged()
    }

    fun updateBookedIds(fittingIds: Set<String>, directIds: Set<String>) {
        bookedFittingIds = fittingIds
        bookedDirectIds  = directIds
        notifyDataSetChanged()
    }

    inner class VH(view: View) : RecyclerView.ViewHolder(view) {
        val ivImage: ImageView   = view.findViewById(R.id.ivItemImage)
        val tvCategory: TextView = view.findViewById(R.id.tvCategory)
        val tvName: TextView     = view.findViewById(R.id.tvItemName)
        val tvStatus: TextView   = view.findViewById(R.id.tvStatus)
        val tvPrice: TextView    = view.findViewById(R.id.tvPrice)
        val tvPriceOld: TextView = view.findViewById(R.id.tvPriceOld)
        val btnView: MaterialButton = view.findViewById(R.id.btnView)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(LayoutInflater.from(parent.context).inflate(R.layout.item_customer_inventory, parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = getItem(position)

        val imgUrl = item.firstImageUrl
        if (!imgUrl.isNullOrEmpty()) {
            Glide.with(holder.ivImage).load(imgUrl).centerCrop().into(holder.ivImage)
        } else {
            holder.ivImage.setImageResource(android.R.drawable.ic_menu_gallery)
        }

        holder.tvCategory.text = item.category
        holder.tvName.text     = item.name

        // Only available, un-booked items reach the adapter — always show Available
        holder.tvStatus.text = "Available"
        holder.tvStatus.setBackgroundColor(Color.parseColor("#D1FAE5"))
        holder.tvStatus.setTextColor(Color.parseColor("#065F46"))

        val promo = activePromo(item)
        if (promo != null) {
            val discounted = if (promo.type == "percentage")
                item.price * (1 - promo.value / 100)
            else
                (item.price - promo.value).coerceAtLeast(0.0)
            holder.tvPriceOld.visibility = View.VISIBLE
            holder.tvPriceOld.text = "₱${String.format("%.2f", item.price)}/day"
            holder.tvPriceOld.paintFlags = holder.tvPriceOld.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
            holder.tvPrice.text = "₱${String.format("%.0f", discounted)}/day"
            holder.tvPrice.setTextColor(Color.parseColor("#15803d"))
        } else {
            holder.tvPriceOld.visibility = View.GONE
            holder.tvPrice.text = "₱${String.format("%.2f", item.price)}/day"
            holder.tvPrice.setTextColor(Color.parseColor("#6B2D39"))
        }

        holder.btnView.isEnabled = true
        holder.btnView.alpha = 1f
        holder.btnView.setOnClickListener { onClick(item) }
        holder.itemView.setOnClickListener { onClick(item) }
    }

    private fun activePromo(item: InventoryItem): Promotion? {
        val today = try { LocalDate.now().toString() } catch (_: Exception) { return null }
        return promotions.find { p ->
            p.active && (p.items.isNullOrEmpty() || p.items.contains(item.id)) &&
                p.start <= today && p.end >= today
        }
    }

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<InventoryItem>() {
            override fun areItemsTheSame(a: InventoryItem, b: InventoryItem) = a.id == b.id
            override fun areContentsTheSame(a: InventoryItem, b: InventoryItem) = a == b
        }
    }
}
