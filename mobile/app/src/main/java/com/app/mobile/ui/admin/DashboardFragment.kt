package com.app.mobile.ui.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.app.mobile.AdminDashboardActivity
import com.app.mobile.ApiClient
import com.app.mobile.databinding.FragmentDashboardBinding
import com.app.mobile.SessionManager
import com.app.mobile.sse.SseClient
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope
import retrofit2.HttpException

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
        binding.tvWelcome.text = "Welcome, $firstName"
        loadStats()
        SseClient.addListener(this)
    }

    private fun loadStats() {
        val token = ApiClient.bearerToken()
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                supervisorScope {
                    // ── Overview stats ──────────────────────────────────────────
                    val usersDeferred     = async { ApiClient.adminApi.getUsers(token, size = 1) }
                    val fittingDeferred   = async { ApiClient.adminApi.getFittingBookings(token, size = 1) }
                    val directDeferred    = async { ApiClient.adminApi.getDirectBookings(token, size = 1) }
                    val inventoryDeferred = async { ApiClient.adminApi.getInventoryItems() }
                    val staffDeferred     = async { ApiClient.adminApi.getStaff(token, size = 1) }

                    // ── Booking pipeline stats (direct) ─────────────────────────
                    val pendingDirectDeferred  = async { ApiClient.adminApi.getDirectBookings(token, size = 1, status = "Pending") }
                    val approvedDirectDeferred = async { ApiClient.adminApi.getDirectBookings(token, size = 1, status = "Approved") }
                    val activeLeaseDeferred    = async { ApiClient.adminApi.getDirectBookings(token, size = 1, status = "Active Lease") }
                    val returnedDeferred       = async { ApiClient.adminApi.getDirectBookings(token, size = 1, status = "Returned") }
                    val completedDeferred      = async { ApiClient.adminApi.getDirectBookings(token, size = 1, status = "Completed") }

                    // ── Fitting pipeline ────────────────────────────────────────
                    val pendingFittingDeferred   = async { ApiClient.adminApi.getFittingBookings(token, size = 1, status = "Pending") }
                    val confirmedFittingDeferred = async { ApiClient.adminApi.getFittingBookings(token, size = 1, status = "Confirmed") }
                    val doneFittingDeferred      = async { ApiClient.adminApi.getFittingBookings(token, size = 1, status = "Done") }

                    val usersResult     = runCatching { usersDeferred.await() }
                    val fittingResult   = runCatching { fittingDeferred.await() }
                    val directResult    = runCatching { directDeferred.await() }
                    val inventoryResult = runCatching { inventoryDeferred.await() }
                    val staffResult     = runCatching { staffDeferred.await() }

                    val pendingDirectResult  = runCatching { pendingDirectDeferred.await() }
                    val approvedDirectResult = runCatching { approvedDirectDeferred.await() }
                    val activeLeaseResult    = runCatching { activeLeaseDeferred.await() }
                    val returnedResult       = runCatching { returnedDeferred.await() }
                    val completedResult      = runCatching { completedDeferred.await() }

                    val pendingFittingResult   = runCatching { pendingFittingDeferred.await() }
                    val confirmedFittingResult = runCatching { confirmedFittingDeferred.await() }
                    val doneFittingResult      = runCatching { doneFittingDeferred.await() }

                    val expired = listOf(usersResult, fittingResult, directResult, staffResult)
                        .mapNotNull { it.exceptionOrNull() as? HttpException }
                        .any { it.code() == 401 }

                    if (expired) {
                        (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                        return@supervisorScope
                    }

                    if (_binding == null) return@supervisorScope

                    val inventory = inventoryResult.getOrNull()

                    // ── Overview cards ──────────────────────────────────────────
                    binding.tvStatUsers.text     = usersResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvStatFitting.text   = fittingResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvStatDirect.text    = directResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvStatInventory.text = inventory?.size?.toString() ?: "--"
                    binding.tvStatAvailable.text = inventory?.count { it.isAvailable }?.toString() ?: "--"
                    binding.tvStatStaff.text     = staffResult.getOrNull()?.totalElements?.toString() ?: "--"

                    // ── Direct booking pipeline ─────────────────────────────────
                    binding.tvPipelinePending.text   = pendingDirectResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvPipelineApproved.text  = approvedDirectResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvPipelineActive.text    = activeLeaseResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvPipelineReturned.text  = returnedResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvPipelineCompleted.text = completedResult.getOrNull()?.totalElements?.toString() ?: "--"

                    // ── Fitting snapshot ────────────────────────────────────────
                    binding.tvFittingPending.text   = pendingFittingResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvFittingConfirmed.text = confirmedFittingResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvFittingDone.text      = doneFittingResult.getOrNull()?.totalElements?.toString() ?: "--"
                }
            } catch (_: Exception) { }
        }
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
