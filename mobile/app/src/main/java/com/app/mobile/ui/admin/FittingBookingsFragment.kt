package com.app.mobile.ui.admin

import android.app.DatePickerDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.mobile.ApiClient
import com.app.mobile.AdminDashboardActivity
import com.app.mobile.R
import com.app.mobile.adapters.FittingBookingAdapter
import com.app.mobile.databinding.FragmentFittingBookingsBinding
import com.app.mobile.models.CreateDirectBookingRequest
import com.app.mobile.models.FittingBooking
import com.app.mobile.models.InventoryItem
import com.app.mobile.models.RescheduleRequest
import com.app.mobile.sse.SseClient
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.util.*

class FittingBookingsFragment : Fragment(), SseClient.SseListener {

    private var _binding: FragmentFittingBookingsBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: FittingBookingAdapter
    private var allBookings  = listOf<FittingBooking>()
    private var searchQuery  = ""
    private var allItems     = listOf<InventoryItem>()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentFittingBookingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = FittingBookingAdapter { booking -> showBookingActions(booking) }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { searchQuery = s.toString(); applyFilter() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

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
        val filtered = if (searchQuery.isEmpty()) allBookings
        else allBookings.filter {
            it.customerName.contains(searchQuery, true) ||
            it.itemName.contains(searchQuery, true) ||
            it.bookingId.contains(searchQuery, true) ||
            it.status.contains(searchQuery, true)
        }
        adapter.submitList(filtered)
        binding.tvEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun showBookingActions(booking: FittingBooking) {
        val actions = mutableListOf<String>()
        when (booking.status) {
            "Pending"   -> { actions += "Confirm"; actions += "Cancel" }
            "Confirmed" -> { actions += "Complete"; actions += "Complete Without Lease"; actions += "Cancel"; actions += "Reschedule" }
            "Completed" -> { if (!booking.leaseStarted) actions += "Proceed to Lease" }
        }
        actions += "Resend Email"

        AlertDialog.Builder(requireContext())
            .setTitle("${booking.bookingId}\n${booking.customerName}")
            .setMessage("${booking.itemName} | ${booking.fittingDate} ${booking.fittingTime}\nStatus: ${booking.status}")
            .setItems(actions.toTypedArray()) { _, idx ->
                when (actions[idx]) {
                    "Confirm"                -> updateStatus(booking.bookingId, "Confirmed")
                    "Cancel"                 -> updateStatus(booking.bookingId, "Cancelled")
                    "Complete"               -> showFittingToLeaseDialog(booking)
                    "Complete Without Lease" -> confirmCompleteNoLease(booking)
                    "Proceed to Lease"       -> showFittingToLeaseDialog(booking)
                    "Reschedule"             -> showRescheduleDialog(booking)
                    "Resend Email"           -> resendEmail(booking.bookingId)
                }
            }.show()
    }

    private fun updateStatus(bookingId: String, status: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.updateFittingStatus(ApiClient.bearerToken(), bookingId, status)
                toast("Status updated to $status")
                loadBookings()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Failed: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun confirmCompleteNoLease(booking: FittingBooking) {
        AlertDialog.Builder(requireContext())
            .setTitle("Complete Without Lease")
            .setMessage("Mark this fitting as completed without converting to a lease booking?\n\nCustomer: ${booking.customerName}\nItem: ${booking.itemName}")
            .setPositiveButton("Complete") { _, _ ->
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.completeFittingNoLease(ApiClient.bearerToken(), booking.bookingId)
                        toast("Fitting completed (no lease)")
                        loadBookings()
                    } catch (e: HttpException) {
                        if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                        else toast("Failed: ${e.message()}")
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ── Fitting → Lease Dialog ────────────────────────────────────────────────
    private fun showFittingToLeaseDialog(booking: FittingBooking) {
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
        val tvTotal       = view.findViewById<TextView>(R.id.ftlTotal)
        val etNotes       = view.findViewById<EditText>(R.id.etFtlNotes)

        // Find item price from loaded items list
        val item     = allItems.firstOrNull { it.name.equals(booking.itemName, ignoreCase = true) }
        val itemId   = item?.id ?: ""
        val dailyRate = item?.price ?: 0.0

        tvCustName.text    = booking.customerName
        tvItemName.text    = booking.itemName
        tvFittingInfo.text = "Fitting: ${booking.fittingDate} at ${booking.fittingTime}"
        tvDailyRate.text   = "₱${String.format("%.2f", dailyRate)} / day"

        var pickupDate = ""
        var returnDate = ""
        var availResult: Boolean? = null
        val availHandler = Handler(Looper.getMainLooper())

        fun recalcPrice() {
            if (pickupDate.isEmpty() || returnDate.isEmpty()) {
                priceSummary.visibility = View.GONE
                return
            }
            try {
                val start = parseDate(pickupDate)
                val end   = parseDate(returnDate)
                if (end.before(start)) {
                    tvDateError.text = "Return date must be after pickup date"
                    tvDateError.visibility = View.VISIBLE
                    priceSummary.visibility = View.GONE
                    return
                }
                tvDateError.visibility = View.GONE
                val days = ((end.time - start.time) / 86_400_000L + 1).toInt()
                val total = dailyRate * days
                tvDaysCalc.text  = "$days day${if (days != 1) "s" else ""} × ₱${String.format("%.2f", dailyRate)}"
                tvSubtotal.text  = "₱${String.format("%.2f", total)}"
                tvTotal.text     = "₱${String.format("%.2f", total)}"
                priceSummary.visibility = View.VISIBLE
            } catch (_: Exception) {
                priceSummary.visibility = View.GONE
            }
        }

        fun checkAvailability() {
            if (pickupDate.isEmpty() || returnDate.isEmpty() || itemId.isEmpty()) return
            availHandler.removeCallbacksAndMessages(null)
            availHandler.postDelayed({
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        tvAvail.visibility = View.VISIBLE
                        tvAvail.text = "Checking availability…"
                        tvAvail.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.gray_100))
                        tvAvail.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle))
                        val resp = ApiClient.adminApi.checkDirectAvailability(
                            ApiClient.bearerToken(), itemId, pickupDate, returnDate
                        )
                        availResult = resp.available
                        tvAvail.text = if (resp.available) "✓ Item is available for these dates"
                                       else "✗ Item is not available for the selected dates"
                        tvAvail.setBackgroundColor(ContextCompat.getColor(requireContext(),
                            if (resp.available) R.color.status_confirmed_bg else R.color.status_cancelled_bg))
                        tvAvail.setTextColor(ContextCompat.getColor(requireContext(),
                            if (resp.available) R.color.status_confirmed_text else R.color.status_cancelled_text))
                    } catch (_: Exception) { tvAvail.visibility = View.GONE }
                }
            }, 500)
        }

        // Pickup date — custom calendar matching web DirectDatePicker
        etPickup.setOnClickListener {
            val today = CalendarPickerDialog.todayStr()
            CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                this.itemId          = itemId
                minDate              = today
                currentValue         = pickupDate
                onDateSelected       = { date ->
                    pickupDate = date
                    etPickup.setText(date)
                    if (returnDate.isNotEmpty() && returnDate < pickupDate) {
                        returnDate = ""; etReturn.setText("")
                    }
                    recalcPrice(); checkAvailability()
                }
            }.show(childFragmentManager, "ftl_pickup_cal")
        }

        // Return date — custom calendar matching web DirectDatePicker
        etReturn.setOnClickListener {
            val today = CalendarPickerDialog.todayStr()
            val minD = pickupDate.ifEmpty { today }
            CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                this.itemId          = itemId
                minDate              = minD
                currentValue         = returnDate
                onDateSelected       = { date ->
                    returnDate = date
                    etReturn.setText(date)
                    recalcPrice(); checkAvailability()
                }
            }.show(childFragmentManager, "ftl_return_cal")
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Proceed to Rental")
            .setView(view)
            .setPositiveButton("Confirm Rental") { _, _ ->
                if (pickupDate.isEmpty() || returnDate.isEmpty()) {
                    toast("Select both pickup and return dates"); return@setPositiveButton
                }
                if (availResult == false) {
                    toast("Item is not available for the selected dates"); return@setPositiveButton
                }
                val days  = ((parseDate(returnDate).time - parseDate(pickupDate).time) / 86_400_000L + 1).toInt().coerceAtLeast(1)
                val total = dailyRate * days
                val notes = etNotes.text.toString().trim().ifEmpty { "Post-fitting rental for ${booking.itemName}" }

                val req = CreateDirectBookingRequest(
                    customerEmail  = booking.customerEmail,
                    customerName   = booking.customerName,
                    customerPhone  = booking.customerPhone,
                    itemId         = itemId,
                    itemName       = booking.itemName,
                    startDate      = pickupDate,
                    endDate        = returnDate,
                    basePrice      = total,
                    discountAmount = 0.0,
                    finalPrice     = total,
                    notes          = notes,
                    preferredSize  = booking.preferredSize
                )
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        // First mark fitting as Completed if still Confirmed
                        if (booking.status == "Confirmed") {
                            ApiClient.adminApi.updateFittingStatus(ApiClient.bearerToken(), booking.bookingId, "Completed")
                        }
                        ApiClient.adminApi.createDirectBooking(ApiClient.bearerToken(), req)
                        toast("Rental booking created successfully!")
                        loadBookings()
                    } catch (e: HttpException) {
                        if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                        else toast("Error: ${e.message()}")
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun parseDate(s: String): Date {
        val parts = s.split("-")
        val cal   = Calendar.getInstance()
        cal.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt(), 0, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.time
    }

    private fun showRescheduleDialog(booking: FittingBooking) {
        val view   = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_reschedule, null)
        val etDate = view.findViewById<EditText>(R.id.etDate)
        val etTime = view.findViewById<EditText>(R.id.etTime)
        etDate.setText(booking.fittingDate)
        etTime.setText(booking.fittingTime)

        etDate.setOnClickListener {
            val cal = Calendar.getInstance()
            DatePickerDialog(requireContext(), { _, y, m, d ->
                etDate.setText("$y-${"%02d".format(m + 1)}-${"%02d".format(d)}")
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
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
                        ApiClient.adminApi.rescheduleFitting(ApiClient.bearerToken(), booking.bookingId, RescheduleRequest(date, time))
                        toast("Rescheduled successfully")
                        loadBookings()
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun resendEmail(bookingId: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.resendFittingEmail(ApiClient.bearerToken(), bookingId)
                toast("Email sent")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
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
