package com.app.mobile.ui.admin

import android.app.Dialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.ApiClient
import com.app.mobile.R
import com.app.mobile.databinding.DialogCreateBookingBinding
import com.app.mobile.models.*
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.util.*

class CreateBookingDialogFragment : DialogFragment() {

    var onSuccess: (() -> Unit)? = null

    private var _binding: DialogCreateBookingBinding? = null
    private val binding get() = _binding!!

    private var currentTab = "fitting"

    // Customer state
    private var selectedCustomer: AdminUser? = null
    private val customerHandler = Handler(Looper.getMainLooper())
    private var customerRunnable: Runnable? = null

    // Item state
    private var allItems         = listOf<InventoryItem>()
    private var selectedItem: InventoryItem? = null
    private var selectedSize     = ""

    // Settings
    private var bookingSettings: BookingSettings? = null
    private var inventorySettings: InventorySettings? = null

    // Fitting state
    private var fittingDate      = ""
    private var fittingTime      = ""
    private var bookedSlots      = listOf<String>()
    private var isLoadingSlots   = false
    // Time slots built dynamically from BookingSettings (default matches web)
    private var timeSlots        = CalendarPickerDialog.buildTimeSlots(null)

    // Direct state
    private var startDate        = ""
    private var endDate          = ""
    private var availResult: Boolean? = null
    private val availHandler     = Handler(Looper.getMainLooper())
    private var occupiedRanges   = listOf<OccupiedDateRange>()

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = Dialog(requireContext(), R.style.FullScreenDialogStyle)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        return dialog
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = DialogCreateBookingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.cbBtnClose.setOnClickListener { dismiss() }
        binding.cbBtnCancel.setOnClickListener { dismiss() }
        binding.cbBtnSubmit.setOnClickListener { submit() }

        // Tab switching
        binding.tabFitting.setOnClickListener { switchTab("fitting") }
        binding.tabDirect.setOnClickListener  { switchTab("direct") }
        switchTab("fitting")

