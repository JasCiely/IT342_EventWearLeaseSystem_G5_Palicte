package com.app.mobile.features.admin.fragments

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.features.admin.adapters.DirectBookingAdapter
import com.app.mobile.features.admin.dialogs.ArchivedDirectBookingsBottomSheet
import com.app.mobile.features.admin.dialogs.CalendarPickerDialog
import com.app.mobile.features.admin.dialogs.DirectBookingBottomSheet
import com.app.mobile.R
import com.app.mobile.databinding.FragmentDirectBookingsBinding
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.*
import com.app.mobile.shared.sse.SseClient
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.File
import java.util.*

class DirectBookingsFragment : Fragment(), SseClient.SseListener {

    private var _binding: FragmentDirectBookingsBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: DirectBookingAdapter
    private var allBookings      = listOf<DirectBooking>()
    private var archivedBookings = listOf<DirectBooking>()
    private var searchQuery      = ""

    companion object {
        private val TERMINAL_STATUSES = setOf("Returned", "Completed", "Cancelled")
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentDirectBookingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = DirectBookingAdapter { booking -> showBookingDetails(booking) }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { searchQuery = s.toString(); applyFilter() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        binding.btnExport.setOnClickListener { showExportDialog() }
        binding.swipeRefresh.setOnRefreshListener { loadBookings() }
        SseClient.addListener(this)
        loadBookings()
    }

    private fun loadBookings() {
        viewLifecycleOwner.lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            try {
                val resp = ApiClient.adminApi.getDirectBookings(ApiClient.bearerToken())
                allBookings = resp.content
                applyFilter()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Error: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
            binding.swipeRefresh.isRefreshing = false
        }
    }

    private fun applyFilter() {
        val (archived, active) = allBookings.partition { it.bookingStatus in TERMINAL_STATUSES }
        archivedBookings = archived

        val filtered = if (searchQuery.isEmpty()) active
        else active.filter {
            it.customerName.contains(searchQuery, true) ||
            it.itemName.contains(searchQuery, true) ||
            it.bookingStatus.contains(searchQuery, true)
        }
        adapter.submitList(filtered)
        binding.tvEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE

        (parentFragment as? BookingsFragment)?.onArchivedCountChanged()
    }

    fun hasArchivedBookings() = archivedBookings.isNotEmpty()

    fun showArchivedSheet() {
        ArchivedDirectBookingsBottomSheet().apply {
            this.allArchived          = archivedBookings
            this.onShowBookingDetails = { booking -> showBookingDetails(booking) }
        }.show(childFragmentManager, "archived_direct")
    }

    private fun showBookingDetails(booking: DirectBooking) {
        DirectBookingBottomSheet().apply {
            this.booking = booking
            onReload     = { loadBookings() }
        }.show(childFragmentManager, "direct_detail")
    }

    internal fun showExtendDialog(booking: DirectBooking) {
        val view           = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_extend, null)
        val tvCustomer     = view.findViewById<TextView>(R.id.tvExtendCustomer)
        val tvItem         = view.findViewById<TextView>(R.id.tvExtendItem)
        val tvCurrentEnd   = view.findViewById<TextView>(R.id.tvExtendCurrentEnd)
        val tvInfo         = view.findViewById<TextView>(R.id.tvExtendInfo)
        val etDate         = view.findViewById<EditText>(R.id.etNewEndDate)

        val currentEndDate = booking.endDate.ifEmpty { CalendarPickerDialog.todayStr() }
        val minDate        = addOneDay(currentEndDate)

        tvCustomer.text   = booking.customerName
        tvItem.text       = booking.itemName
        tvCurrentEnd.text = "Current end: ${booking.endDate}"

        etDate.isEnabled = false
        applyBanner(tvInfo, BannerState.LOADING)

        var selectedDate       = ""
        var unavailableRanges  = listOf<OccupiedDateRange>()
        var maxDate: String?   = null

        etDate.setOnClickListener {
            CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                this.minDate         = minDate
                currentValue         = selectedDate
                passedOccupiedRanges = buildOccupiedForPicker(unavailableRanges, maxDate)
                onDateSelected       = { date -> selectedDate = date; etDate.setText(date) }
            }.show(childFragmentManager, "extend_cal")
        }

