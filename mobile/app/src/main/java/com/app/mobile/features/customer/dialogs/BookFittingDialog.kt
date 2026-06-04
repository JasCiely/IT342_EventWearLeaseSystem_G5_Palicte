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
import com.app.mobile.features.admin.dialogs.TimeSlotPickerDialog
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.*
import com.app.mobile.shared.utils.SessionManager
import kotlinx.coroutines.launch
import retrofit2.HttpException

class BookFittingDialog : DialogFragment() {

    private lateinit var item: InventoryItem
    private var promotions: List<Promotion> = emptyList()

    private var selectedDate = ""
    private var selectedTime = ""
    private var bookingSettings: BookingSettings? = null
    private var timeSlots: List<String> = emptyList()
    private var bookedSlots: List<String> = emptyList()

    private var availableSizes: List<String> = emptyList()
    private var sizeOptions: List<String> = emptyList()
    private var sizeRequired = false

    companion object {
        fun newInstance(item: InventoryItem, promotions: List<Promotion>): BookFittingDialog {
            return BookFittingDialog().also {
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
        inflater.inflate(R.layout.dialog_book_fitting, container, false)

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            (resources.displayMetrics.widthPixels * 0.93).toInt(),
            (resources.displayMetrics.heightPixels * 0.88).toInt()
        )
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvItemName     = view.findViewById<TextView>(R.id.tvItemName)
        val btnPickDate    = view.findViewById<LinearLayout>(R.id.btnPickDate)
        val tvSelectedDate = view.findViewById<TextView>(R.id.tvSelectedDate)
        val btnPickTime    = view.findViewById<LinearLayout>(R.id.btnPickTime)
        val tvSelectedTime = view.findViewById<TextView>(R.id.tvSelectedTime)
        val etFullName     = view.findViewById<EditText>(R.id.etFullName)
        val etEmail        = view.findViewById<EditText>(R.id.etEmail)
        val etPhone        = view.findViewById<EditText>(R.id.etPhone)
        val tvSizeLabel    = view.findViewById<TextView>(R.id.tvSizeLabel)
        val spinnerSize    = view.findViewById<Spinner>(R.id.spinnerSize)
        val tvSingleSize   = view.findViewById<TextView>(R.id.tvSingleSize)
        val etNotes        = view.findViewById<EditText>(R.id.etNotes)
        val btnConfirm     = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnConfirm)

        tvItemName.text = item.name

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
                sizeRequired           = true
                tvSizeLabel.text       = "PREFERRED SIZE *"
                tvSizeLabel.visibility = View.VISIBLE
                tvSingleSize.visibility = View.GONE
                spinnerSize.visibility  = View.VISIBLE
                sizeOptions = listOf("Select size") + availableSizes
                val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, sizeOptions)
                adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                spinnerSize.adapter = adapter
            }
        }

        loadBookingSettings()

        btnPickDate.setOnClickListener {
            val cal = CalendarPickerDialog().apply {
                mode           = CalendarPickerDialog.Mode.FITTING
                itemId         = item.id
                passedSettings = bookingSettings
                currentValue   = selectedDate
                onDateSelected = { date ->
                    selectedDate = date
                    tvSelectedDate.text = date
                    tvSelectedDate.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
                    selectedTime = ""
                    tvSelectedTime.text = "Tap to select time"
                    tvSelectedTime.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle))
                    loadTimeSlotsForDate(date, tvSelectedTime)
                }
            }
            cal.show(childFragmentManager, "cal_fitting")
        }

        btnPickTime.setOnClickListener {
            if (selectedDate.isEmpty()) {
                toast("Please select a date first")
                return@setOnClickListener
            }
            val picker = TimeSlotPickerDialog().apply {
                this.timeSlots    = this@BookFittingDialog.timeSlots
                this.bookedSlots  = this@BookFittingDialog.bookedSlots
                this.currentValue = selectedTime
                onSlotSelected = { slot ->
                    selectedTime = slot
                    tvSelectedTime.text = slot
                    tvSelectedTime.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
                }
            }
            picker.show(childFragmentManager, "time_picker")
        }

        btnConfirm.setOnClickListener {
            if (selectedDate.isEmpty()) { toast("Please select a fitting date"); return@setOnClickListener }
            if (selectedTime.isEmpty()) { toast("Please select a time slot");    return@setOnClickListener }

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

            val size = when {
                availableSizes.isEmpty()  -> null
                availableSizes.size == 1  -> availableSizes[0]
                else -> sizeOptions.getOrNull(spinnerSize.selectedItemPosition)
                    ?.takeIf { it != "Select size" }
            }
            val notes = etNotes.text.toString().trim().ifEmpty { null }

            btnConfirm.isEnabled = false
            btnConfirm.text = "Booking…"

            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    ApiClient.customerApi.bookFitting(
                        ApiClient.bearerToken(),
                        CreateFittingBookingRequest(
                            itemId        = item.id,
                            itemName      = item.name,
                            fittingDate   = selectedDate,
                            fittingTime   = selectedTime,
                            customerName  = name,
                            customerEmail = email,
                            customerPhone = phone.replace(" ", ""),
                            preferredSize = size,
                            notes         = notes
                        )
                    )
                    toast("Fitting booked! Check your email for confirmation.")
                    dismiss()
                    (activity as? DashboardActivity)?.goToMyBookings()
                } catch (e: HttpException) {
                    val bodyMsg = try {
                        val raw = e.response()?.errorBody()?.string()
                        com.google.gson.JsonParser.parseString(raw)
                            .asJsonObject.get("message")?.asString
                    } catch (_: Exception) { null }
                    when (e.code()) {
                        401  -> (activity as? DashboardActivity)?.showSessionExpiredDialog()
                        409  -> toast("This slot is no longer available. Please choose another.")
                        else -> toast(bodyMsg ?: "Booking failed. Please try again.")
                    }
                    btnConfirm.isEnabled = true
                    btnConfirm.text = "Confirm Fitting Booking"
                } catch (_: Exception) {
                    toast("Network error. Please try again.")
                    btnConfirm.isEnabled = true
                    btnConfirm.text = "Confirm Fitting Booking"
                }
            }
        }
    }

    private fun loadBookingSettings() {
        viewLifecycleOwner.lifecycleScope.launch {
            bookingSettings = try {
                ApiClient.customerApi.getBookingSettings()
            } catch (_: Exception) { null }

            timeSlots = CalendarPickerDialog.buildTimeSlots(bookingSettings)
        }
    }

    private fun loadTimeSlotsForDate(date: String, tvTime: TextView) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                bookedSlots = ApiClient.customerApi.getBookedFittingSlots(item.id, date)
            } catch (_: Exception) { bookedSlots = emptyList() }
            tvTime.text = "Tap to select time"
        }
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
}
