package com.app.mobile.ui.admin

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.mobile.ApiClient
import com.app.mobile.AdminDashboardActivity
import com.app.mobile.R
import com.app.mobile.adapters.DirectBookingAdapter
import com.app.mobile.databinding.FragmentDirectBookingsBinding
import com.app.mobile.models.DirectBooking
import com.app.mobile.models.ExtendRequest
import com.app.mobile.sse.SseClient
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.util.*

class DirectBookingsFragment : Fragment(), SseClient.SseListener {

    private var _binding: FragmentDirectBookingsBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: DirectBookingAdapter
    private var allBookings = listOf<DirectBooking>()
    private var searchQuery = ""

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentDirectBookingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = DirectBookingAdapter { booking -> showBookingActions(booking) }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { searchQuery = s.toString(); applyFilter() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

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
        val filtered = if (searchQuery.isEmpty()) allBookings
        else allBookings.filter {
            it.customerName.contains(searchQuery, true) ||
            it.itemName.contains(searchQuery, true) ||
            it.bookingStatus.contains(searchQuery, true)
        }
        adapter.submitList(filtered)
        binding.tvEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun showBookingActions(booking: DirectBooking) {
        val actions = mutableListOf<String>()
        when (booking.bookingStatus) {
            "Pending"      -> { actions += "Confirm"; actions += "Cancel" }
            "Confirmed"    -> { actions += "Mark Picked Up"; actions += "Cancel" }
            "Active Lease" -> { actions += "Mark Returned"; actions += "Extend Lease"; actions += "Undo Pickup" }
        }
        actions += "Resend Email"

        AlertDialog.Builder(requireContext())
            .setTitle("${booking.itemName}\n${booking.customerName}")
            .setMessage("${booking.startDate} → ${booking.endDate} | ₱${String.format("%.2f", booking.finalPrice)}")
            .setItems(actions.toTypedArray()) { _, idx ->
                when (actions[idx]) {
                    "Confirm"        -> updateStatus(booking.id, "Confirmed")
                    "Cancel"         -> updateStatus(booking.id, "Cancelled")
                    "Mark Picked Up" -> markPickup(booking.id)
                    "Mark Returned"  -> markReturn(booking.id)
                    "Undo Pickup"    -> undoPickup(booking.id)
                    "Extend Lease"   -> showExtendDialog(booking)
                    "Resend Email"   -> resendEmail(booking.id)
                }
            }.show()
    }

    private fun updateStatus(bookingId: String, status: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.updateDirectStatus(ApiClient.bearerToken(), bookingId, status)
                toast("Status → $status")
                loadBookings()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Failed: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun markPickup(id: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try { ApiClient.adminApi.markPickup(ApiClient.bearerToken(), id); toast("Marked as picked up"); loadBookings() }
            catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun undoPickup(id: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try { ApiClient.adminApi.undoPickup(ApiClient.bearerToken(), id); toast("Pickup undone"); loadBookings() }
            catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun markReturn(id: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try { ApiClient.adminApi.markReturn(ApiClient.bearerToken(), id); toast("Marked as returned"); loadBookings() }
            catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun showExtendDialog(booking: DirectBooking) {
        val view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_extend, null)
        val etDate = view.findViewById<EditText>(R.id.etNewEndDate)
        etDate.setText(booking.endDate)
        // Use the same custom calendar as the web DirectDatePicker
        etDate.setOnClickListener {
            val minD = if (booking.endDate.isNotEmpty()) booking.endDate else CalendarPickerDialog.todayStr()
            CalendarPickerDialog().apply {
                mode         = CalendarPickerDialog.Mode.DIRECT
                minDate      = minD
                currentValue = etDate.text.toString().ifEmpty { minD }
                onDateSelected = { date -> etDate.setText(date) }
            }.show(childFragmentManager, "extend_cal")
        }
        AlertDialog.Builder(requireContext())
            .setTitle("Extend Lease")
            .setView(view)
            .setPositiveButton("Extend") { _, _ ->
                val newDate = etDate.text.toString().trim()
                if (newDate.isEmpty()) { toast("Enter new end date"); return@setPositiveButton }
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.extendLease(ApiClient.bearerToken(), booking.id, ExtendRequest(newDate))
                        toast("Lease extended to $newDate")
                        loadBookings()
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null).show()
    }

    private fun resendEmail(id: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try { ApiClient.adminApi.resendDirectEmail(ApiClient.bearerToken(), id); toast("Email sent") }
            catch (_: Exception) { toast(getString(R.string.error_network)) }
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
