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
                // supervisorScope lets each async fail independently — no exception propagation to parent
                supervisorScope {
                    val usersDeferred     = async { ApiClient.adminApi.getUsers(token, size = 1) }
                    val fittingDeferred   = async { ApiClient.adminApi.getFittingBookings(token, size = 1) }
                    val directDeferred    = async { ApiClient.adminApi.getDirectBookings(token, size = 1) }
                    val inventoryDeferred = async { ApiClient.adminApi.getInventoryItems() }
                    val staffDeferred     = async { ApiClient.adminApi.getStaff(token, size = 1) }

                    val usersResult     = runCatching { usersDeferred.await() }
                    val fittingResult   = runCatching { fittingDeferred.await() }
                    val directResult    = runCatching { directDeferred.await() }
                    val inventoryResult = runCatching { inventoryDeferred.await() }
                    val staffResult     = runCatching { staffDeferred.await() }

                    // If any admin call returned 401, the session has expired
                    val expired = listOf(usersResult, fittingResult, directResult, staffResult)
                        .mapNotNull { it.exceptionOrNull() as? HttpException }
                        .any { it.code() == 401 }

                    if (expired) {
                        (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                        return@supervisorScope
                    }

                    val inventory = inventoryResult.getOrNull()

                    if (_binding == null) return@supervisorScope

                    binding.tvStatUsers.text     = usersResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvStatFitting.text   = fittingResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvStatDirect.text    = directResult.getOrNull()?.totalElements?.toString() ?: "--"
                    binding.tvStatInventory.text = inventory?.size?.toString() ?: "--"
                    binding.tvStatAvailable.text = inventory?.count { it.isAvailable }?.toString() ?: "--"
                    binding.tvStatStaff.text     = staffResult.getOrNull()?.totalElements?.toString() ?: "--"
                }
            } catch (_: Exception) {
                // supervisorScope itself only throws if all children fail — already handled above
            }
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
