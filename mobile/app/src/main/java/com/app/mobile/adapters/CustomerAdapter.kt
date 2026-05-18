package com.app.mobile.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.R
import com.app.mobile.databinding.ItemCustomerBinding
import com.app.mobile.models.AdminUser
import java.text.SimpleDateFormat
import java.util.*

class CustomerAdapter(
    private val onClick: (AdminUser) -> Unit
) : ListAdapter<AdminUser, CustomerAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<AdminUser>() {
            override fun areItemsTheSame(a: AdminUser, b: AdminUser) = a.id == b.id
            override fun areContentsTheSame(a: AdminUser, b: AdminUser) = a == b
        }

        private val AVATAR_COLORS = listOf(
            0xFF6b2d39.toInt(), 0xFF8b3a4a.toInt(), 0xFFa34f60.toInt(),
            0xFF4a1f28.toInt(), 0xFF7a3040.toInt(), 0xFF5c2433.toInt()
        )

        fun avatarColor(id: String): Int {
            val n = id.sumOf { it.code }
            return AVATAR_COLORS[n % AVATAR_COLORS.size]
        }

        fun fmtDate(raw: String?): String {
            if (raw.isNullOrBlank()) return "—"
            return try {
                val inFmt  = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                val outFmt = SimpleDateFormat("MMM d, yyyy", Locale.US)
                val date   = inFmt.parse(raw.substringBefore(".")) ?: return raw.substringBefore("T")
                outFmt.format(date)
            } catch (_: Exception) { raw.substringBefore("T") }
        }
    }

    inner class VH(private val b: ItemCustomerBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(user: AdminUser) {
            b.tvInitials.text = user.initials
            b.tvName.text     = user.fullName
            b.tvEmail.text    = user.email
            b.tvJoined.text   = "Joined ${fmtDate(user.createdAt)}"

            // Phone — show only when present
            val phone = user.phone
            if (!phone.isNullOrBlank()) {
                b.tvPhone.text       = phone
                b.tvPhone.visibility = android.view.View.VISIBLE
            } else {
                b.tvPhone.visibility = android.view.View.GONE
            }

            b.avatarFrame.setBackgroundColor(avatarColor(user.id))

            val ctx = b.root.context
            if (user.active) {
                b.tvStatus.text = "Active"
                b.tvStatus.setTextColor(ContextCompat.getColor(ctx, R.color.status_confirmed_text))
                b.tvStatus.setBackgroundColor(ContextCompat.getColor(ctx, R.color.status_confirmed_bg))
            } else {
                b.tvStatus.text = "Inactive"
                b.tvStatus.setTextColor(ContextCompat.getColor(ctx, R.color.status_cancelled_text))
                b.tvStatus.setBackgroundColor(ContextCompat.getColor(ctx, R.color.status_cancelled_bg))
            }

            b.root.setOnClickListener { onClick(user) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemCustomerBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))
}
