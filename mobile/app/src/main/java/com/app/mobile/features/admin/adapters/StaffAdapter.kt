package com.app.mobile.features.admin.adapters

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.databinding.ItemStaffBinding
import com.app.mobile.shared.models.Staff

class StaffAdapter(
    private val onClick: (Staff) -> Unit
) : ListAdapter<Staff, StaffAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemStaffBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: Staff) {
            b.tvInitials.text    = item.initials
            b.tvName.text        = item.fullName
            b.tvEmail.text       = item.email
            b.tvRole.text        = item.role
            b.tvStatus.text      = item.status
            b.tvDaysWorked.text  = "${item.daysWorked} days"
            val rate = item.customRate
            if (rate != null) {
                b.tvRate.text           = "₱${String.format("%.2f", rate)}/day"
                val salaryEstimate      = rate * item.daysWorked
                b.tvSalaryEstimate.text = "≈ ₱${String.format("%.2f", salaryEstimate)}"
            } else {
                b.tvRate.text           = ""
                b.tvSalaryEstimate.text = ""
            }

            val (bg, txt) = if (item.status == "On Duty")
                Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
            else
                Color.parseColor("#F3F4F6") to Color.parseColor("#374151")
            b.tvStatus.setBackgroundColor(bg)
            b.tvStatus.setTextColor(txt)

            b.root.setOnClickListener { onClick(item) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemStaffBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<Staff>() {
            override fun areItemsTheSame(a: Staff, b: Staff) = a.id == b.id
            override fun areContentsTheSame(a: Staff, b: Staff) = a == b
        }
    }
}
