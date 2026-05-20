package com.app.mobile.features.admin.dialogs

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.EditText
import android.widget.TextView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.app.mobile.R
import com.app.mobile.features.admin.adapters.FittingBookingAdapter
import com.app.mobile.shared.models.FittingBooking
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.chip.ChipGroup

class ArchivedFittingBookingsBottomSheet : BottomSheetDialogFragment() {

    var allArchived: List<FittingBooking> = emptyList()
    var onShowBookingDetails: ((FittingBooking) -> Unit)? = null

    private lateinit var adapter: FittingBookingAdapter
    private var filterStatus = "ALL"
    private var searchQuery = ""

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.bottom_sheet_archived_fittings, container, false)

    override fun onStart() {
        super.onStart()
        (dialog as? BottomSheetDialog)?.behavior?.apply {
            state = BottomSheetBehavior.STATE_EXPANDED
            skipCollapsed = true
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = FittingBookingAdapter { booking ->
            dismiss()
            onShowBookingDetails?.invoke(booking)
        }

        view.findViewById<RecyclerView>(R.id.recyclerView).apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@ArchivedFittingBookingsBottomSheet.adapter
        }

        view.findViewById<TextView>(R.id.tvArchivedCount).text = "${allArchived.size} total"

        view.findViewById<ChipGroup>(R.id.chipGroup).setOnCheckedStateChangeListener { _, checkedIds ->
            filterStatus = when (checkedIds.firstOrNull()) {
                R.id.chipCompleted -> "COMPLETED"
                R.id.chipCancelled -> "CANCELLED"
                else               -> "ALL"
            }
            applyFilter(view)
        }

        view.findViewById<EditText>(R.id.etSearch).addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { searchQuery = s.toString(); applyFilter(view) }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        applyFilter(view)
    }

    private fun applyFilter(view: View) {
        val filtered = allArchived.filter { booking ->
            val matchesStatus = when (filterStatus) {
                "COMPLETED" -> booking.status.uppercase() in listOf("COMPLETED", "LEASE_CONVERTED")
                "CANCELLED" -> booking.status.uppercase() in listOf("CANCELLED", "CANCELED", "REJECTED")
                else        -> true
            }
            val matchesSearch = searchQuery.isEmpty() ||
                booking.customerName.contains(searchQuery, true) ||
                booking.itemName.contains(searchQuery, true) ||
                booking.bookingId.contains(searchQuery, true)
            matchesStatus && matchesSearch
        }
        adapter.submitList(filtered)
        view.findViewById<TextView>(R.id.tvEmpty).visibility =
            if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }
}