        // Customer search with debounce
        binding.etCustomerSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                customerRunnable?.let { customerHandler.removeCallbacks(it) }
                val q = s.toString().trim()
                if (q.length < 2) { binding.customerSuggestions.visibility = View.GONE; return }
                val r = Runnable { searchCustomers(q) }
                customerRunnable = r
                customerHandler.postDelayed(r, 300)
            }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        binding.btnChangeCustomer.setOnClickListener {
            selectedCustomer = null
            binding.selectedCustomerChip.visibility = View.GONE
            binding.etCustomerSearch.text.clear()
            binding.etCbName.text.clear()
            binding.etCbEmail.text.clear()
            binding.etCbPhone.text.clear()
        }

        // Item search
        binding.etItemSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { filterItems(s.toString()) }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        // ── Calendar date pickers ──────────────────────────────────────────────

        binding.etFittingDate.setOnClickListener {
            if (selectedItem == null) return@setOnClickListener
            CalendarPickerDialog().apply {
                mode            = CalendarPickerDialog.Mode.FITTING
                itemId          = selectedItem?.id ?: ""
                passedSettings  = bookingSettings
                passedTimeSlots = timeSlots
                minDate         = CalendarPickerDialog.todayStr()
                currentValue    = fittingDate
                onDateSelected  = { date ->
                    fittingDate = date
                    binding.etFittingDate.setText(date)
                    fittingTime = ""
                    bookedSlots = emptyList()
                    updateTimeField()
                    if (selectedItem != null) loadBookedSlots()
                }
            }.show(childFragmentManager, "fitting_cal")
        }

        binding.etFittingTime.setOnClickListener {
            if (fittingDate.isEmpty()) return@setOnClickListener
            TimeSlotPickerDialog().apply {
                timeSlots    = this@CreateBookingDialogFragment.timeSlots
                bookedSlots  = this@CreateBookingDialogFragment.bookedSlots
                currentValue = fittingTime
                onSlotSelected = { slot ->
                    fittingTime = slot
                    updateTimeField()
                }
            }.show(childFragmentManager, "time_slot_picker")
        }

        binding.etStartDate.setOnClickListener {
            if (selectedItem == null) return@setOnClickListener
            CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                itemId               = selectedItem?.id ?: ""
                passedSettings       = bookingSettings
                passedOccupiedRanges = occupiedRanges
                minDate              = CalendarPickerDialog.todayStr()
                currentValue         = startDate
                onDateSelected       = { date ->
                    startDate = date
                    binding.etStartDate.setText(date)
                    if (endDate.isNotEmpty() && endDate < startDate) {
                        endDate = ""
                        binding.etEndDate.setText("")
                    }
                    recalcDirect()
                    triggerAvailCheck()
                }
            }.show(childFragmentManager, "start_cal")
        }

        binding.etEndDate.setOnClickListener {
            if (selectedItem == null || startDate.isEmpty()) return@setOnClickListener
            CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                itemId               = selectedItem?.id ?: ""
                passedSettings       = bookingSettings
                passedOccupiedRanges = occupiedRanges
                minDate              = startDate.ifEmpty { CalendarPickerDialog.todayStr() }
                currentValue         = endDate
                onDateSelected       = { date ->
                    endDate = date
                    binding.etEndDate.setText(date)
                    recalcDirect()
                    triggerAvailCheck()
                }
            }.show(childFragmentManager, "end_cal")
        }

        loadItems()
        loadSettings()
    }

    private fun switchTab(tab: String) {
        currentTab = tab
        val burgundy = ContextCompat.getColor(requireContext(), R.color.brand_burgundy)
        val subtitle = ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle)

        val surface = ContextCompat.getColor(requireContext(), R.color.brand_surface)
        if (tab == "fitting") {
            binding.tabFitting.setTextColor(burgundy)
            binding.tabFitting.setTypeface(null, android.graphics.Typeface.BOLD)
            binding.tabDirect.setTextColor(subtitle)
            binding.tabDirect.setTypeface(null, android.graphics.Typeface.NORMAL)
            binding.cbTabIndicatorLeft.setBackgroundColor(burgundy)
            binding.cbTabIndicatorRight.setBackgroundColor(surface)
            binding.sectionFitting.visibility = View.VISIBLE
            binding.sectionDirect.visibility  = View.GONE
            binding.cbBtnSubmit.text = "Create Fitting Booking"
        } else {
            binding.tabFitting.setTextColor(subtitle)
            binding.tabFitting.setTypeface(null, android.graphics.Typeface.NORMAL)
            binding.tabDirect.setTextColor(burgundy)
            binding.tabDirect.setTypeface(null, android.graphics.Typeface.BOLD)
            binding.cbTabIndicatorLeft.setBackgroundColor(surface)
            binding.cbTabIndicatorRight.setBackgroundColor(burgundy)
            binding.sectionFitting.visibility = View.GONE
            binding.sectionDirect.visibility  = View.VISIBLE
            binding.cbBtnSubmit.text = "Create Rental Booking"
            if (selectedItem != null && occupiedRanges.isEmpty()) loadOccupiedRanges()
        }
        clearError()
    }

    // ── Settings loading ──────────────────────────────────────────────────────

    private fun loadSettings() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                bookingSettings = ApiClient.adminApi.getBookingSettings(ApiClient.bearerToken())
                timeSlots = CalendarPickerDialog.buildTimeSlots(bookingSettings)
                updateTimeField()
            } catch (_: Exception) {}
            try {
                inventorySettings = ApiClient.adminApi.getInventorySettings(ApiClient.bearerToken())
                if (startDate.isNotEmpty() && endDate.isNotEmpty()) recalcDirect()
            } catch (_: Exception) {}
        }
    }

    // ── Item loading ──────────────────────────────────────────────────────────

    private fun loadItems() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                allItems = ApiClient.adminApi.getInventoryItems()
                    .filter { it.status.equals("Available", ignoreCase = true) }
            } catch (_: Exception) {}
        }
    }

    private fun filterItems(query: String) {
        val suggestions = binding.itemSuggestions
        suggestions.removeAllViews()
        if (query.length < 2) { suggestions.visibility = View.GONE; return }
        val matches = allItems.filter { it.name.contains(query, ignoreCase = true) }.take(6)
        if (matches.isEmpty()) { suggestions.visibility = View.GONE; return }
        matches.forEach { item ->
            val row = createSuggestionRow(
                primary   = item.name,
                secondary = "₱${String.format("%.2f", item.price)}/day · ${item.category}"
            ) {
                selectItem(item)
                suggestions.visibility = View.GONE
            }
            suggestions.addView(row)
        }
        suggestions.visibility = View.VISIBLE
    }

    private fun selectItem(item: InventoryItem) {
        selectedItem = item
        binding.etItemSearch.setText(item.name)
        binding.etItemSearch.setSelection(item.name.length)

        val sizes = item.sizes?.filter { it.isNotEmpty() } ?: emptyList()
        if (sizes.size > 1) {
            val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, listOf("Select size…") + sizes)
            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            binding.cbSizeSpinner.adapter = adapter
            binding.cbSizeSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                    selectedSize = if (pos == 0) "" else sizes[pos - 1]
                }
                override fun onNothingSelected(p: AdapterView<*>?) {}
            }
            binding.cbSizeLabel.visibility   = View.VISIBLE
            binding.cbSizeSpinner.visibility = View.VISIBLE
        } else if (sizes.size == 1) {
            selectedSize = sizes[0]
            binding.cbSizeLabel.visibility   = View.GONE
            binding.cbSizeSpinner.visibility = View.GONE
        } else {
            selectedSize = ""
            binding.cbSizeLabel.visibility   = View.GONE
            binding.cbSizeSpinner.visibility = View.GONE
        }

        // Reset dates and availability when item changes
        fittingDate = ""; fittingTime = ""; bookedSlots = emptyList()
        binding.etFittingDate.setText("")
        startDate = ""; endDate = ""
        binding.etStartDate.setText(""); binding.etEndDate.setText("")
        binding.cbAvailability.visibility = View.GONE
        binding.cbPriceSummary.visibility = View.GONE
        occupiedRanges = listOf()
        updateTimeField()

        loadOccupiedRanges()
        if (currentTab == "direct") triggerAvailCheck()
    }

    // ── Occupied ranges (Direct mode) ─────────────────────────────────────────

    private fun loadOccupiedRanges() {
        val id = selectedItem?.id ?: return
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                occupiedRanges = ApiClient.adminApi.getOccupiedDates(ApiClient.bearerToken(), id)
            } catch (_: Exception) {}
        }
    }

    // ── Customer search ───────────────────────────────────────────────────────

    private fun searchCustomers(query: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val resp = ApiClient.adminApi.getUsers(ApiClient.bearerToken(), page = 0, size = 5, search = query, status = "active")
                val suggestions = binding.customerSuggestions
                suggestions.removeAllViews()
                if (resp.content.isEmpty()) { suggestions.visibility = View.GONE; return@launch }
                resp.content.forEach { cust ->
                    val row = createSuggestionRow(
                        primary   = cust.fullName,
                        secondary = "${cust.email}${if (!cust.phone.isNullOrBlank()) " · ${cust.phone}" else ""}"
                    ) {
                        selectedCustomer = cust
                        binding.etCbName.setText(cust.fullName)
                        binding.etCbEmail.setText(cust.email)
                        binding.etCbPhone.setText(cust.phone ?: "")
                        binding.tvSelectedCustomer.text      = cust.fullName
                        binding.tvSelectedCustomerEmail.text = cust.email
                        binding.selectedCustomerChip.visibility = View.VISIBLE
                        binding.etCustomerSearch.text.clear()
                        suggestions.visibility = View.GONE
                    }
                    suggestions.addView(row)
                }
                suggestions.visibility = View.VISIBLE
            } catch (_: Exception) {}
        }
    }

    private fun createSuggestionRow(primary: String, secondary: String, onClick: () -> Unit): View {
        val row = LinearLayout(requireContext()).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(36, 24, 36, 24)
            setBackgroundResource(android.R.drawable.list_selector_background)
            setOnClickListener { onClick() }
        }
        val tvPrimary = TextView(requireContext()).apply {
            text      = primary
            textSize  = 14f
            setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        val tvSecondary = TextView(requireContext()).apply {
            text      = secondary
            textSize  = 12f
            setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle))
        }
        row.addView(tvPrimary)
        row.addView(tvSecondary)
        val divider = View(requireContext()).apply {
            setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.input_stroke))
        }
        row.addView(divider, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1))
        return row
    }

    // ── Fitting slots ─────────────────────────────────────────────────────────

    /** Updates the time-slot trigger field text/hint to reflect current state. */
    private fun updateTimeField() {
        val b = _binding ?: return
        when {
            fittingDate.isEmpty() -> {
                b.etFittingTime.setText("")
                b.etFittingTime.hint = "Select a date first"
                b.etFittingTime.isEnabled = false
            }
            isLoadingSlots -> {
                b.etFittingTime.setText("")
                b.etFittingTime.hint = "Loading slots…"
                b.etFittingTime.isEnabled = false
            }
            fittingTime.isNotEmpty() -> {
                b.etFittingTime.setText(CalendarPickerDialog.slotLabel(fittingTime))
                b.etFittingTime.isEnabled = true
            }
            else -> {
                b.etFittingTime.setText("")
                b.etFittingTime.hint = "Tap to choose a time slot"
                b.etFittingTime.isEnabled = true
            }
        }
    }

    private fun loadBookedSlots() {
        val itemId = selectedItem?.id ?: return
        val date   = fittingDate.ifEmpty { return }
        isLoadingSlots = true
        updateTimeField()
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                bookedSlots = ApiClient.adminApi.getBookedFittingSlots(itemId, date)
            } catch (_: Exception) {
                bookedSlots = emptyList()
            }
            isLoadingSlots = false
            // Clear selected time if it became booked
            if (fittingTime.isNotEmpty() && fittingTime in bookedSlots) fittingTime = ""
            updateTimeField()
        }
    }

    // ── Direct availability + price ───────────────────────────────────────────

    private fun recalcDirect() {
        if (startDate.isEmpty() || endDate.isEmpty()) {
            binding.cbPriceSummary.visibility = View.GONE; return
        }
        try {
            val s    = parseDate(startDate)
            val e    = parseDate(endDate)
            if (e.before(s)) { binding.cbPriceSummary.visibility = View.GONE; return }
            val days  = ((e.time - s.time) / 86_400_000L + 1).toInt()
            val price = selectedItem?.price ?: 0.0
            val base  = price * days

            val inv    = inventorySettings
            val weeks  = days / 7
            val rawDisc  = weeks * (inv?.weeklyDiscount ?: 0).toDouble()
            val discount = minOf(rawDisc, inv?.monthlyDiscountCap?.toDouble() ?: rawDisc)
            val finalPrice = maxOf(0.0, base - discount)

            binding.cbDaysCalc.text = "$days day${if (days != 1) "s" else ""} × ₱${String.format("%.2f", price)}"
            binding.cbPriceVal.text = "₱${String.format("%.2f", base)}"
            if (discount > 0) {
                binding.cbDiscountRow.visibility = View.VISIBLE
                binding.cbDiscountVal.text       = "-₱${String.format("%.2f", discount)}"
            } else {
                binding.cbDiscountRow.visibility = View.GONE
            }
            binding.cbTotal.text = "₱${String.format("%.2f", finalPrice)}"
            binding.cbPriceSummary.visibility = View.VISIBLE
        } catch (_: Exception) { binding.cbPriceSummary.visibility = View.GONE }
    }

    private fun triggerAvailCheck() {
        val itemId = selectedItem?.id ?: return
        if (startDate.isEmpty() || endDate.isEmpty()) {
            binding.cbAvailability.visibility = View.GONE; return
        }
        availHandler.removeCallbacksAndMessages(null)
        availHandler.postDelayed({
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    binding.cbAvailability.text = "Checking availability…"
                    binding.cbAvailability.visibility = View.VISIBLE
                    binding.cbAvailability.setBackgroundColor(
                        ContextCompat.getColor(requireContext(), R.color.gray_100))
                    binding.cbAvailability.setTextColor(
                        ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle))
                    val resp = ApiClient.adminApi.checkDirectAvailability(
                        ApiClient.bearerToken(), itemId, startDate, endDate)
                    availResult = resp.available
                    binding.cbAvailability.text = if (resp.available)
                        "✓ Item is available for these dates"
                    else
                        "✗ Item is not available for the selected dates"
                    binding.cbAvailability.setBackgroundColor(ContextCompat.getColor(requireContext(),
                        if (resp.available) R.color.status_confirmed_bg else R.color.status_cancelled_bg))
                    binding.cbAvailability.setTextColor(ContextCompat.getColor(requireContext(),
                        if (resp.available) R.color.status_confirmed_text else R.color.status_cancelled_text))
                } catch (_: Exception) { binding.cbAvailability.visibility = View.GONE }
            }
        }, 500)
    }

    // ── Validation + Submit ───────────────────────────────────────────────────

    private fun validate(): String? {
        val name  = binding.etCbName.text.toString().trim()
        val email = binding.etCbEmail.text.toString().trim()
        val phone = binding.etCbPhone.text.toString().trim()
        val item  = selectedItem
        if (name.isEmpty())  return "Customer name is required"
        if (email.isEmpty()) return "Customer email is required"
        if (phone.isEmpty()) return "Customer phone is required"
        if (item == null)    return "Please select an item"
        val sizes = item.sizes?.filter { it.isNotEmpty() } ?: emptyList()
        if (sizes.size > 1 && selectedSize.isEmpty()) return "Please select a size for this item"
        if (currentTab == "fitting") {
            if (fittingDate.isEmpty()) return "Please select a fitting date"
            if (fittingTime.isEmpty()) return "Please select a time slot"
            if (fittingTime in bookedSlots) return "Selected time slot is already booked"
        } else {
            if (startDate.isEmpty() || endDate.isEmpty()) return "Please select rental start and end dates"
            if (parseDate(endDate).before(parseDate(startDate))) return "End date must be on or after start date"
            if (availResult == false) return "Item is not available for the selected dates"
        }
        return null
    }

    private fun submit() {
        val err = validate()
        if (err != null) { showError(err); return }
        clearError()
        binding.cbBtnSubmit.isEnabled = false
        binding.cbBtnSubmit.text      = "Creating…"
        val item  = selectedItem!!
        val name  = binding.etCbName.text.toString().trim()
        val email = binding.etCbEmail.text.toString().trim()
        val phone = binding.etCbPhone.text.toString().trim()
        val notes = binding.etCbNotes.text.toString().trim().ifEmpty { null }

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                if (currentTab == "fitting") {
                    val req = CreateFittingBookingRequest(
                        customerEmail  = email,
                        customerName   = name,
                        customerPhone  = phone,
                        itemId         = item.id,
                        itemName       = item.name,
                        fittingDate    = fittingDate,
                        fittingTime    = fittingTime,
                        preferredSize  = selectedSize.ifEmpty { null },
                        notes          = notes
                    )
                    ApiClient.adminApi.createFittingBooking(ApiClient.bearerToken(), req)
                } else {
                    val days      = ((parseDate(endDate).time - parseDate(startDate).time) / 86_400_000L + 1).toInt().coerceAtLeast(1)
                    val base      = (item.price) * days
                    val inv       = inventorySettings
                    val weeks     = days / 7
                    val rawDisc   = weeks * (inv?.weeklyDiscount ?: 0).toDouble()
                    val discount  = minOf(rawDisc, inv?.monthlyDiscountCap?.toDouble() ?: rawDisc)
                    val finalAmt  = maxOf(0.0, base - discount)
                    val req       = CreateDirectBookingRequest(
                        customerEmail  = email,
                        customerName   = name,
                        customerPhone  = phone,
                        itemId         = item.id,
                        itemName       = item.name,
                        startDate      = startDate,
                        endDate        = endDate,
                        basePrice      = base,
                        discountAmount = discount,
                        finalPrice     = finalAmt,
                        notes          = notes,
                        preferredSize  = selectedSize.ifEmpty { null }
                    )
                    ApiClient.adminApi.createDirectBooking(ApiClient.bearerToken(), req)
                }
                onSuccess?.invoke()
                dismiss()
            } catch (e: HttpException) {
                showError("Error ${e.code()}: ${e.message()}")
                resetSubmitButton()
            } catch (_: Exception) {
                showError("Network error. Please try again.")
                resetSubmitButton()
            }
        }
    }

    private fun resetSubmitButton() {
        binding.cbBtnSubmit.isEnabled = true
        binding.cbBtnSubmit.text = if (currentTab == "fitting") "Create Fitting Booking" else "Create Rental Booking"
    }

    private fun showError(msg: String) {
        binding.tvCbError.text       = msg
        binding.tvCbError.visibility = View.VISIBLE
    }
    private fun clearError() { binding.tvCbError.visibility = View.GONE }

    private fun parseDate(s: String): java.util.Date {
        val p   = s.split("-")
        val cal = Calendar.getInstance()
        cal.set(p[0].toInt(), p[1].toInt() - 1, p[2].toInt(), 0, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.time
    }

    override fun onDestroyView() {
        customerHandler.removeCallbacksAndMessages(null)
        availHandler.removeCallbacksAndMessages(null)
        super.onDestroyView()
        _binding = null
    }
}
