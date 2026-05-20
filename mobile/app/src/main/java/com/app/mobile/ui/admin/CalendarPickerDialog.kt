package com.app.mobile.ui.admin

import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.ApiClient
import com.app.mobile.R
import com.app.mobile.databinding.DialogCalendarPickerBinding
import com.app.mobile.models.BookingSettings
import com.app.mobile.models.OccupiedDateRange
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * Custom calendar dialog that mirrors the web FittingDatePicker / DirectDatePicker exactly:
 *
 * Visual states (matching web CSS):
 *   past     → gray text #ddd, not clickable
 *   closed   → strikethrough, #ccc text, #f7f4f3 bg, not clickable
 *   full     → red text #ef4444, light-red bg, red dot indicator, not clickable
 *   avail    → dark text #2d2020, clickable (ripple on tap)
 *   selected → burgundy bg #6b2d39, white bold text
 *   today    → burgundy inset border, burgundy bold text (when not selected)
 *
 * Logic (matching web JS exactly):
 *   isWorkingDay  → checks settings.workingDays (0=Sun…6=Sat, default Mon–Fri)
 *   isWorkdayOver → checks current time >= shopCloseTime (when enableTimeRestrictions=true)
 *   isPast        → ds < min || (ds == today && isWorkdayOver)
 *   FITTING isFull → ALL time slots are in booked slots for that day
 *   DIRECT  isFull → date falls within any occupiedRange
 *
 * Slot fetching (FITTING mode): all future working days in the visible month are
 * fetched in parallel when the calendar opens / month changes.
 */
class CalendarPickerDialog : DialogFragment() {

    enum class Mode { FITTING, DIRECT }

    // ── Configuration (set before show()) ────────────────────────────────────
    var mode: Mode = Mode.FITTING
    var itemId: String = ""
    var passedSettings: BookingSettings? = null
    var passedTimeSlots: List<String> = emptyList()
    var passedOccupiedRanges: List<OccupiedDateRange> = emptyList()
    /** Minimum selectable date (YYYY-MM-DD). Defaults to today. */
    var minDate: String = ""
    /** Pre-selected date shown as highlighted when dialog opens. */
    var currentValue: String = ""
    var onDateSelected: ((String) -> Unit)? = null

    // ── Internal state ────────────────────────────────────────────────────────
    private var _binding: DialogCalendarPickerBinding? = null
    private val binding get() = _binding!!

    private var settings: BookingSettings? = null
    private var timeSlots: List<String> = emptyList()
    private var occupiedRanges: List<OccupiedDateRange> = emptyList()

    private var viewYear = 0
    private var viewMonth = 0          // 0-indexed (0=Jan), matches JS convention

    // keyed by "YYYY-MM-DD" → booked slot list
    private val slotCache = mutableMapOf<String, List<String>>()
    // tracks which "${itemId}__${ds}" keys have a fetch in flight
    private val fetchingKeys = mutableSetOf<String>()

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreateDialog(savedInstanceState: Bundle?): android.app.Dialog {
        val d = super.onCreateDialog(savedInstanceState)
        d.window?.requestFeature(Window.FEATURE_NO_TITLE)
        d.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        d.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN)
        return d
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = DialogCalendarPickerBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            (resources.displayMetrics.widthPixels * 0.92).toInt(),
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Apply passed-in values
        settings = passedSettings
        timeSlots = passedTimeSlots
        occupiedRanges = passedOccupiedRanges

        // Initialise view month from minDate (or today)
        val actualToday = todayStr()
        val startRef = minDate.ifEmpty { actualToday }
        val p = startRef.split("-")
        viewYear = p[0].toInt()
        viewMonth = p[1].toInt() - 1

        binding.btnCalPrev.setOnClickListener { navigatePrev() }
        binding.btnCalNext.setOnClickListener { navigateNext() }