        val dialog = AlertDialog.Builder(requireContext())
            .setTitle("Extend Lease")
            .setView(view)
            .setPositiveButton("Extend Lease") { _, _ ->
                if (selectedDate.isEmpty()) { toast("Select a new end date"); return@setPositiveButton }
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.extendLease(ApiClient.bearerToken(), booking.id, ExtendRequest(selectedDate))
                        toast("Lease extended to $selectedDate")
                        loadBookings()
                    } catch (e: HttpException) {
                        if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                        else toast("Extension failed — dates may conflict with another booking")
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null)
            .create()

        dialog.show()

        viewLifecycleOwner.lifecycleScope.launch {
            val itemId = booking.inventoryItemId ?: ""
            if (itemId.isNotEmpty()) {
                try {
                    unavailableRanges = ApiClient.adminApi.getUnavailableDates(
                        ApiClient.bearerToken(), itemId, booking.id
                    )
                    maxDate = calcMaxDate(unavailableRanges, currentEndDate)
                } catch (_: Exception) { }
            }
            if (!dialog.isShowing) return@launch
            etDate.isEnabled = true
            applyBanner(
                tvInfo,
                if (maxDate != null) BannerState.WARNING else BannerState.SUCCESS,
                maxDate,
                currentEndDate
            )
        }
    }

    private enum class BannerState { LOADING, WARNING, SUCCESS }

    private fun applyBanner(tv: TextView, state: BannerState, maxDate: String? = null, currentEnd: String? = null) {
        val (text, bgColor, textColor) = when (state) {
            BannerState.LOADING -> Triple(
                "Checking availability…",
                ContextCompat.getColor(requireContext(), R.color.gray_100),
                ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle)
            )
            BannerState.WARNING -> Triple(
                "Max extension: $maxDate — next booking starts after this date",
                ContextCompat.getColor(requireContext(), R.color.status_pending_bg),
                ContextCompat.getColor(requireContext(), R.color.status_pending_text)
            )
            BannerState.SUCCESS -> Triple(
                "No upcoming conflicts — item is free after $currentEnd.",
                ContextCompat.getColor(requireContext(), R.color.status_confirmed_bg),
                ContextCompat.getColor(requireContext(), R.color.status_confirmed_text)
            )
        }
        tv.text = text
        val bg = android.graphics.drawable.GradientDrawable().apply {
            shape = android.graphics.drawable.GradientDrawable.RECTANGLE
            setColor(bgColor)
            cornerRadius = resources.displayMetrics.density * 6
        }
        tv.background = bg
        tv.setTextColor(textColor)
    }

    private fun addOneDay(dateStr: String): String {
        val parts = dateStr.split("-")
        val cal = Calendar.getInstance()
        cal.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt(), 12, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        cal.add(Calendar.DAY_OF_MONTH, 1)
        return "${cal.get(Calendar.YEAR)}-${(cal.get(Calendar.MONTH)+1).toString().padStart(2,'0')}-${cal.get(Calendar.DAY_OF_MONTH).toString().padStart(2,'0')}"
    }

    private fun subtractOneDay(dateStr: String): String {
        val parts = dateStr.split("-")
        val cal = Calendar.getInstance()
        cal.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt(), 12, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        cal.add(Calendar.DAY_OF_MONTH, -1)
        return "${cal.get(Calendar.YEAR)}-${(cal.get(Calendar.MONTH)+1).toString().padStart(2,'0')}-${cal.get(Calendar.DAY_OF_MONTH).toString().padStart(2,'0')}"
    }

    private fun calcMaxDate(ranges: List<OccupiedDateRange>, currentEndDate: String): String? {
        val future = ranges.filter { it.startDate > currentEndDate }.sortedBy { it.startDate }
        return if (future.isEmpty()) null else subtractOneDay(future[0].startDate)
    }

    private fun buildOccupiedForPicker(ranges: List<OccupiedDateRange>, maxDate: String?): List<OccupiedDateRange> {
        if (maxDate == null) return ranges
        return ranges + OccupiedDateRange(addOneDay(maxDate), "9999-12-31")
    }

    internal fun showEditRentalDatesDialog(booking: DirectBooking) {
        val view        = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_edit_rental_dates, null)
        val tvCurrent   = view.findViewById<TextView>(R.id.tvCurrentDates)
        val etStart     = view.findViewById<EditText>(R.id.etNewStartDate)
        val etEnd       = view.findViewById<EditText>(R.id.etNewEndDate)
        val tvAvail     = view.findViewById<TextView>(R.id.tvAvailability)
        val tvDateError = view.findViewById<TextView>(R.id.tvDateError)
        val priceSummary  = view.findViewById<View>(R.id.layoutPriceSummary)
        val tvDaysCalc    = view.findViewById<TextView>(R.id.tvDaysCalc)
        val tvSubtotal    = view.findViewById<TextView>(R.id.tvSubtotal)
        val tvDiscountRow = view.findViewById<View>(R.id.layoutDiscountRow)
        val tvDiscountVal = view.findViewById<TextView>(R.id.tvDiscountVal)
        val tvTotal       = view.findViewById<TextView>(R.id.tvTotal)

        tvCurrent.text = "${booking.startDate} → ${booking.endDate}"
        etStart.setText(booking.startDate)
        etEnd.setText(booking.endDate)

        val dailyRate = if (booking.totalDays > 0) booking.basePrice / booking.totalDays else 0.0
        var newStart           = booking.startDate
        var newEnd             = booking.endDate
        var availResult: Boolean? = null
        val availHandler       = Handler(Looper.getMainLooper())
        var editOccupiedRanges = listOf<OccupiedDateRange>()
        var editInvSettings: InventorySettings? = null

        fun recalcPrice() {
            if (newStart.isEmpty() || newEnd.isEmpty()) { priceSummary.visibility = View.GONE; return }
            try {
                val s = parseDate(newStart); val e = parseDate(newEnd)
                if (e.before(s)) {
                    tvDateError.text = "End date must be after start date"
                    tvDateError.visibility = View.VISIBLE
                    priceSummary.visibility = View.GONE
                    return
                }
                tvDateError.visibility = View.GONE
                val days     = ((e.time - s.time) / 86_400_000L + 1).toInt()
                val base     = dailyRate * days
                val inv      = editInvSettings
                val weeks    = days / 7
                val rawDisc  = weeks * (inv?.weeklyDiscount ?: 0).toDouble()
                val discount = minOf(rawDisc, inv?.monthlyDiscountCap?.toDouble() ?: rawDisc)
                val finalAmt = maxOf(0.0, base - discount)
                tvDaysCalc.text = "$days day${if (days != 1) "s" else ""} × ₱${String.format("%.2f", dailyRate)}"
                tvSubtotal.text = "₱${String.format("%.2f", base)}"
                if (discount > 0) {
                    tvDiscountRow.visibility = View.VISIBLE
                    tvDiscountVal.text = "-₱${String.format("%.2f", discount)}"
                } else {
                    tvDiscountRow.visibility = View.GONE
                }
                tvTotal.text = "₱${String.format("%.2f", finalAmt)}"
                priceSummary.visibility = View.VISIBLE
            } catch (_: Exception) { priceSummary.visibility = View.GONE }
        }

        fun checkAvailability() {
            if (newStart.isEmpty() || newEnd.isEmpty()) return
            availHandler.removeCallbacksAndMessages(null)
            availHandler.postDelayed({
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        tvAvail.visibility = View.VISIBLE
                        tvAvail.text = "Checking availability…"
                        tvAvail.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.gray_100))
                        tvAvail.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle))
                        availResult = true
                        tvAvail.text = "✓ Dates updated"
                        tvAvail.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.status_confirmed_bg))
                        tvAvail.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_confirmed_text))
                    } catch (_: Exception) { tvAvail.visibility = View.GONE }
                }
            }, 300)
        }

        etStart.isEnabled = false
        etEnd.isEnabled   = false

        etStart.setOnClickListener {
            CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                minDate              = CalendarPickerDialog.todayStr()
                currentValue         = newStart
                passedOccupiedRanges = editOccupiedRanges
                onDateSelected = { date ->
                    newStart = date; etStart.setText(date)
                    if (newEnd.isNotEmpty() && newEnd < newStart) { newEnd = ""; etEnd.setText("") }
                    recalcPrice(); checkAvailability()
                }
            }.show(childFragmentManager, "edit_start_cal")
        }

        etEnd.setOnClickListener {
            CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                minDate              = newStart.ifEmpty { CalendarPickerDialog.todayStr() }
                currentValue         = newEnd
                passedOccupiedRanges = editOccupiedRanges
                onDateSelected = { date ->
                    newEnd = date; etEnd.setText(date)
                    recalcPrice(); checkAvailability()
                }
            }.show(childFragmentManager, "edit_end_cal")
        }

        recalcPrice()

        val editDialog = AlertDialog.Builder(requireContext())
            .setTitle("Edit Rental Dates")
            .setView(view)
            .setPositiveButton("Save Dates") { _, _ ->
                if (newStart.isEmpty() || newEnd.isEmpty()) { toast("Select both dates"); return@setPositiveButton }
                if (newStart == booking.startDate && newEnd == booking.endDate) { toast("No changes made"); return@setPositiveButton }
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.updateBookingDates(ApiClient.bearerToken(), booking.id, UpdateDatesRequest(newStart, newEnd))
                        toast("Rental dates updated"); loadBookings()
                    } catch (e: HttpException) {
                        if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                        else toast("Failed: ${e.message()}")
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null)
            .create()

        editDialog.show()

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                editInvSettings = ApiClient.adminApi.getInventorySettings(ApiClient.bearerToken())
                if (editDialog.isShowing) recalcPrice()
            } catch (_: Exception) { }

            val itemId = booking.inventoryItemId ?: ""
            if (itemId.isNotEmpty()) {
                try {
                    editOccupiedRanges = ApiClient.adminApi.getUnavailableDates(
                        ApiClient.bearerToken(), itemId, booking.id
                    )
                } catch (_: Exception) { }
            }
            if (editDialog.isShowing) {
                etStart.isEnabled = true
                etEnd.isEnabled   = true
            }
        }
    }

    private fun showExportDialog() {
        val currentList = adapter.currentList
        if (currentList.isEmpty()) { toast("No bookings to export"); return }

        val view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_export_bookings, null)
        view.findViewById<TextView>(R.id.tvExportCount).text =
            "Exporting ${currentList.size} booking${if (currentList.size != 1) "s" else ""}"

        AlertDialog.Builder(requireContext())
            .setTitle("Export Direct Bookings")
            .setView(view)
            .setPositiveButton("Export") { _, _ ->
                val useCsv = view.findViewById<RadioButton>(R.id.rbCsv).isChecked
                exportBookings(currentList, useCsv)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun exportBookings(bookings: List<DirectBooking>, asCsv: Boolean) {
        val content = if (asCsv) {
            buildString {
                appendLine("ID,Customer,Email,Phone,Item,Size,StartDate,EndDate,Days,BasePrice,Discount,FinalPrice,Status,Notes")
                bookings.forEach { b ->
                    appendLine("${b.id.takeLast(8)},\"${b.customerName}\",${b.customerEmail},${b.customerPhone},\"${b.itemName}\",${b.preferredSize},${b.startDate},${b.endDate},${b.totalDays},${b.basePrice},${b.discountAmount},${b.finalPrice},${b.bookingStatus},\"${b.notes ?: ""}\"")
                }
            }
        } else {
            buildString {
                appendLine("DIRECT BOOKINGS EXPORT")
                appendLine("=".repeat(40))
                bookings.forEach { b ->
                    appendLine("ID: ${b.id.takeLast(8)}  |  ${b.bookingStatus}")
                    appendLine("Customer: ${b.customerName} (${b.customerEmail})")
                    appendLine("Item: ${b.itemName}  |  Size: ${b.preferredSize}")
                    appendLine("Rental: ${b.startDate} → ${b.endDate}  (${b.totalDays} days)")
                    appendLine("Price: ₱${String.format("%.2f", b.finalPrice)}")
                    if (!b.notes.isNullOrEmpty()) appendLine("Notes: ${b.notes}")
                    appendLine("-".repeat(40))
                }
            }
        }

        try {
            val ext      = if (asCsv) "csv" else "txt"
            val fileName = "direct_bookings_${System.currentTimeMillis()}.$ext"
            val file     = File(requireContext().cacheDir, fileName)
            file.writeText(content)
            val uri = FileProvider.getUriForFile(requireContext(), "${requireContext().packageName}.fileprovider", file)
            startActivity(Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = if (asCsv) "text/csv" else "text/plain"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }, "Export Direct Bookings"
            ))
        } catch (_: Exception) { toast("Export failed") }
    }

    private fun parseDate(s: String): Date {
        val parts = s.split("-")
        val cal   = Calendar.getInstance()
        cal.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt(), 0, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.time
    }

    fun reload() { loadBookings() }

    override fun onEvent(type: String, data: String) { if (type == "BOOKING_UPDATE") loadBookings() }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        SseClient.removeListener(this)
        _binding = null
    }
}
