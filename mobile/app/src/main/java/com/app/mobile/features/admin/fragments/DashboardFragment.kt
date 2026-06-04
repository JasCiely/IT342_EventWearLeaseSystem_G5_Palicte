package com.app.mobile.features.admin.fragments

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.R
import com.app.mobile.databinding.FragmentDashboardBinding
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.DirectBooking
import com.app.mobile.shared.models.FittingBooking
import com.app.mobile.shared.sse.SseClient
import com.app.mobile.shared.utils.SessionManager
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope
import retrofit2.HttpException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DashboardFragment : Fragment(), SseClient.SseListener {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val firstName = SessionManager.getFirstName(requireContext()) ?: "Admin"
        binding.tvWelcome.text = "${getGreeting()}, $firstName"
        binding.tvDate.text = SimpleDateFormat("EEEE, MMMM d, yyyy", Locale.getDefault()).format(Date())

        setupPeopleOverviewClicks()
        loadStats()
        SseClient.addListener(this)
    }

    private fun getGreeting(): String {
        val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        return when {
            hour < 12 -> "Good morning"
            hour < 17 -> "Good afternoon"
            else      -> "Good evening"
        }
    }

    private fun setupPeopleOverviewClicks() {
        val activity = requireActivity() as? AdminDashboardActivity ?: return
        binding.cardPeopleCustomers.setOnClickListener { activity.navigateTo(R.id.nav_more) }
        binding.cardPeopleBookings.setOnClickListener  { activity.navigateTo(R.id.nav_bookings) }
        binding.cardPeopleItems.setOnClickListener     { activity.navigateTo(R.id.nav_inventory) }
    }

    // Mirrors the web's fetchAllPages: fetches first page, then re-fetches at full size if needed.
    private suspend fun fetchAllFittings(token: String): List<FittingBooking> {
        val first = ApiClient.adminApi.getFittingBookings(token, page = 0, size = 500)
        return if (first.totalElements <= first.content.size) first.content
        else ApiClient.adminApi.getFittingBookings(token, page = 0, size = first.totalElements).content
    }

    private suspend fun fetchAllDirects(token: String): List<DirectBooking> {
        val first = ApiClient.adminApi.getDirectBookings(token, page = 0, size = 500)
        return if (first.totalElements <= first.content.size) first.content
        else ApiClient.adminApi.getDirectBookings(token, page = 0, size = first.totalElements).content
    }

    private fun loadStats() {
        val token = ApiClient.bearerToken()
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                supervisorScope {
                    // Fetch everything in parallel — same strategy as the web dashboard
                    val fittingsD   = async { fetchAllFittings(token) }
                    val directsD    = async { fetchAllDirects(token) }
                    val inventoryD  = async { ApiClient.adminApi.getInventoryItems() }
                    val usersD      = async { ApiClient.adminApi.getUsers(token, page = 0, size = 1) }

                    val fittingsR   = runCatching { fittingsD.await() }
                    val directsR    = runCatching { directsD.await() }
                    val inventoryR  = runCatching { inventoryD.await() }
                    val usersR      = runCatching { usersD.await() }

                    // Session expiry check
                    val expired = listOf(fittingsR, directsR, usersR)
                        .mapNotNull { it.exceptionOrNull() as? HttpException }
                        .any { it.code() == 401 }
                    if (expired) {
                        (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                        return@supervisorScope
                    }

                    if (_binding == null) return@supervisorScope

                    val fittings  = fittingsR.getOrDefault(emptyList())
                    val directs   = directsR.getOrDefault(emptyList())
                    val inventory = inventoryR.getOrDefault(emptyList())

                    // ── Compute stats client-side, exactly matching the web ──────────
                    val totalBookings      = fittings.size + directs.size
                    val confirmedFittings  = fittings.count { it.status == "CONFIRMED" }
                    val pendingDirect      = directs.count  { it.bookingStatus == "Pending" }
                    val approvedDirect     = directs.count  { it.bookingStatus == "Approved" }
                    val activeLeases       = directs.count  { it.bookingStatus == "Active Lease" }
                    val activeBookings     = confirmedFittings + pendingDirect + approvedDirect
                    val returnedDirect     = directs.count  { it.bookingStatus == "Returned" }
                    val completedFittings  = fittings.count { it.status == "COMPLETED" }
                    val completedDirect    = directs.count  { it.bookingStatus == "Completed" }
                    val completed          = completedFittings + completedDirect
                    val leaseConverted     = fittings.count { it.status == "LEASE_CONVERTED" }
                    val cancelledFittings  = fittings.count { it.status == "Cancelled" || it.status == "CANCELLED" }
                    val cancelledDirect    = directs.count  { it.bookingStatus == "Cancelled" || it.bookingStatus == "CANCELLED" }
                    val rejectedDirect     = directs.count  { it.bookingStatus == "Rejected" }
                    val cancelledRejected  = cancelledFittings + cancelledDirect + rejectedDirect

                    // Overdue active leases (endDate < today) + today-only pending pickups
                    val sdfDate    = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                    val todayMs    = System.currentTimeMillis()
                    val todayStr   = sdfDate.format(Date())
                    val overdueCount = directs.count { b ->
                        if (b.bookingStatus != "Active Lease") return@count false
                        try { (sdfDate.parse(b.endDate)?.time ?: Long.MAX_VALUE) < todayMs }
                        catch (_: Exception) { false }
                    }
                    // Approved bookings whose lease starts today
                    val pendingPickupsToday = directs.count {
                        it.bookingStatus == "Approved" && it.startDate == todayStr
                    }

                    // ── KPI Cards ────────────────────────────────────────────────────
                    binding.tvKpiTotalBookings.text  = totalBookings.toString()
                    binding.tvKpiActiveBookings.text = activeBookings.toString()
                    binding.tvKpiActiveLeases.text   = activeLeases.toString()
                    binding.tvKpiPendingPickups.text = pendingPickupsToday.toString()
                    binding.tvKpiInventoryItems.text = inventory.size.toString()
                    binding.tvKpiCustomers.text      = usersR.getOrNull()?.totalElements?.toString() ?: "--"

                    // ── Alerts ───────────────────────────────────────────────────────
                    val showAlerts = pendingDirect > 0 || overdueCount > 0
                    binding.layoutAlerts.isVisible        = showAlerts
                    binding.layoutAlertPending.isVisible  = pendingDirect > 0
                    binding.layoutAlertOverdue.isVisible  = overdueCount > 0
                    if (pendingDirect > 0) {
                        binding.tvAlertPendingCount.text = "$pendingDirect${getString(R.string.dashboard_alert_pending_approvals)}"
                    }
                    if (overdueCount > 0) {
                        binding.tvAlertOverdueCount.text = "$overdueCount${getString(R.string.dashboard_alert_overdue)}"
                    }

                    // ── Pipeline ─────────────────────────────────────────────────────
                    binding.tvPipelinePending.text   = pendingDirect.toString()
                    binding.tvPipelineApproved.text  = approvedDirect.toString()
                    binding.tvPipelineActive.text    = activeLeases.toString()
                    binding.tvPipelineReturned.text  = returnedDirect.toString()
                    binding.tvPipelineCompleted.text = completedDirect.toString()

                    // ── Status Summary ───────────────────────────────────────────────
                    fun setProgress(bar: View, count: Int) {
                        bar.scaleX = if (totalBookings > 0) count.toFloat() / totalBookings else 0f
                    }
                    binding.tvCountConfirmedFittings.text  = confirmedFittings.toString()
                    binding.tvCountLeaseConversions.text   = leaseConverted.toString()
                    binding.tvCountPendingApprovals.text   = pendingDirect.toString()
                    binding.tvCountPendingPickups.text     = pendingPickupsToday.toString()
                    binding.tvCountActiveLeases.text       = activeLeases.toString()
                    binding.tvCountCancelledRejected.text  = cancelledRejected.toString()
                    binding.tvCountCompleted.text          = completed.toString()

                    setProgress(binding.progressConfirmedFittings, confirmedFittings)
                    setProgress(binding.progressLeaseConversions,  leaseConverted)
                    setProgress(binding.progressPendingApprovals,  pendingDirect)
                    setProgress(binding.progressPendingPickups,    pendingPickupsToday)
                    setProgress(binding.progressActiveLeases,      activeLeases)
                    setProgress(binding.progressCancelledRejected, cancelledRejected)
                    setProgress(binding.progressCompleted,         completed)

                    // ── People Overview ──────────────────────────────────────────────
                    binding.tvPeopleCustomers.text = usersR.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvPeopleBookings.text  = totalBookings.toString()
                    binding.tvPeopleItems.text     = inventory.size.toString()

                    // ── Fitting Snapshot ─────────────────────────────────────────────
                    binding.tvFittingConfirmed.text  = confirmedFittings.toString()
                    binding.tvFittingCompleted.text  = completedFittings.toString()
                    binding.tvFittingConverted.text  = leaseConverted.toString()
                    binding.tvFittingCancelled.text  = cancelledFittings.toString()

                    // ── Recent Activity — merge ALL bookings, sort, take 8 ───────────
                    data class ActivityRow(
                        val customerName: String, val itemName: String,
                        val type: String, val status: String, val createdAt: String
                    )
                    val sdfIso     = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                    val sdfDisplay = SimpleDateFormat("MMM d", Locale.getDefault())

                    val activities: List<ActivityRow> = (
                        fittings.map { b -> ActivityRow(b.customerName, b.itemName, "Fitting", b.status, b.createdAt) } +
                        directs.map  { b -> ActivityRow(b.customerName, b.itemName, "Direct",  b.bookingStatus, b.createdAt) }
                    ).sortedByDescending {
                        try { sdfIso.parse(it.createdAt)?.time ?: 0L } catch (_: Exception) { 0L }
                    }.take(8)

                    binding.recentActivityContainer.removeAllViews()
                    binding.tvRecentEmpty.isVisible = activities.isEmpty()

                    if (activities.isNotEmpty()) {
                        val inflater = LayoutInflater.from(requireContext())
                        activities.forEachIndexed { index, row ->
                            if (index > 0) {
                                val divider = View(requireContext())
                                divider.layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1)
                                divider.setBackgroundColor(Color.parseColor("#F0EEEC"))
                                binding.recentActivityContainer.addView(divider)
                            }

                            val itemView = inflater.inflate(R.layout.item_recent_activity, binding.recentActivityContainer, false)

                            itemView.findViewById<TextView>(R.id.tvAvatar).text =
                                row.customerName.firstOrNull()?.uppercaseChar()?.toString() ?: "?"
                            itemView.findViewById<TextView>(R.id.tvCustomerName).text = row.customerName
                            itemView.findViewById<TextView>(R.id.tvItemName).text     = row.itemName

                            val tvType = itemView.findViewById<TextView>(R.id.tvType)
                            tvType.text = row.type
                            if (row.type == "Fitting") setPillBg(tvType, "#E0F2FE", "#0369A1")
                            else                        setPillBg(tvType, "#EDE9FE", "#5B21B6")

                            val tvStatus = itemView.findViewById<TextView>(R.id.tvStatus)
                            tvStatus.text = row.status
                            val (sBg, sText) = statusColors(row.status)
                            setPillBg(tvStatus, sBg, sText)

                            val dateStr = try {
                                sdfIso.parse(row.createdAt)?.let { sdfDisplay.format(it) } ?: row.createdAt.take(10)
                            } catch (_: Exception) { row.createdAt.take(10) }
                            itemView.findViewById<TextView>(R.id.tvDate).text = dateStr

                            binding.recentActivityContainer.addView(itemView)
                        }
                    }
                }
            } catch (_: Exception) { }
        }
    }

    private fun setPillBg(view: TextView, bgHex: String, textHex: String) {
        val d = GradientDrawable().apply {
            cornerRadius = 40f
            setColor(Color.parseColor(bgHex))
        }
        view.background = d
        view.setTextColor(Color.parseColor(textHex))
    }

    private fun statusColors(status: String): Pair<String, String> = when (status) {
        "CONFIRMED"       -> "#D1FAE5" to "#065F46"
        "Pending"         -> "#FEF3C7" to "#92400E"
        "Approved"        -> "#D1FAE5" to "#065F46"
        "Active Lease"    -> "#DBEAFE" to "#1E40AF"
        "Returned"        -> "#E0F2FE" to "#0369A1"
        "COMPLETED",
        "Completed"       -> "#EDE9FE" to "#5B21B6"
        "LEASE_CONVERTED" -> "#EDE9FE" to "#5B21B6"
        "Rejected",
        "Cancelled",
        "CANCELLED"       -> "#FEE2E2" to "#991B1B"
        else              -> "#F3F4F6" to "#6B7280"
    }

    override fun onEvent(type: String, data: String) {
        if (type == "BOOKING_UPDATE" || type == "INVENTORY_UPDATE") loadStats()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        SseClient.removeListener(this)
        _binding = null
    }
}
