package com.app.mobile.features.admin.dialogs

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
import com.app.mobile.R
import com.app.mobile.databinding.DialogTimeSlotPickerBinding

class TimeSlotPickerDialog : DialogFragment() {

    var timeSlots: List<String> = emptyList()
    var bookedSlots: List<String> = emptyList()
    var currentValue: String = ""

    var onSlotSelected: ((String) -> Unit)? = null

    private var _binding: DialogTimeSlotPickerBinding? = null
    private val binding get() = _binding!!

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
        _binding = DialogTimeSlotPickerBinding.inflate(inflater, container, false)
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
        binding.btnTspClose.setOnClickListener { dismiss() }
        renderGrid()
        renderLegend()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun renderGrid() {
        val b   = _binding ?: return
        val ctx = requireContext()
        val burgundy = ContextCompat.getColor(ctx, R.color.brand_burgundy)

        fun dpToPx(dp: Int) = (dp * resources.displayMetrics.density + 0.5f).toInt()

        b.llTspGrid.removeAllViews()

        if (timeSlots.isEmpty()) {
            b.llTspGrid.addView(TextView(ctx).apply {
                text = "No time slots configured"
                textSize = 13f
                setTextColor(Color.parseColor("#9CA3AF"))
                gravity = Gravity.CENTER
                setPadding(0, dpToPx(12), 0, dpToPx(12))
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            })
            return
        }

        timeSlots.chunked(3).forEach { rowSlots ->
            val row = LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dpToPx(6) }
            }

            val cells = rowSlots.toMutableList<String?>()
            while (cells.size < 3) cells.add(null)

            cells.forEach { slot ->
                if (slot == null) {
                    row.addView(View(ctx).apply {
                        layoutParams = LinearLayout.LayoutParams(0, 1, 1f)
                    })
                    return@forEach
                }

                val isBooked   = slot in bookedSlots
                val isSelected = slot == currentValue

                val bg = GradientDrawable().apply {
                    shape        = GradientDrawable.RECTANGLE
                    cornerRadius = dpToPx(8).toFloat()
                }

                val chip = TextView(ctx).apply {
                    text      = CalendarPickerDialog.slotLabel(slot)
                    textSize  = 11f
                    gravity   = Gravity.CENTER
                    setPadding(dpToPx(4), dpToPx(10), dpToPx(4), dpToPx(10))
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                        .apply { setMargins(dpToPx(2), 0, dpToPx(2), 0) }

                    when {
                        isBooked -> {
                            bg.setColor(Color.parseColor("#FFF0F0"))
                            bg.setStroke(0, Color.TRANSPARENT)
                            setTextColor(Color.parseColor("#EF4444"))
                            text = "${CalendarPickerDialog.slotLabel(slot)}\nBooked"
                            setTypeface(null, Typeface.NORMAL)
                            isClickable = false
                            isFocusable = false
                        }
                        isSelected -> {
                            bg.setColor(burgundy)
                            bg.setStroke(0, Color.TRANSPARENT)
                            setTextColor(Color.WHITE)
                            setTypeface(null, Typeface.BOLD)
                            isClickable = true
                            isFocusable = true
                            setOnClickListener {
                                onSlotSelected?.invoke(slot)
                                dismiss()
                            }
                        }
                        else -> {
                            bg.setColor(Color.WHITE)
                            bg.setStroke(dpToPx(1), burgundy)
                            setTextColor(Color.parseColor("#2D2020"))
                            setTypeface(null, Typeface.NORMAL)
                            isClickable = true
                            isFocusable = true
                            val rippleAttrs = intArrayOf(android.R.attr.selectableItemBackground)
                            val ta = ctx.obtainStyledAttributes(rippleAttrs)
                            foreground = ta.getDrawable(0)
                            ta.recycle()
                            setOnClickListener {
                                onSlotSelected?.invoke(slot)
                                dismiss()
                            }
                        }
                    }
                    background = bg
                }
                row.addView(chip)
            }
            b.llTspGrid.addView(row)
        }
    }

    private fun renderLegend() {
        val b   = _binding ?: return
        val ctx = requireContext()
        val legend = b.llTspLegend
        legend.removeAllViews()

        fun dpToPx(dp: Int) = (dp * resources.displayMetrics.density + 0.5f).toInt()

        listOf(
            "Available" to ContextCompat.getColor(ctx, R.color.brand_burgundy),
            "Booked"    to Color.parseColor("#EF4444")
        ).forEach { (label, color) ->
            val item = LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity     = Gravity.CENTER_VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { setMargins(0, 0, dpToPx(16), 0) }
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
}
