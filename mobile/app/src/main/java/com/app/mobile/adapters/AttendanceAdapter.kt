package com.app.mobile.adapters

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.databinding.ItemAttendanceBinding
import com.app.mobile.models.TodayAttendanceItem

class AttendanceAdapter(
    private val onClick: (TodayAttendanceItem) -> Unit
) : ListAdapter<TodayAttendanceItem, AttendanceAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemAttendanceBinding) : RecyclerView.ViewHolder(b.root) {
        fun bind(item: TodayAttendanceItem) {
            b.tvStaffName.text = item.staffName ?: item.staffId
            b.tvStatus.text    = item.status
            b.tvLate.text      = if (item.isLate) "Late${item.lateMinutes?.let { " (${it}m)" } ?: ""}" else ""

            val (bg, txt) = when (item.status) {
                "Present" -> Color.parseColor("#D1FAE5") to Color.parseColor("#065F46")
                "Absent"  -> Color.parseColor("#FEE2E2") to Color.parseColor("#991B1B")
                "Leave"   -> Color.parseColor("#FEF3C7") to Color.parseColor("#92400E")
                else      -> Color.parseColor("#F3F4F6") to Color.parseColor("#374151")
            }
            b.tvStatus.setBackgroundColor(bg)
            b.tvStatus.setTextColor(txt)

            b.root.setOnClickListener { onClick(item) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemAttendanceBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<TodayAttendanceItem>() {
            override fun areItemsTheSame(a: TodayAttendanceItem, b: TodayAttendanceItem) = a.id == b.id
            override fun areContentsTheSame(a: TodayAttendanceItem, b: TodayAttendanceItem) = a == b
        }
    }
}
