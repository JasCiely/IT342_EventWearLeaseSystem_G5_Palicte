package com.app.mobile.features.customer.dialogs

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.R
import com.app.mobile.features.admin.dialogs.CalendarPickerDialog
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.*
import com.app.mobile.shared.utils.SessionManager
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class BookDirectDialog : DialogFragment() {

    private lateinit var item: InventoryItem
    private var promotions: List<Promotion> = emptyList()

    private var selectedStart = ""
    private var selectedEnd   = ""
    private var bookingSettings: BookingSettings? = null
    private var inventorySettings: InventorySettings? = null
    private var occupiedRanges: List<OccupiedDateRange> = emptyList()

    private var availableSizes: List<String> = emptyList()
    private var sizeOptions: List<String> = emptyList()
    private var sizeRequired = false

    companion object {
        fun newInstance(item: InventoryItem, promotions: List<Promotion>): BookDirectDialog {
            return BookDirectDialog().also {
                it.item       = item
                it.promotions = promotions
            }
        }

        private val PHONE_REGEX = Regex("^\\+639\\d{9}$")

        fun isValidPhilippinePhone(phone: String): Boolean =
            PHONE_REGEX.matches(phone.replace(" ", ""))

        /** Formats 10 local digits into +63 XXX XXX XXXX display string. */
        fun formatPhoneDisplay(localDigits: String): String {
            val d = localDigits.take(10)
            val body = when {
                d.length <= 3 -> d
                d.length <= 6 -> "${d.substring(0, 3)} ${d.substring(3)}"
                else          -> "${d.substring(0, 3)} ${d.substring(3, 6)} ${d.substring(6)}"
            }
            return "+63 $body"
        }

        /** Extracts the 10-digit local part from any stored/typed phone string. */
        fun extractLocalDigits(raw: String): String {
            val withoutCountry = if (raw.startsWith("+63")) raw.substring(3) else raw
            val digits = withoutCountry.filter { it.isDigit() }
            return if (digits.startsWith("0")) digits.substring(1).take(10) else digits.take(10)
        }
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): android.app.Dialog {
        val d = super.onCreateDialog(savedInstanceState)
        d.window?.requestFeature(Window.FEATURE_NO_TITLE)
        return d
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        inflater.inflate(R.layout.dialog_book_direct, container, false)

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            (resources.displayMetrics.widthPixels * 0.93).toInt(),
            (resources.displayMetrics.heightPixels * 0.88).toInt()
        )
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvItemName       = view.findViewById<TextView>(R.id.tvItemName)
        val btnPickStart     = view.findViewById<LinearLayout>(R.id.btnPickStart)
        val tvStartDate      = view.findViewById<TextView>(R.id.tvStartDate)
        val btnPickEnd       = view.findViewById<LinearLayout>(R.id.btnPickEnd)
        val tvEndDate        = view.findViewById<TextView>(R.id.tvEndDate)
        val etFullName       = view.findViewById<EditText>(R.id.etFullName)
        val etEmail          = view.findViewById<EditText>(R.id.etEmail)
        val etPhone          = view.findViewById<EditText>(R.id.etPhone)
        val tvSizeLabel      = view.findViewById<TextView>(R.id.tvSizeLabel)
        val spinnerSize      = view.findViewById<Spinner>(R.id.spinnerSize)
        val tvSingleSize     = view.findViewById<TextView>(R.id.tvSingleSize)
        val etNotes          = view.findViewById<EditText>(R.id.etNotes)
        val cardPriceSummary = view.findViewById<LinearLayout>(R.id.cardPriceSummary)
        val tvDuration       = view.findViewById<TextView>(R.id.tvDuration)
        val tvBasePrice      = view.findViewById<TextView>(R.id.tvBasePrice)
        val rowDiscount      = view.findViewById<LinearLayout>(R.id.rowDiscount)
        val tvDiscount       = view.findViewById<TextView>(R.id.tvDiscount)
        val tvTotal          = view.findViewById<TextView>(R.id.tvTotal)
        val btnConfirm       = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnConfirm)

        tvItemName.text = "${item.name} · ₱${String.format("%.2f", item.price)}/day"

        // Pre-fill customer info from session
        val ctx = requireContext()
        val firstName = SessionManager.getFirstName(ctx) ?: ""
        val lastName  = SessionManager.getLastName(ctx) ?: ""
        etFullName.setText("$firstName $lastName".trim())
        etEmail.setText(SessionManager.getEmail(ctx) ?: "")
        val storedPhone = SessionManager.getPhone(ctx) ?: ""
        if (storedPhone.isNotEmpty()) {
            etPhone.setText(formatPhoneDisplay(extractLocalDigits(storedPhone)))
        }

        // Phone auto-formatter: formats to +63 XXX XXX XXXX as user types
        etPhone.addTextChangedListener(object : TextWatcher {
            private var isFormatting = false

            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

            override fun afterTextChanged(s: Editable?) {
                if (isFormatting || s == null) return
                isFormatting = true
                val digits    = extractLocalDigits(s.toString())
                val formatted = formatPhoneDisplay(digits)
                if (s.toString() != formatted) {
                    s.replace(0, s.length, formatted)
                    try { etPhone.setSelection(formatted.length) } catch (_: Exception) {}
                }
                isFormatting = false
            }
        })

        // Size display: 0 sizes → hidden, 1 size → read-only text, 2+ sizes → required spinner
        availableSizes = item.sizes?.filter { it.isNotBlank() } ?: emptyList()
        when {
            availableSizes.isEmpty() -> {
                tvSizeLabel.visibility  = View.GONE
                spinnerSize.visibility  = View.GONE
                tvSingleSize.visibility = View.GONE
            }
            availableSizes.size == 1 -> {
                tvSizeLabel.text        = "SIZE"
                tvSizeLabel.visibility  = View.VISIBLE
                spinnerSize.visibility  = View.GONE
                tvSingleSize.text       = availableSizes[0]
                tvSingleSize.visibility = View.VISIBLE
            }
            else -> {
                sizeRequired            = true
                tvSizeLabel.text        = "PREFERRED SIZE *"
                tvSizeLabel.visibility  = View.VISIBLE
                tvSingleSize.visibility = View.GONE
                spinnerSize.visibility  = View.VISIBLE
                sizeOptions = listOf("Select size") + availableSizes
                val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, sizeOptions)
                adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                spinnerSize.adapter = adapter
            }
        }

        loadSettings()

        fun updatePriceSummary() {
            if (selectedStart.isEmpty() || selectedEnd.isEmpty()) {
                cardPriceSummary.visibility = View.GONE
                return
            }
            try {
                val sdf   = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                val start = sdf.parse(selectedStart)!!
                val end   = sdf.parse(selectedEnd)!!
                val days  = (((end.time - start.time) / 86_400_000L).toInt() + 1).coerceAtLeast(1)
                val base  = item.price * days

                val minDays = inventorySettings?.minLeaseDays ?: 2
                if (days < minDays) {
                    cardPriceSummary.visibility = View.GONE
                    toast("Minimum lease is $minDays days")
                    return
                }

                val weeklyDisc  = if (days >= 7) (inventorySettings?.weeklyDiscount ?: 0).toDouble() else 0.0
                val monthlyDisc = if (days >= 30) (inventorySettings?.monthlyDiscountCap ?: 0).toDouble() else 0.0
                val discount    = weeklyDisc + monthlyDisc

                tvDuration.text  = "$days day${if (days != 1) "s" else ""}"
                tvBasePrice.text = "₱${String.format("%.2f", base)}"

                if (discount > 0) {
                    rowDiscount.visibility = View.VISIBLE
                    tvDiscount.text = "-₱${String.format("%.2f", discount)}"
                } else {
                    rowDiscount.visibility = View.GONE
                }

                tvTotal.text = "₱${String.format("%.2f", (base - discount).coerceAtLeast(0.0))}"
                cardPriceSummary.visibility = View.VISIBLE
            } catch (_: Exception) {
                cardPriceSummary.visibility = View.GONE
            }
        }

        btnPickStart.setOnClickListener {
            val cal = CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                itemId               = item.id
                passedSettings       = bookingSettings
                passedOccupiedRanges = occupiedRanges
                minDate              = minLeasingStart()
                currentValue         = selectedStart
                onDateSelected       = { date ->
                    selectedStart = date
                    tvStartDate.text = date
                    tvStartDate.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
                    if (selectedEnd.isNotEmpty() && selectedEnd <= selectedStart) {
                        selectedEnd = ""
                        tvEndDate.text = "Select end date"
                        tvEndDate.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle))
                    }
                    updatePriceSummary()
                }
            }
            cal.show(childFragmentManager, "cal_start")
        }

        btnPickEnd.setOnClickListener {
            if (selectedStart.isEmpty()) {
                toast("Please select a start date first")
                return@setOnClickListener
            }
            val cal = CalendarPickerDialog().apply {
                mode                 = CalendarPickerDialog.Mode.DIRECT
                itemId               = item.id
                passedSettings       = bookingSettings
                passedOccupiedRanges = occupiedRanges
                minDate              = selectedStart
                currentValue         = selectedEnd
                onDateSelected       = { date ->
                    selectedEnd = date
                    tvEndDate.text = date
                    tvEndDate.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
                    updatePriceSummary()
                }
            }
            cal.show(childFragmentManager, "cal_end")
        }

        btnConfirm.setOnClickListener {
            if (selectedStart.isEmpty()) { toast("Please select a start date"); return@setOnClickListener }
            if (selectedEnd.isEmpty())   { toast("Please select an end date");   return@setOnClickListener }

            val advanceDays = inventorySettings?.minLeaseDays ?: 2
            if (selectedStart < minLeasingStart()) {
                toast("Leasing bookings must be made at least $advanceDays days in advance.")
                return@setOnClickListener
            }

            when (classifyDateRange(selectedStart, selectedEnd)) {
                "blocked" -> {
                    toast("Selected dates are not available — another booking is confirmed for those dates.")
                    return@setOnClickListener
                }
                "pending" -> {
                    toast("Note: a pending booking overlaps your selected dates. Your booking may conflict if that booking gets approved.")
                }
            }

            val name  = etFullName.text.toString().trim()
            val email = etEmail.text.toString().trim()
            val phone = etPhone.text.toString().trim()

            if (name.isEmpty())  { toast("Please enter your full name");    return@setOnClickListener }
            if (email.isEmpty()) { toast("Please enter your email");        return@setOnClickListener }
            if (phone.isEmpty() || phone == "+63 ") {
                toast("Please enter your phone number"); return@setOnClickListener
            }
            if (!isValidPhilippinePhone(phone)) {
                toast("Invalid phone number. Use +63 followed by 10 digits (e.g. +639XXXXXXXXX)")
                return@setOnClickListener
            }

            if (sizeRequired && spinnerSize.selectedItemPosition == 0) {
                toast("Please select a size"); return@setOnClickListener
            }

            val minDays = inventorySettings?.minLeaseDays ?: 2
            try {
                val sdf2  = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                val days = (((sdf2.parse(selectedEnd)!!.time - sdf2.parse(selectedStart)!!.time) / 86_400_000L).toInt() + 1)
                if (days < minDays) { toast("Minimum lease is $minDays days"); return@setOnClickListener }
            } catch (_: Exception) {}

            val size = when {
                availableSizes.isEmpty()  -> null
                availableSizes.size == 1  -> availableSizes[0]
                else -> sizeOptions.getOrNull(spinnerSize.selectedItemPosition)
                    ?.takeIf { it != "Select size" }
            }
            val notes = etNotes.text.toString().trim().ifEmpty { null }

            try {
                val sdf3     = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                val start    = sdf3.parse(selectedStart)!!
                val end      = sdf3.parse(selectedEnd)!!
                val days     = (((end.time - start.time) / 86_400_000L).toInt() + 1).coerceAtLeast(1)
                val base     = item.price * days
                val weekDisc = if (days >= 7) (inventorySettings?.weeklyDiscount ?: 0).toDouble() else 0.0
                val monDisc  = if (days >= 30) (inventorySettings?.monthlyDiscountCap ?: 0).toDouble() else 0.0
                val discount = weekDisc + monDisc
                val total    = (base - discount).coerceAtLeast(0.0)

                btnConfirm.isEnabled = false
                btnConfirm.text = "Booking…"

                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.customerApi.createDirectBooking(
                            ApiClient.bearerToken(),
                            CreateDirectBookingRequest(
                                customerEmail   = email,
                                customerName    = name,
                                customerPhone   = phone.replace(" ", ""),
                                inventoryItemId = item.id,
                                itemName        = item.name,
                                startDate       = selectedStart,
                                endDate         = selectedEnd,
                                totalDays       = days,
                                basePrice       = base,
                                discountAmount  = discount,
                                finalPrice      = total,
                                notes           = notes,
                                preferredSize   = size
                            )
                        )
                        toast("Rental booked! Check your email for confirmation.")
                        dismiss()
                        (activity as? DashboardActivity)?.goToMyBookings()
                    } catch (e: HttpException) {
                        when (e.code()) {
                            401  -> (activity as? DashboardActivity)?.showSessionExpiredDialog()
                            409  -> toast("These dates are no longer available.")
                            else -> toast("Booking failed: ${e.message()}")
                        }
                        btnConfirm.isEnabled = true
                        btnConfirm.text = "Confirm Rental Booking"
                    } catch (_: Exception) {
                        toast("Network error. Please try again.")
                        btnConfirm.isEnabled = true
                        btnConfirm.text = "Confirm Rental Booking"
                    }
                }
            } catch (_: Exception) {
                toast("Invalid dates. Please try again.")
            }
        }
    }

    private fun loadSettings() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                bookingSettings   = ApiClient.customerApi.getBookingSettings()
                inventorySettings = ApiClient.customerApi.getInventorySettings(ApiClient.bearerToken())
                occupiedRanges    = ApiClient.customerApi.getOccupiedDates(ApiClient.bearerToken(), item.id)
            } catch (_: Exception) {
                bookingSettings   = null
                inventorySettings = InventorySettings()
            }
        }
    }

    private fun minLeasingStart(): String {
        val advanceDays = inventorySettings?.minLeaseDays ?: 2
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_MONTH, advanceDays)
        return "${cal.get(Calendar.YEAR)}-${(cal.get(Calendar.MONTH)+1).toString().padStart(2,'0')}-${cal.get(Calendar.DAY_OF_MONTH).toString().padStart(2,'0')}"
    }

    private fun classifyDateRange(startDate: String, endDate: String): String {
        if (startDate.isEmpty() || endDate.isEmpty() || occupiedRanges.isEmpty()) return "free"
        var hasPending = false
        for (r in occupiedRanges) {
            if (startDate > r.endDate || endDate < r.startDate) continue
            when (r.status) {
                "Approved", "Confirmed", "Active Lease", "Under Maintenance" -> return "blocked"
                "Pending" -> hasPending = true
                else -> return "blocked"
            }
        }
        return if (hasPending) "pending" else "free"
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
}
