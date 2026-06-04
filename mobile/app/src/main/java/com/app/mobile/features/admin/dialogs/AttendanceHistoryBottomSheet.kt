package com.app.mobile.features.admin.dialogs

import android.graphics.Color
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.R
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.AttendanceRecord
import com.app.mobile.shared.models.UpdateAttendanceRequest
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class AttendanceHistoryBottomSheet : BottomSheetDialogFragment() {

    var editMode = false
    var onRefresh: (() -> Unit)? = null

    private lateinit var historyAdapter: HistoryAdapter
    private var allRecords = listOf<AttendanceRecord>()
    private var dateFilter = ""
    private val today get() = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    // ── Sealed display items for RecyclerView ────────────────
    sealed class HistoryItem {
        data class DateHeader(val date: String, val onDuty: Int, val offDuty: Int) : HistoryItem()
        data class RecordRow(val record: AttendanceRecord, val isToday: Boolean) : HistoryItem()
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.bottom_sheet_attendance_history, container, false)

    override fun onStart() {
        super.onStart()
        (dialog as? BottomSheetDialog)?.behavior?.apply {
            state = BottomSheetBehavior.STATE_EXPANDED
            skipCollapsed = true
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        historyAdapter = HistoryAdapter(
            editMode = editMode,
            today = today,
            onToggleLate = { rec -> handleEdit(rec, isLate = !rec.isLate) },
            onToggleStatus = { rec ->
                val newStatus = if (rec.status == "On Duty") "Off Duty" else "On Duty"
                handleEdit(rec, status = newStatus)
            }
        )

        view.findViewById<RecyclerView>(R.id.rvHistory).apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = historyAdapter
        }

        view.findViewById<ImageButton>(R.id.btnClose).setOnClickListener { dismiss() }

        updateUnlockButton(view)
        view.findViewById<MaterialButton>(R.id.btnUnlockLock).setOnClickListener {
            handleUnlockToggle(view)
        }

        view.findViewById<EditText>(R.id.etDateFilter).addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { dateFilter = s?.toString() ?: ""; applyFilter(view) }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        loadHistory(view)
    }

    private fun loadHistory(view: View) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                allRecords = ApiClient.adminApi.getAttendanceHistory(
                    ApiClient.bearerToken(),
                    date = dateFilter
                )
                applyFilter(view)
            } catch (_: Exception) {
                Toast.makeText(requireContext(), "Failed to load history", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun applyFilter(view: View) {
        val filtered = if (dateFilter.isEmpty()) allRecords
        else allRecords.filter { it.attendanceDate.startsWith(dateFilter) }

        val items = buildList {
            filtered
                .groupBy { it.attendanceDate }
                .entries
                .sortedByDescending { it.key }
                .forEach { (date, recs) ->
                    add(HistoryItem.DateHeader(
                        date = date,
                        onDuty = recs.count { it.status == "On Duty" },
                        offDuty = recs.count { it.status == "Off Duty" }
                    ))
                    recs.forEach { rec -> add(HistoryItem.RecordRow(rec, isToday = date == today)) }
                }
        }

        historyAdapter.submitList(items)

        val emptyView = view.findViewById<TextView>(R.id.tvHistoryEmpty)
        val countView = view.findViewById<TextView>(R.id.tvHistoryCount)
        emptyView.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
        countView.text = "${filtered.size} record${if (filtered.size != 1) "s" else ""}"
    }

    private fun handleUnlockToggle(view: View) {
        if (!editMode) {
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    ApiClient.adminApi.unlockAttendance(ApiClient.bearerToken(), date = today)
                    editMode = true
                    historyAdapter.editMode = true
                    historyAdapter.notifyDataSetChanged()
                    updateUnlockButton(view)
                    updateEditModeBanner(view)
                    onRefresh?.invoke()
                    Toast.makeText(requireContext(), "Attendance unlocked. You can now edit records.", Toast.LENGTH_SHORT).show()
                } catch (_: Exception) {
                    Toast.makeText(requireContext(), "Failed to unlock attendance", Toast.LENGTH_SHORT).show()
                }
            }
        } else {
            editMode = false
            historyAdapter.editMode = false
            historyAdapter.notifyDataSetChanged()
            updateUnlockButton(view)
            updateEditModeBanner(view)
            onRefresh?.invoke()
        }
    }

    private fun handleEdit(
        record: AttendanceRecord,
        status: String = record.status,
        isLate: Boolean = record.isLate
    ) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.editAttendanceRecord(
                    ApiClient.bearerToken(),
                    record.id,
                    UpdateAttendanceRequest(status, isLate, record.lateMinutes)
                )
                loadHistory(requireView())
                onRefresh?.invoke()
            } catch (_: Exception) {
                Toast.makeText(requireContext(), "Update failed", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun updateUnlockButton(view: View) {
        view.findViewById<MaterialButton>(R.id.btnUnlockLock).text =
            if (editMode) "Lock Session" else "Unlock Today"
    }

    private fun updateEditModeBanner(view: View) {
        view.findViewById<View>(R.id.layoutEditModeBanner).visibility =
            if (editMode) View.VISIBLE else View.GONE
    }

    private fun avatarColor(name: String): Int {
        val colors = listOf("#6b2d39", "#c4717f", "#5a7a6b", "#7a6b5a", "#4a6b8a", "#8a4a6b")
        val idx = (name.firstOrNull()?.code ?: 0) % colors.size
        return Color.parseColor(colors[idx])
    }

    // ── Inner Adapter ─────────────────────────────────────────
    inner class HistoryAdapter(
        var editMode: Boolean,
        private val today: String,
        private val onToggleLate: (AttendanceRecord) -> Unit,
        private val onToggleStatus: (AttendanceRecord) -> Unit
    ) : ListAdapter<HistoryItem, RecyclerView.ViewHolder>(
        object : DiffUtil.ItemCallback<HistoryItem>() {
            override fun areItemsTheSame(a: HistoryItem, b: HistoryItem) = when {
                a is HistoryItem.DateHeader && b is HistoryItem.DateHeader -> a.date == b.date
                a is HistoryItem.RecordRow  && b is HistoryItem.RecordRow  -> a.record.id == b.record.id
                else -> false
            }
            override fun areContentsTheSame(a: HistoryItem, b: HistoryItem) = a == b
        }
    ) {

        private val TYPE_HEADER = 0
        private val TYPE_RECORD = 1

        override fun getItemViewType(position: Int) =
            if (getItem(position) is HistoryItem.DateHeader) TYPE_HEADER else TYPE_RECORD

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
            val inflater = LayoutInflater.from(parent.context)
            return if (viewType == TYPE_HEADER) {
                HeaderVH(inflater.inflate(R.layout.item_attendance_history_header, parent, false))
            } else {
                RecordVH(inflater.inflate(R.layout.item_attendance_history_record, parent, false))
            }
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
            when (val item = getItem(position)) {
                is HistoryItem.DateHeader -> (holder as HeaderVH).bind(item)
                is HistoryItem.RecordRow  -> (holder as RecordVH).bind(item)
            }
        }

        inner class HeaderVH(v: View) : RecyclerView.ViewHolder(v) {
            fun bind(item: HistoryItem.DateHeader) {
                val isToday = item.date == today
                val label = if (isToday) "${item.date}  · Today" else item.date
                itemView.findViewById<TextView>(R.id.tvHistDate).text = label
                itemView.findViewById<TextView>(R.id.tvHistDateStats).text =
                    "${item.onDuty} on duty · ${item.offDuty} off duty"
            }
        }

        inner class RecordVH(v: View) : RecyclerView.ViewHolder(v) {
            fun bind(item: HistoryItem.RecordRow) {
                val rec = item.record
                val canEdit = item.isToday && editMode

                val initials = rec.staffName
                    ?.split(" ")?.mapNotNull { it.firstOrNull() }?.take(2)
                    ?.joinToString("") ?.uppercase() ?: "?"

                itemView.findViewById<TextView>(R.id.tvHistInitials).apply {
                    text = initials
                    setBackgroundColor(avatarColor(rec.staffName ?: "?"))
                }

                itemView.findViewById<TextView>(R.id.tvHistStaffName).text =
                    rec.staffName ?: "Unknown"

                val statusView = itemView.findViewById<TextView>(R.id.tvHistStatus)
                statusView.text = rec.status
                if (rec.status == "On Duty") {
                    statusView.setTextColor(Color.parseColor("#15803d"))
                } else {
                    statusView.setTextColor(Color.parseColor("#dc2626"))
                }

                // Time
                itemView.findViewById<TextView>(R.id.tvHistTime).text = rec.recordedAt?.let {
                    try { it.substring(11, 16) } catch (_: Exception) { it }
                } ?: "—"

                // Late — static text or toggle button
                val tvLate = itemView.findViewById<TextView>(R.id.tvHistLate)
                val btnLate = itemView.findViewById<MaterialButton>(R.id.btnToggleLate)
                if (canEdit) {
                    tvLate.visibility = View.GONE
                    btnLate.visibility = View.VISIBLE
                    btnLate.text = if (rec.isLate) "⏰ Late" else "On Time"
                    btnLate.setOnClickListener { onToggleLate(rec) }
                } else {
                    tvLate.visibility = View.VISIBLE
                    btnLate.visibility = View.GONE
                    tvLate.text = if (rec.isLate) "⏰ Late" else "On Time"
                    tvLate.setTextColor(if (rec.isLate) Color.parseColor("#dc2626") else Color.parseColor("#15803d"))
                }

                // Status toggle (edit mode only)
                val btnStatus = itemView.findViewById<MaterialButton>(R.id.btnToggleStatus)
                if (canEdit) {
                    btnStatus.visibility = View.VISIBLE
                    btnStatus.text = if (rec.status == "On Duty") "→ Off Duty" else "→ On Duty"
                    btnStatus.setOnClickListener { onToggleStatus(rec) }
                } else {
                    btnStatus.visibility = View.GONE
                }
            }
        }

    }
}
