package com.app.mobile.features.customer.dialogs

import android.graphics.Color
import android.graphics.Paint
import android.os.Bundle
import android.view.*
import android.widget.ImageView
import android.widget.TextView
import com.app.mobile.R
import com.app.mobile.shared.models.InventoryItem
import com.app.mobile.shared.models.Promotion
import com.bumptech.glide.Glide
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.button.MaterialButton
import java.time.LocalDate

class ItemDetailBottomSheet : BottomSheetDialogFragment() {

    private lateinit var item: InventoryItem
    private var promotions: List<Promotion> = emptyList()
    private var hasFittingBooking = false
    private var hasDirectBooking  = false

    companion object {
        fun newInstance(
            item: InventoryItem,
            promotions: List<Promotion>,
            hasFittingBooking: Boolean = false,
            hasDirectBooking: Boolean = false
        ): ItemDetailBottomSheet {
            return ItemDetailBottomSheet().also {
                it.item              = item
                it.promotions        = promotions
                it.hasFittingBooking = hasFittingBooking
                it.hasDirectBooking  = hasDirectBooking
            }
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        inflater.inflate(R.layout.bottom_sheet_item_detail, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val ivImage    = view.findViewById<ImageView>(R.id.ivItemImage)
        val tvCategory = view.findViewById<TextView>(R.id.tvCategory)
        val tvStatus   = view.findViewById<TextView>(R.id.tvStatus)
        val tvItemName = view.findViewById<TextView>(R.id.tvItemName)
        val tvSizes    = view.findViewById<TextView>(R.id.tvSizes)
        val tvPriceOld = view.findViewById<TextView>(R.id.tvPriceOld)
        val tvPrice    = view.findViewById<TextView>(R.id.tvPrice)
        val tvPromoTag = view.findViewById<TextView>(R.id.tvPromoTag)
        val tvDesc     = view.findViewById<TextView>(R.id.tvDescription)
        val btnFitting = view.findViewById<MaterialButton>(R.id.btnBookFitting)
        val btnDirect  = view.findViewById<MaterialButton>(R.id.btnBookDirect)

        val imgUrl = item.firstImageUrl
        if (!imgUrl.isNullOrEmpty()) {
            Glide.with(this).load(imgUrl).fitCenter().into(ivImage)
        } else {
            ivImage.setImageResource(android.R.drawable.ic_menu_gallery)
        }

        tvCategory.text = item.category
        tvItemName.text = item.name

        if (item.isAvailable) {
            tvStatus.text = "Available"
            tvStatus.setBackgroundColor(Color.parseColor("#D1FAE5"))
            tvStatus.setTextColor(Color.parseColor("#065F46"))
        } else {
            tvStatus.text = item.status
            tvStatus.setBackgroundColor(Color.parseColor("#FEF3C7"))
            tvStatus.setTextColor(Color.parseColor("#92400E"))
        }

        val sizeText = item.sizes?.filter { it.isNotEmpty() }?.joinToString(" · ")
        if (!sizeText.isNullOrEmpty()) {
            tvSizes.text = "Sizes: $sizeText"
        } else {
            tvSizes.visibility = View.GONE
        }

        val promo = activePromo()
        if (promo != null) {
            val discounted = if (promo.type == "percentage")
                item.price * (1 - promo.value / 100)
            else
                (item.price - promo.value).coerceAtLeast(0.0)
            tvPriceOld.visibility = View.VISIBLE
            tvPriceOld.text = "₱${String.format("%.2f", item.price)}/day"
            tvPriceOld.paintFlags = tvPriceOld.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
            tvPrice.text = "₱${String.format("%.0f", discounted)}/day"
            tvPrice.setTextColor(Color.parseColor("#15803d"))
            val savings = if (promo.type == "percentage") "${promo.value.toInt()}% off"
                          else "₱${promo.value.toInt()} off"
            tvPromoTag.visibility = View.VISIBLE
            tvPromoTag.text = "Promo ${promo.code} · $savings"
        } else {
            tvPrice.text = "₱${String.format("%.2f", item.price)}/day"
        }

        item.description?.takeIf { it.isNotBlank() }?.let {
            tvDesc.visibility = View.VISIBLE
            tvDesc.text = it
        }

        // Disable both buttons if item is not available
        if (!item.isAvailable) {
            disableButton(btnFitting, "Not Available")
            disableButton(btnDirect,  "Not Available")
            return
        }

        // Fitting button state
        if (hasFittingBooking) {
            disableButton(btnFitting, "Fitting Already Booked")
        } else {
            btnFitting.setOnClickListener {
                dismiss()
                BookFittingDialog.newInstance(item, promotions)
                    .show(parentFragmentManager, "book_fitting")
            }
        }

        // Direct button state
        if (hasDirectBooking) {
            disableButton(btnDirect, "Direct Already Booked")
        } else {
            btnDirect.setOnClickListener {
                dismiss()
                BookDirectDialog.newInstance(item, promotions)
                    .show(parentFragmentManager, "book_direct")
            }
        }
    }

    private fun disableButton(btn: MaterialButton, label: String) {
        btn.isEnabled = false
        btn.alpha     = 0.55f
        btn.text      = label
    }

    private fun activePromo(): Promotion? {
        val today = try { LocalDate.now().toString() } catch (_: Exception) { return null }
        return promotions.find { p ->
            p.active && (p.items.isNullOrEmpty() || p.items.contains(item.id)) &&
                p.start <= today && p.end >= today
        }
    }
}
