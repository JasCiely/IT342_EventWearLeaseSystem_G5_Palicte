package com.app.mobile.features.admin.adapters

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.databinding.ItemUserBinding
import com.app.mobile.shared.models.AdminUser

class UserAdapter(
    private val onClick: (AdminUser) -> Unit
) : ListAdapter<AdminUser, UserAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemUserBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: AdminUser) {
            b.tvInitials.text = item.initials
            b.tvName.text     = item.fullName
            b.tvEmail.text    = item.email
            b.tvRole.text     = item.role
            b.tvStatus.text   = if (item.active) "Active" else "Inactive"

            val (bg, txt) = if (item.active)
                Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
            else
                Color.parseColor("#FEE2E2") to Color.parseColor("#991B1B")
            b.tvStatus.setBackgroundColor(bg)
            b.tvStatus.setTextColor(txt)

            b.root.setOnClickListener { onClick(item) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemUserBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<AdminUser>() {
            override fun areItemsTheSame(a: AdminUser, b: AdminUser) = a.id == b.id
            override fun areContentsTheSame(a: AdminUser, b: AdminUser) = a == b
        }
    }
}
