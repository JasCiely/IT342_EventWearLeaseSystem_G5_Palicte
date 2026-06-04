package com.app.mobile.features.customer.fragments

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.*
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.app.mobile.R
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.DirectBooking
import com.app.mobile.shared.models.FittingBooking
import com.app.mobile.shared.sse.SseClient
import kotlinx.coroutines.launch
import retrofit2.HttpException

class CustomerNotificationsFragment : Fragment(), SseClient.SseListener {

    private data class NotifItem(
        val type: String,
        val itemName: String,
        val status: String,
        val message: String,
        val dateLabel: String,
        val createdAt: String
    )

    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var notifList: LinearLayout

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        inflater.inflate(R.layout.fragment_customer_notifications, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        swipeRefresh = view.findViewById(R.id.swipeRefresh)
        notifList    = view.findViewById(R.id.notifList)

        swipeRefresh.setColorSchemeColors(ContextCompat.getColor(requireContext(), R.color.brand_burgundy))
        swipeRefresh.setOnRefreshListener { loadData() }

        SseClient.addListener(this)
        loadData()
    }

    override fun onEvent(type: String, data: String) {
        if (type == "BOOKING_UPDATE") loadData()
    }

    private fun loadData() {
        viewLifecycleOwner.lifecycleScope.launch {
            swipeRefresh.isRefreshing = true
            try {
                val fittings = ApiClient.customerApi.getMyFittingBookings(ApiClient.bearerToken())
                val directs  = ApiClient.customerApi.getAllMyDirectBookings(ApiClient.bearerToken())
                buildNotifications(fittings, directs)
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? DashboardActivity)?.showSessionExpiredDialog()
            } catch (_: Exception) {}
            swipeRefresh.isRefreshing = false
        }
    }

    private fun buildNotifications(fittings: List<FittingBooking>, directs: List<DirectBooking>) {
        notifList.removeAllViews()

        if (fittings.isEmpty() && directs.isEmpty()) {
            addEmptyState()
            return
        }

        val items = mutableListOf<NotifItem>()

        fittings.forEach { b ->
            val msg = when (b.status.uppercase()) {
                "PENDING"   -> "Fitting appointment for \"${b.itemName}\" is pending confirmation."
                "CONFIRMED" -> "Your fitting for \"${b.itemName}\" on ${b.fittingDate} is confirmed."
                "COMPLETED" -> "Fitting for \"${b.itemName}\" has been completed."
                "CANCELLED" -> "Your fitting appointment for \"${b.itemName}\" was cancelled."
                else        -> "Fitting update for \"${b.itemName}\": ${b.status}."
            }
            items.add(NotifItem("Fitting", b.itemName, b.status, msg, b.fittingDate, b.createdAt))
        }

        directs.forEach { b ->
            val msg = when (b.bookingStatus.uppercase()) {
                "PENDING"   -> "Rental of \"${b.itemName}\" is pending admin approval."
                "APPROVED"  -> "Rental of \"${b.itemName}\" (${b.startDate}–${b.endDate}) has been approved."
                "ACTIVE"    -> "Your rental of \"${b.itemName}\" is now active. Return by ${b.endDate}."
                "RETURNED"  -> "\"${b.itemName}\" has been returned. Thank you!"
                "COMPLETED" -> "Rental of \"${b.itemName}\" completed. Total: ₱${String.format("%.0f", b.finalPrice)}."
                "CANCELLED" -> "Your rental of \"${b.itemName}\" was cancelled."
                else        -> "Rental update for \"${b.itemName}\": ${b.bookingStatus}."
            }
            items.add(NotifItem("Rental", b.itemName, b.bookingStatus, msg, "${b.startDate}–${b.endDate}", b.createdAt))
        }

        // Newest first across all booking types
        items.sortByDescending { it.createdAt }

        // Tell the activity the user has now seen everything up to this point
        val newest = items.firstOrNull()?.createdAt ?: ""
        (activity as? DashboardActivity)?.onAlertsLoaded(newest)

        items.forEach { addNotifCard(it) }
    }

    private fun addEmptyState() {
        val ctx = requireContext()
        val dp  = resources.displayMetrics.density

        val container = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity     = Gravity.CENTER
            setPadding(0, (72 * dp).toInt(), 0, 0)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val tvIcon = TextView(ctx).apply {
            text      = "🔔"
            textSize  = 38f
            gravity   = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val tvTitle = TextView(ctx).apply {
            text     = "No alerts yet"
            textSize = 15f
            paint.isFakeBoldText = true
            setTextColor(ContextCompat.getColor(ctx, R.color.brand_text_dark))
            gravity  = Gravity.CENTER
            val lp   = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = (10 * dp).toInt()
            layoutParams = lp
        }

        val tvSub = TextView(ctx).apply {
            text     = "Booking activity will appear here"
            textSize = 13f
            setTextColor(ContextCompat.getColor(ctx, R.color.brand_text_subtitle))
            gravity  = Gravity.CENTER
            val lp   = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = (4 * dp).toInt()
            layoutParams = lp
        }

        container.addView(tvIcon)
        container.addView(tvTitle)
        container.addView(tvSub)
        notifList.addView(container)
    }

    private fun addNotifCard(item: NotifItem) {
        val ctx = requireContext()
        val dp  = resources.displayMetrics.density

        val card = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            background  = GradientDrawable().apply {
                shape         = GradientDrawable.RECTANGLE
                setColor(Color.WHITE)
                cornerRadius  = 10 * dp
            }
            elevation   = 2 * dp
            val lp      = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            lp.bottomMargin = (10 * dp).toInt()
            layoutParams = lp
        }

        // Left accent bar — rounded only on the left side
        val accentBar = View(ctx).apply {
            layoutParams = LinearLayout.LayoutParams((5 * dp).toInt(), LinearLayout.LayoutParams.MATCH_PARENT)
            background   = GradientDrawable().apply {
                shape        = GradientDrawable.RECTANGLE
                setColor(Color.parseColor(accentColor(item.status)))
                cornerRadii  = floatArrayOf(10 * dp, 10 * dp, 0f, 0f, 0f, 0f, 10 * dp, 10 * dp)
            }
        }

        val content = LinearLayout(ctx).apply {
            orientation  = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setPadding((12 * dp).toInt(), (12 * dp).toInt(), (12 * dp).toInt(), (12 * dp).toInt())
        }

        // Row 1: type label (left) + status badge (right)
        val row1 = LinearLayout(ctx).apply {
            orientation  = LinearLayout.HORIZONTAL
            gravity      = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val tvType = TextView(ctx).apply {
            text         = item.type.uppercase()
            textSize     = 10f
            letterSpacing = 0.06f
            setTextColor(ContextCompat.getColor(ctx, R.color.brand_text_subtitle))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        row1.addView(tvType)
        row1.addView(makeStatusBadge(ctx, item.status, dp))

        // Item name
        val tvItem = TextView(ctx).apply {
            text         = item.itemName
            textSize     = 14f
            paint.isFakeBoldText = true
            setTextColor(ContextCompat.getColor(ctx, R.color.brand_text_dark))
            val lp       = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = (5 * dp).toInt()
            layoutParams = lp
        }

        // Message
        val tvMsg = TextView(ctx).apply {
            text         = item.message
            textSize     = 12.5f
            setTextColor(ContextCompat.getColor(ctx, R.color.brand_text_subtitle))
            setLineSpacing(0f, 1.35f)
            val lp       = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = (4 * dp).toInt()
            layoutParams = lp
        }

        // Date label (right-aligned, muted)
        val tvDate = TextView(ctx).apply {
            text         = item.dateLabel
            textSize     = 11f
            setTextColor(ContextCompat.getColor(ctx, R.color.input_hint))
            gravity      = Gravity.END
            val lp       = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            lp.topMargin = (6 * dp).toInt()
            layoutParams = lp
        }

        content.addView(row1)
        content.addView(tvItem)
        content.addView(tvMsg)
        content.addView(tvDate)

        card.addView(accentBar)
        card.addView(content)
        notifList.addView(card)
    }

    private fun makeStatusBadge(ctx: android.content.Context, status: String, dp: Float): TextView {
        val (bgHex, fgHex) = when (status.uppercase()) {
            "PENDING"               -> "#FEF3C7" to "#92400E"
            "CONFIRMED", "APPROVED" -> "#D1FAE5" to "#065F46"
            "ACTIVE"                -> "#DBEAFE" to "#1E40AF"
            "COMPLETED", "RETURNED" -> "#EDE9FE" to "#5B21B6"
            "CANCELLED"             -> "#F3F4F6" to "#6B7280"
            else                    -> "#F3F4F6" to "#374151"
        }

        return TextView(ctx).apply {
            text       = status.lowercase().replaceFirstChar { it.uppercase() }
            textSize   = 10f
            setTextColor(Color.parseColor(fgHex))
            background = GradientDrawable().apply {
                shape        = GradientDrawable.RECTANGLE
                setColor(Color.parseColor(bgHex))
                cornerRadius = 4 * dp
            }
            setPadding((6 * dp).toInt(), (2 * dp).toInt(), (6 * dp).toInt(), (3 * dp).toInt())
        }
    }

    private fun accentColor(status: String): String = when (status.uppercase()) {
        "PENDING"               -> "#F59E0B"
        "CONFIRMED", "APPROVED" -> "#10B981"
        "ACTIVE"                -> "#3B82F6"
        "COMPLETED", "RETURNED" -> "#8B5CF6"
        "CANCELLED"             -> "#D1D5DB"
        else                    -> "#6B2D39"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        SseClient.removeListener(this)
    }
}
