package com.app.mobile.ui.admin

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
import com.app.mobile.AdminDashboardActivity
import com.app.mobile.ApiClient
import com.app.mobile.R
import com.app.mobile.adapters.FittingBookingAdapter
import com.app.mobile.databinding.FragmentFittingBookingsBinding
import com.app.mobile.models.*
import com.app.mobile.sse.SseClient
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.File
import java.util.*

class FittingBookingsFragment : Fragment(), SseClient.SseListener {

    private var _binding: FragmentFittingBookingsBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: FittingBookingAdapter
    private var allBookings     = listOf<FittingBooking>()
    private var archivedBookings = listOf<FittingBooking>()
    private var searchQuery     = ""
    private var allItems        = listOf<InventoryItem>()

    companion object {
        private val TERMINAL_STATUSES = setOf("COMPLETED", "CANCELLED", "CANCELED", "REJECTED", "LEASE_CONVERTED")
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentFittingBookingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = FittingBookingAdapter { booking -> showBookingDetails(booking) }
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
        loadItems()
        loadBookings()
    }

    private fun loadItems() {
        viewLifecycleOwner.lifecycleScope.launch {
            try { allItems = ApiClient.adminApi.getInventoryItems() } catch (_: Exception) {}
        }
    }

    private fun loadBookings() {
        viewLifecycleOwner.lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            try {
                val resp = ApiClient.adminApi.getFittingBookings(ApiClient.bearerToken())
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
        val (archived, active) = allBookings.partition { it.status.uppercase() in TERMINAL_STATUSES }
        archivedBookings = archived

        val filtered = if (searchQuery.isEmpty()) active
        else active.filter {
            it.customerName.contains(searchQuery, true) ||
            it.itemName.contains(searchQuery, true) ||
            it.bookingId.contains(searchQuery, true) ||
            it.status.contains(searchQuery, true)
        }
        adapter.submitList(filtered)
        binding.tvEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE

        (parentFragment as? BookingsFragment)?.onArchivedCountChanged()
    }

    fun hasArchivedBookings() = archivedBookings.isNotEmpty()

    fun showArchivedSheet() {
        ArchivedFittingBookingsBottomSheet().apply {
            this.allArchived          = archivedBookings
            this.onShowBookingDetails = { booking -> showBookingDetails(booking) }
        }.show(childFragmentManager, "archived_fittings")
    }

    // ── Bottom sheet on click ─────────────────────────────────────────────────

    private fun showBookingDetails(booking: FittingBooking) {
        FittingBookingBottomSheet().apply {
            this.booking       = booking
            this.allItems      = this@FittingBookingsFragment.allItems
            onReload           = { loadBookings() }
            onReschedule       = { b -> showRescheduleDialog(b) }
            onProceedToLease   = { b -> showFittingToLeaseDialog(b) }
        }.show(childFragmentManager, "fitting_detail")
    }

    // ── Sub-dialogs (called from FittingBookingBottomSheet via parentFragment) ─

    internal fun showFittingToLeaseDialog(booking: FittingBooking) {
        val view          = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_fitting_to_lease, null)
        val tvCustName    = view.findViewById<TextView>(R.id.ftlCustomerName)
        val tvItemName    = view.findViewById<TextView>(R.id.ftlItemName)
        val tvFittingInfo = view.findViewById<TextView>(R.id.ftlFittingInfo)
        val tvDailyRate   = view.findViewById<TextView>(R.id.ftlDailyRate)
        val etPickup      = view.findViewById<EditText>(R.id.etPickupDate)
        val etReturn      = view.findViewById<EditText>(R.id.etReturnDate)
        val tvAvail       = view.findViewById<TextView>(R.id.ftlAvailability)
        val tvDateError   = view.findViewById<TextView>(R.id.ftlDateError)
        val priceSummary  = view.findViewById<View>(R.id.ftlPriceSummary)
        val tvDaysCalc    = view.findViewById<TextView>(R.id.ftlDaysCalc)
        val tvSubtotal    = view.findViewById<TextView>(R.id.ftlSubtotal)
        val tvDiscountRow = view.findViewById<View>(R.id.ftlDiscountRow)
        val tvDiscountVal = view.findViewById<TextView>(R.id.ftlDiscountVal)
        val tvTotal       = view.findViewById<TextView>(R.id.ftlTotal)
        val etNotes       = view.findViewById<EditText>(R.id.etFtlNotes)

        val item      = allItems.firstOrNull { it.name.equals(booking.itemName, ignoreCase = true) }
        val itemId    = item?.id ?: ""
        val dailyRate = item?.price ?: 0.0

        tvCustName.text    = booking.customerName
        tvItemName.text    = booking.itemName
        tvFittingInfo.text = "Fitting: ${booking.fittingDate} at ${booking.fittingTime}"
        tvDailyRate.text   = "₱${String.format("%.2f", dailyRate)} / day"

        var pickupDate = ""
        var returnDate = ""
        var availResult: Boolean? = null
        val availHandler = Handler(Looper.getMainLooper())
        var ftlOccupiedRanges = listOf<OccupiedDateRange>()
        var ftlInvSettings: InventorySettings? = null

        // Disable date pickers until occupied ranges are loaded
        etPickup.isEnabled = false
        etReturn.isEnabled = false

        fun recalcPrice() {
            if (pickupDate.isEmpty() || returnDate.isEmpty()) { priceSummary.visibility = View.GONE; return }
            try {
                val start = parseDate(pickupDate); val end = parseDate(returnDate)
                if (end.before(start)) {
                    tvDateError.text = "Return date must be after pickup date"; tvDateError.visibility = View.VISIBLE
                    priceSummary.visibility = View.GONE; return
                }
                tvDateError.visibility = View.GONE
                val days     = ((end.time - start.time) / 86_400_000L + 1).toInt()
                val base     = dailyRate * days
                val inv      = ftlInvSettings
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
            if (pickupDate.isEmpty() || returnDate.isEmpty() || itemId.isEmpty()) return
            availHandler.removeCallbacksAndMessages(null)
            availHandler.postDelayed({
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        tvAvail.visibility = View.VISIBLE; tvAvail.text = "Checking availability…"
                        tvAvail.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.gray_100))
                        tvAvail.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle))
                        val resp = ApiClient.adminApi.checkDirectAvailability(ApiClient.bearerToken(), itemId, pickupDate, returnDate)
                        availResult = resp.available
                        tvAvail.text = if (resp.available) "✓ Item is available for these dates" else "✗ Item is not available"
                        tvAvail.setBackgroundColor(ContextCompat.getColor(requireContext(), if (resp.available) R.color.status_confirmed_bg else R.color.status_cancelled_bg))
                        tvAvail.setTextColor(ContextCompat.getColor(requireContext(), if (resp.available) R.color.status_confirmed_text else R.color.status_cancelled_text))
                    } catch (_: Exception) { tvAvail.visibility = View.GONE }
                }
            }, 500)
        }

        etPickup.setOnClickListener {
            CalendarPickerDialog().apply {
                mode = CalendarPickerDialog.Mode.DIRECT; this.itemId = itemId
                minDate = CalendarPickerDialog.todayStr(); currentValue = pickupDate
                passedOccupiedRanges = ftlOccupiedRanges
                onDateSelected = { date ->
                    pickupDate = date; etPickup.setText(date)
                    if (returnDate.isNotEmpty() && returnDate < pickupDate) { returnDate = ""; etReturn.setText("") }
                    recalcPrice(); checkAvailability()
                }
            }.show(childFragmentManager, "ftl_pickup_cal")
        }

        etReturn.setOnClickListener {
            CalendarPickerDialog().apply {
                mode = CalendarPickerDialog.Mode.DIRECT; this.itemId = itemId
                minDate = pickupDate.ifEmpty { CalendarPickerDialog.todayStr() }; currentValue = returnDate
                passedOccupiedRanges = ftlOccupiedRanges
                onDateSelected = { date -> returnDate = date; etReturn.setText(date); recalcPrice(); checkAvailability() }
            }.show(childFragmentManager, "ftl_return_cal")
        }

        val ftlDialog = AlertDialog.Builder(requireContext())
            .setTitle("Proceed to Rental")
            .setView(view)
            .setPositiveButton("Confirm Rental") { _, _ ->
                if (pickupDate.isEmpty() || returnDate.isEmpty()) { toast("Select both dates"); return@setPositiveButton }
                if (availResult == false) { toast("Item not available for selected dates"); return@setPositiveButton }
                val days     = ((parseDate(returnDate).time - parseDate(pickupDate).time) / 86_400_000L + 1).toInt().coerceAtLeast(1)
                val base     = dailyRate * days
                val inv      = ftlInvSettings
                val weeks    = days / 7
                val rawDisc  = weeks * (inv?.weeklyDiscount ?: 0).toDouble()
                val discount = minOf(rawDisc, inv?.monthlyDiscountCap?.toDouble() ?: rawDisc)
                val finalAmt = maxOf(0.0, base - discount)
                val notes = etNotes.text.toString().trim().ifEmpty { "Post-fitting rental for ${booking.itemName}" }
                val req = CreateDirectBookingRequest(
                    customerEmail = booking.customerEmail, customerName = booking.customerName,
                    customerPhone = booking.customerPhone, itemId = itemId, itemName = booking.itemName,
                    startDate = pickupDate, endDate = returnDate, basePrice = base,
                    discountAmount = discount, finalPrice = finalAmt, notes = notes, preferredSize = booking.preferredSize
                )
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        val fittingStatus = resolveFittingStatusOnRental(booking.fittingDate, booking.fittingTime)
                        ApiClient.adminApi.updateFittingStatus(ApiClient.bearerToken(), booking.id, fittingStatus)
                        ApiClient.adminApi.createDirectBooking(ApiClient.bearerToken(), req)
                        toast("Rental booking created!"); loadBookings()
                    } catch (e: HttpException) {
                        if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                        else toast("Error: ${e.message()}")
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null)
            .create()
        ftlDialog.show()
        // Fetch inventory settings and occupied ranges async; enable pickers once ready.
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ftlInvSettings = ApiClient.adminApi.getInventorySettings(ApiClient.bearerToken())
            } catch (_: Exception) { }

            try {
                val ranges = ApiClient.adminApi.getOccupiedDates(ApiClient.bearerToken(), itemId)
                if (!ftlDialog.isShowing) return@launch
                ftlOccupiedRanges = ranges
            } catch (_: Exception) { }

            if (!ftlDialog.isShowing) return@launch
            etPickup.isEnabled = true
            etReturn.isEnabled = true
        }
    }

    internal fun showRescheduleDialog(booking: FittingBooking) {
        val view   = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_reschedule, null)
        val etDate = view.findViewById<EditText>(R.id.etDate)
        val etTime = view.findViewById<EditText>(R.id.etTime)
        etDate.setText(booking.fittingDate)
        etTime.setText(booking.fittingTime)

        val itemId = allItems.firstOrNull { it.name.equals(booking.itemName, ignoreCase = true) }?.id ?: ""

        var rscTimeSlots  = CalendarPickerDialog.buildTimeSlots(null)
        var rscBooked     = listOf<String>()
        var isLoadingSlots = false

        fun updateTimeHint() {
            etTime.isEnabled = when {
                isLoadingSlots -> false.also { etTime.hint = "Loading slots…" }
                else           -> true.also  { if (etTime.text.isNullOrEmpty()) etTime.hint = "Tap to choose a time slot" }
            }
        }

        fun loadSlotsForDate(date: String) {
            if (date.isEmpty() || itemId.isEmpty()) return
            isLoadingSlots = true; updateTimeHint()
            viewLifecycleOwner.lifecycleScope.launch {
                rscBooked = try { ApiClient.adminApi.getBookedFittingSlots(itemId, date) } catch (_: Exception) { emptyList() }
                isLoadingSlots = false
                // Clear chosen time if it is now booked by someone else
                if (etTime.text.toString() in rscBooked) etTime.setText("")
                updateTimeHint()
            }
        }

        // Load settings to build time slots list
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val settings  = ApiClient.adminApi.getBookingSettings(ApiClient.bearerToken())
                rscTimeSlots  = CalendarPickerDialog.buildTimeSlots(settings)
            } catch (_: Exception) {}
            loadSlotsForDate(booking.fittingDate)
        }

        etDate.isFocusable = false
        etDate.isClickable = true
        etDate.setOnClickListener {
            CalendarPickerDialog().apply {
                mode = CalendarPickerDialog.Mode.FITTING
                this.itemId = itemId
                minDate = CalendarPickerDialog.todayStr()
                currentValue = etDate.text.toString()
                onDateSelected = { date ->
                    etDate.setText(date)
                    etTime.setText("")
                    loadSlotsForDate(date)
                }
            }.show(childFragmentManager, "reschedule_cal")
        }

        etTime.isFocusable = false
        etTime.isClickable = true
        etTime.setOnClickListener {
            TimeSlotPickerDialog().apply {
                timeSlots   = rscTimeSlots
                bookedSlots = rscBooked
                currentValue = etTime.text.toString()
                onSlotSelected = { slot -> etTime.setText(slot) }
            }.show(childFragmentManager, "reschedule_tsp")
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Reschedule Fitting")
            .setView(view)
            .setPositiveButton("Save") { _, _ ->
                val date = etDate.text.toString().trim()
                val time = etTime.text.toString().trim()
                if (date.isEmpty() || time.isEmpty()) { toast("Fill all fields"); return@setPositiveButton }
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.rescheduleFitting(ApiClient.bearerToken(), booking.id, RescheduleRequest(date, time))
                        toast("Rescheduled successfully"); loadBookings()
                    } catch (e: HttpException) {
                        if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                        else toast("Failed: ${e.message()}")
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ── Export ────────────────────────────────────────────────────────────────

    private fun showExportDialog() {
        val currentList = adapter.currentList
        if (currentList.isEmpty()) { toast("No bookings to export"); return }

        val view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_export_bookings, null)
        view.findViewById<TextView>(R.id.tvExportCount).text =
            "Exporting ${currentList.size} booking${if (currentList.size != 1) "s" else ""}"

        AlertDialog.Builder(requireContext())
            .setTitle("Export Fitting Bookings")
            .setView(view)
            .setPositiveButton("Export") { _, _ ->
                val useCsv = view.findViewById<RadioButton>(R.id.rbCsv).isChecked
                exportBookings(currentList, useCsv)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun exportBookings(bookings: List<FittingBooking>, asCsv: Boolean) {
        val content = if (asCsv) {
            buildString {
                appendLine("BookingID,Customer,Email,Phone,Item,Size,Date,Time,Status,Notes")
                bookings.forEach { b ->
                    appendLine("${b.bookingId},\"${b.customerName}\",${b.customerEmail},${b.customerPhone},\"${b.itemName}\",${b.preferredSize},${b.fittingDate},${b.fittingTime},${b.status},\"${b.notes ?: ""}\"")
                }
            }
        } else {
            buildString {
                appendLine("FITTING BOOKINGS EXPORT")
                appendLine("=".repeat(40))
                bookings.forEach { b ->
                    appendLine("ID: ${b.bookingId}  |  ${b.status}")
                    appendLine("Customer: ${b.customerName} (${b.customerEmail})")
                    appendLine("Item: ${b.itemName}  |  Size: ${b.preferredSize}")
                    appendLine("Fitting: ${b.fittingDate} at ${b.fittingTime}")
                    if (!b.notes.isNullOrEmpty()) appendLine("Notes: ${b.notes}")
                    appendLine("-".repeat(40))
                }
            }
        }

        try {
            val ext      = if (asCsv) "csv" else "txt"
            val fileName = "fitting_bookings_${System.currentTimeMillis()}.$ext"
            val file     = File(requireContext().cacheDir, fileName)
            file.writeText(content)
            val uri = FileProvider.getUriForFile(requireContext(), "${requireContext().packageName}.fileprovider", file)
            startActivity(Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = if (asCsv) "text/csv" else "text/plain"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }, "Export Fitting Bookings"
            ))
        } catch (_: Exception) { toast("Export failed") }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun resolveFittingStatusOnRental(fittingDate: String, fittingTime: String): String {
        return try {
            val dp = fittingDate.split("-")
            val tp = fittingTime.split(":")
            val fittingCal = Calendar.getInstance().apply {
                set(dp[0].toInt(), dp[1].toInt() - 1, dp[2].toInt(), tp[0].toInt(), tp[1].toInt(), 0)
                set(Calendar.MILLISECOND, 0)
            }
            if (Calendar.getInstance().before(fittingCal)) "Cancelled" else "Completed"
        } catch (_: Exception) { "Cancelled" }
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