        // Load any missing dependencies, then render
        viewLifecycleOwner.lifecycleScope.launch {
            if (settings == null) {
                try {
                    settings = ApiClient.adminApi.getBookingSettings(ApiClient.bearerToken())
                } catch (_: Exception) { }
            }
            if (timeSlots.isEmpty()) {
                timeSlots = buildTimeSlots(settings)
            }
            if (mode == Mode.DIRECT && occupiedRanges.isEmpty() && itemId.isNotEmpty()) {
                try {
                    occupiedRanges = ApiClient.adminApi.getOccupiedDates(
                        ApiClient.bearerToken(), itemId
                    )
                } catch (_: Exception) { }
            }

            renderCalendar()

            if (mode == Mode.FITTING) fetchSlotsForMonth()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    // ── Month navigation ──────────────────────────────────────────────────────

    private fun navigatePrev() {
        val min = minDate.ifEmpty { todayStr() }
        if (lastDayOfPrevMonth(viewYear, viewMonth) < min) return
        val cal = Calendar.getInstance().apply { set(viewYear, viewMonth - 1, 1) }
        viewYear = cal.get(Calendar.YEAR)
        viewMonth = cal.get(Calendar.MONTH)
        renderCalendar()
        if (mode == Mode.FITTING) fetchSlotsForMonth()
    }

    private fun navigateNext() {
        val cal = Calendar.getInstance().apply { set(viewYear, viewMonth + 1, 1) }
        viewYear = cal.get(Calendar.YEAR)
        viewMonth = cal.get(Calendar.MONTH)
        renderCalendar()
        if (mode == Mode.FITTING) fetchSlotsForMonth()
    }

    // ── Calendar rendering ────────────────────────────────────────────────────

    private fun renderCalendar() {
        val b = _binding ?: return
        val ctx = requireContext()
        val actual = todayStr()
        val min = minDate.ifEmpty { actual }

        // Header
        val monthNames = arrayOf(
            "January","February","March","April","May","June",
            "July","August","September","October","November","December"
        )
        b.tvCalMonthYear.text = "${monthNames[viewMonth]} $viewYear"

        // prev button enabled iff last day of prev month >= min
        val prevOk = lastDayOfPrevMonth(viewYear, viewMonth) >= min
        b.btnCalPrev.isEnabled = prevOk
        b.btnCalPrev.alpha = if (prevOk) 1f else 0.3f

        // Compute cell list
        val cal = Calendar.getInstance().apply { set(viewYear, viewMonth, 1) }
        val daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
        val firstDow = cal.get(Calendar.DAY_OF_WEEK) - 1 // 0=Sun … 6=Sat

        val cells = mutableListOf<Int?>()
        repeat(firstDow) { cells.add(null) }
        for (d in 1..daysInMonth) cells.add(d)
        while (cells.size % 7 != 0) cells.add(null)

        val grid = b.llCalGrid
        grid.removeAllViews()

        // Day-of-week header row
        val dowRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dpToPx(20)
            ).apply { bottomMargin = dpToPx(4) }
        }
        listOf("Su","Mo","Tu","We","Th","Fr","Sa").forEach { lbl ->
            dowRow.addView(TextView(ctx).apply {
                text = lbl
                gravity = Gravity.CENTER
                textSize = 9f
                setTextColor(Color.parseColor("#BBBBBB"))
                setTypeface(null, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
            })
        }
        grid.addView(dowRow)

        // Week rows
        cells.chunked(7).forEach { week ->
            val row = LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dpToPx(40)
                ).apply { topMargin = dpToPx(1) }
            }
            week.forEach { day ->
                if (day == null) {
                    row.addView(View(ctx).apply {
                        layoutParams = LinearLayout.LayoutParams(
                            0, LinearLayout.LayoutParams.MATCH_PARENT, 1f
                        )
                    })
                } else {
                    val mm = (viewMonth + 1).toString().padStart(2, '0')
                    val dd = day.toString().padStart(2, '0')
                    val ds = "$viewYear-$mm-$dd"
                    row.addView(makeDayCell(ctx, day, ds, min, actual))
                }
            }
            grid.addView(row)
        }

        // Legend
        renderLegend(ctx)
    }

    private fun makeDayCell(
        ctx: android.content.Context,
        day: Int,
        ds: String,
        min: String,
        actualToday: String
    ): View {
        // ── State logic — mirrors web JS exactly ──────────────────────────────
        val isPast = ds < min || (ds == actualToday && isWorkdayOver(settings))
        val isNonWork = !isWorkingDay(ds, settings)
        val isFull: Boolean
        val showDot: Boolean
        when (mode) {
            Mode.FITTING -> {
                val slots = slotCache[ds]
                // fully booked = all time slots are in the booked list for that day
                isFull = !isPast && !isNonWork && timeSlots.isNotEmpty() &&
                    slots != null && timeSlots.all { it in slots }
                showDot = isFull
            }
            Mode.DIRECT -> {
                // Non-working-day check intentionally omitted: a date that falls
                // inside an existing booking range must show red regardless of
                // shop schedule (direct leases span all calendar days).
                val blocked = !isPast && isDateBlocked(ds)
                isFull = blocked
                showDot = blocked
            }
        }
        val isSelected = ds == currentValue
        val isToday = ds == actualToday
        val clickable = !isPast && !isNonWork && !isFull

        // ── View construction ─────────────────────────────────────────────────
        val cell = FrameLayout(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, 1f
            ).apply { setMargins(1, 0, 1, 0) }
        }

        val tvDay = TextView(ctx).apply {
            text = day.toString()
            gravity = Gravity.CENTER
            textSize = 12f
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        fun roundedBg(fill: Int, strokeColor: Int = Color.TRANSPARENT, strokePx: Int = 0) =
            GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dpToPx(8).toFloat()
                setColor(fill)
                if (strokePx > 0) setStroke(strokePx, strokeColor)
            }

        // ── Apply visual state ────────────────────────────────────────────────
        // Order matters: isFull is checked before isNonWork so that a blocked
        // date inside an occupied direct-lease range shows red even when the
        // shop is closed that day (non-working).
        when {
            isSelected -> {
                cell.background = roundedBg(
                    ContextCompat.getColor(ctx, R.color.brand_burgundy)
                )
                tvDay.setTextColor(Color.WHITE)
                tvDay.setTypeface(null, Typeface.BOLD)
            }
            isPast -> {
                tvDay.setTextColor(Color.parseColor("#DDDDDD"))
            }
            isFull -> {
                cell.background = roundedBg(Color.parseColor("#FFF0F0"))
                tvDay.setTextColor(Color.parseColor("#EF4444"))
            }
            isNonWork -> {
                cell.background = roundedBg(Color.parseColor("#F7F4F3"))
                tvDay.setTextColor(Color.parseColor("#CCCCCC"))
                tvDay.paintFlags = tvDay.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
            }
            isToday -> {
                // today border ring + burgundy text (web: inset 0 0 0 1.5px #6b2d39)
                cell.background = roundedBg(
                    Color.TRANSPARENT,
                    ContextCompat.getColor(ctx, R.color.brand_burgundy),
                    dpToPx(2)
                )
                tvDay.setTextColor(ContextCompat.getColor(ctx, R.color.brand_burgundy))
                tvDay.setTypeface(null, Typeface.BOLD)
            }
            else -> {
                tvDay.setTextColor(Color.parseColor("#2D2020"))
            }
        }

        // ── Ripple for clickable cells ────────────────────────────────────────
        if (clickable) {
            cell.isClickable = true
            cell.isFocusable = true
            val rippleAttrs = intArrayOf(android.R.attr.selectableItemBackgroundBorderless)
            val ta = ctx.obtainStyledAttributes(rippleAttrs)
            cell.foreground = ta.getDrawable(0)
            ta.recycle()
            cell.setOnClickListener {
                currentValue = ds
                onDateSelected?.invoke(ds)
                dismiss()
            }
        }

        cell.addView(tvDay)

        // ── Red dot indicator for fully-booked / blocked dates ────────────────
        if (showDot) {
            val dotPx = dpToPx(4)
            cell.addView(View(ctx).apply {
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#EF4444"))
                }
                layoutParams = FrameLayout.LayoutParams(
                    dotPx, dotPx,
                    Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                ).apply { bottomMargin = dpToPx(2) }
            })
        }

        return cell
    }

    private fun renderLegend(ctx: android.content.Context) {
        val legend = _binding?.llCalLegend ?: return
        legend.removeAllViews()

        val fullLabel = if (mode == Mode.FITTING) "Fully Booked" else "Booked"
        val items = listOf(
            "Available"  to Color.parseColor("#6B2D39"),
            fullLabel    to Color.parseColor("#EF4444"),
            "Closed"     to Color.parseColor("#D1D5DB")
        )
        items.forEach { (label, color) ->
            val item = LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { setMargins(0, 0, dpToPx(12), 0) }
            }
            val dotPx = dpToPx(8)
            item.addView(View(ctx).apply {
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(color)
                }
                layoutParams = LinearLayout.LayoutParams(dotPx, dotPx).apply {
                    marginEnd = dpToPx(4)
                }
            })
            item.addView(TextView(ctx).apply {
                text = label
                textSize = 10f
                setTextColor(Color.parseColor("#999999"))
            })
            legend.addView(item)
        }
    }

    // ── Slot fetching (FITTING mode) ──────────────────────────────────────────

    private fun fetchSlotsForMonth() {
        if (itemId.isEmpty() || timeSlots.isEmpty()) return
        val capturedYear = viewYear
        val capturedMonth = viewMonth
        val today = todayStr()

        val cal = Calendar.getInstance().apply { set(capturedYear, capturedMonth, 1) }
        val daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH)

        val toFetch = (1..daysInMonth).mapNotNull { d ->
            val mm = (capturedMonth + 1).toString().padStart(2, '0')
            val dd = d.toString().padStart(2, '0')
            val ds = "$capturedYear-$mm-$dd"
            if (ds < today) return@mapNotNull null
            if (!isWorkingDay(ds, settings)) return@mapNotNull null
            val key = "${itemId}__${ds}"
            if (slotCache.containsKey(ds)) return@mapNotNull null
            if (fetchingKeys.contains(key)) return@mapNotNull null
            fetchingKeys.add(key)
            ds
        }
        if (toFetch.isEmpty()) return

        viewLifecycleOwner.lifecycleScope.launch {
            // Fetch all days in the visible month in parallel (mirrors web Promise.all)
            val results = toFetch.map { ds ->
                async {
                    try { ds to ApiClient.adminApi.getBookedFittingSlots(itemId, ds) }
                    catch (_: Exception) { ds to emptyList<String>() }
                }
            }.awaitAll()

            results.forEach { (ds, slots) -> slotCache[ds] = slots }

            // Only re-render if still on the same month
            if (_binding != null && viewYear == capturedYear && viewMonth == capturedMonth) {
                renderCalendar()
            }
        }
    }

    // ── Date logic helpers — exact JS equivalents ─────────────────────────────

    /** Returns last day of the month preceding (year, month0) as YYYY-MM-DD. */
    private fun lastDayOfPrevMonth(year: Int, month0: Int): String {
        val cal = Calendar.getInstance().apply { set(year, month0, 1) }
        cal.add(Calendar.DAY_OF_MONTH, -1)
        return "${cal.get(Calendar.YEAR)}-${(cal.get(Calendar.MONTH)+1).toString().padStart(2,'0')}-${cal.get(Calendar.DAY_OF_MONTH).toString().padStart(2,'0')}"
    }

    /**
     * Mirrors web isWorkingDay():
     *   if !settings.enabled → always true
     *   dow 0=Sun,1=Mon,...,6=Sat (same as JS getDay())
     *   default workingDays = [1,2,3,4,5] = Mon–Fri
     */
    private fun isWorkingDay(dateStr: String, s: BookingSettings?): Boolean {
        if (s?.enableTimeRestrictions != true) return true
        val p = dateStr.split("-")
        val cal = Calendar.getInstance().apply {
            set(p[0].toInt(), p[1].toInt() - 1, p[2].toInt(), 0, 0, 0)
            set(Calendar.MILLISECOND, 0)
        }
        // Calendar.DAY_OF_WEEK: 1=Sun … 7=Sat → subtract 1 → 0=Sun … 6=Sat (matches JS)
        val dow = cal.get(Calendar.DAY_OF_WEEK) - 1
        return (s.workingDays).contains(dow)
    }

    /**
     * Mirrors web isWorkdayOver():
     *   if !settings.enabled → false
     *   current time (HH:MM) >= shopCloseTime
     */
    private fun isWorkdayOver(s: BookingSettings?): Boolean {
        if (s?.enableTimeRestrictions != true) return false
        val close = s.shopCloseTime.split(":")
        val closeH = close.getOrNull(0)?.toIntOrNull() ?: 17
        val closeM = close.getOrNull(1)?.toIntOrNull() ?: 0
        val now = Calendar.getInstance()
        val nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        return nowMin >= closeH * 60 + closeM
    }

    /** Mirrors web isDateBlocked(): dateStr in any occupiedRange [startDate, endDate] */
    private fun isDateBlocked(dateStr: String): Boolean =
        occupiedRanges.any { dateStr >= it.startDate && dateStr <= it.endDate }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density + 0.5f).toInt()

    // ── Companion helpers used by callers ─────────────────────────────────────

    companion object {
        /** Returns today as YYYY-MM-DD. */
        fun todayStr(): String {
            val c = Calendar.getInstance()
            return "${c.get(Calendar.YEAR)}-${(c.get(Calendar.MONTH)+1).toString().padStart(2,'0')}-${c.get(Calendar.DAY_OF_MONTH).toString().padStart(2,'0')}"
        }

        /**
         * Mirrors web buildTimeSlots():
         *   slots from shopOpenTime to shopCloseTime with fittingDurationMinutes step.
         *   Default: 09:00–17:00 every 30 min.
         */
        fun buildTimeSlots(s: BookingSettings?): List<String> {
            val open = s?.shopOpenTime ?: "09:00"
            val close = s?.shopCloseTime ?: "17:00"
            val op = open.split(":")
            val cl = close.split(":")
            val openMin = (op.getOrNull(0)?.toIntOrNull() ?: 9) * 60 + (op.getOrNull(1)?.toIntOrNull() ?: 0)
            val closeMin = (cl.getOrNull(0)?.toIntOrNull() ?: 17) * 60 + (cl.getOrNull(1)?.toIntOrNull() ?: 0)
            val step = s?.fittingDurationMinutes?.takeIf { it > 0 } ?: 30
            val slots = mutableListOf<String>()
            var t = openMin
            while (t + step <= closeMin) {
                slots.add("${(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}")
                t += step
            }
            return slots
        }

        /** Format 24h "HH:mm" → 12h "H:mm AM/PM" (matches web min2display). */
        fun slotLabel(slot: String): String {
            val (h, m) = slot.split(":").map { it.toInt() }
            val period = if (h >= 12) "PM" else "AM"
            val h12 = if (h % 12 == 0) 12 else h % 12
            return "$h12:${m.toString().padStart(2,'0')} $period"
        }
    }
}
