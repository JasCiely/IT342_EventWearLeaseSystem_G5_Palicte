package com.app.mobile.features.customer.fragments

import android.graphics.Color
import android.os.Bundle
import android.view.*
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.app.mobile.R
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.DirectBooking
import com.app.mobile.shared.models.FittingBooking
import kotlinx.coroutines.launch
import retrofit2.HttpException

class CustomerNotificationsFragment : Fragment() {

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

        loadData()
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
        val ctx = requireContext()

        if (fittings.isEmpty() && directs.isEmpty()) {
            addNotifCard("No activity yet", "Your booking notifications will appear here.", "#6B7280", "🔔")
            return
        }

        fittings.sortedByDescending { it.createdAt }.forEach { b ->
            val (icon, msg) = when (b.status.uppercase()) {
                "PENDING"   -> "⏳" to "Fitting appointment for \"${b.itemName}\" is pending confirmation."
                "CONFIRMED" -> "✅" to "Your fitting for \"${b.itemName}\" on ${b.fittingDate} is confirmed!"
                "COMPLETED" -> "🎉" to "Fitting for \"${b.itemName}\" has been completed."
                "CANCELLED" -> "❌" to "Your fitting appointment for \"${b.itemName}\" was cancelled."
                else        -> "📋" to "Fitting update for \"${b.itemName}\": ${b.status}"
            }
            val accentColor = statusAccent(b.status)
            addNotifCard("Fitting · ${b.fittingDate}", msg, accentColor, icon)
        }

        directs.sortedByDescending { it.createdAt }.forEach { b ->
            val (icon, msg) = when (b.bookingStatus.uppercase()) {
                "PENDING"   -> "⏳" to "Rental of \"${b.itemName}\" is pending admin approval."
                "APPROVED"  -> "✅" to "Your rental of \"${b.itemName}\" (${b.startDate}–${b.endDate}) is approved!"
                "ACTIVE"    -> "🚀" to "Your rental of \"${b.itemName}\" is now active. Return by ${b.endDate}."
                "RETURNED"  -> "📦" to "\"${b.itemName}\" has been returned. Thank you!"
                "COMPLETED" -> "🎉" to "Rental of \"${b.itemName}\" completed. Total: ₱${String.format("%.0f", b.finalPrice)}."
                "CANCELLED" -> "❌" to "Your rental of \"${b.itemName}\" was cancelled."
                else        -> "📋" to "Rental update for \"${b.itemName}\": ${b.bookingStatus}"
            }
            val accentColor = statusAccent(b.bookingStatus)
            addNotifCard("Rental · ${b.startDate}–${b.endDate}", msg, accentColor, icon)
        }
    }

    private fun addNotifCard(title: String, message: String, accentHex: String, icon: String) {
        val ctx = requireContext()
        val card = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundResource(R.drawable.bg_card_white)
            elevation = 4f
            setPadding(0, 0, 16, 0)
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.bottomMargin = (10 * resources.displayMetrics.density).toInt() }
            layoutParams = lp
        }

        val accent = View(ctx).apply {
            val lp = LinearLayout.LayoutParams(
                (4 * resources.displayMetrics.density).toInt(),
                LinearLayout.LayoutParams.MATCH_PARENT
            ).also { it.marginEnd = (12 * resources.displayMetrics.density).toInt() }
            layoutParams = lp
            try { setBackgroundColor(Color.parseColor(accentHex)) }
            catch (_: Exception) { setBackgroundColor(Color.parseColor("#6B2D39")) }
        }

        val tvIcon = TextView(ctx).apply {
            text = icon
            textSize = 22f
            setPadding(0, (14 * resources.displayMetrics.density).toInt(), (8 * resources.displayMetrics.density).toInt(), (14 * resources.displayMetrics.density).toInt())
        }

        val content = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setPadding(0, (14 * resources.displayMetrics.density).toInt(), 0, (14 * resources.displayMetrics.density).toInt())
        }

        val tvTitle = TextView(ctx).apply {
            text = title
            textSize = 12f
            setTextColor(ContextCompat.getColor(ctx, R.color.brand_text_subtitle))
            paint.isFakeBoldText = true
        }
        val tvMsg = TextView(ctx).apply {
            text = message
            textSize = 13f
            setTextColor(ContextCompat.getColor(ctx, R.color.brand_text_dark))
            setPadding(0, (2 * resources.displayMetrics.density).toInt(), 0, 0)
        }

        content.addView(tvTitle)
        content.addView(tvMsg)
        card.addView(accent)
        card.addView(tvIcon)
        card.addView(content)
        notifList.addView(card)
    }

    private fun statusAccent(status: String): String = when (status.uppercase()) {
        "PENDING"   -> "#F59E0B"
        "CONFIRMED", "APPROVED" -> "#3B82F6"
        "ACTIVE"    -> "#10B981"
        "COMPLETED", "RETURNED" -> "#8B5CF6"
        "CANCELLED" -> "#9CA3AF"
        else        -> "#6B2D39"
    }
}
