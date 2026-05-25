package com.app.mobile.features.customer.fragments

import android.graphics.Color
import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.app.mobile.R
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.features.customer.adapters.CustomerDirectBookingAdapter
import com.app.mobile.features.customer.adapters.CustomerFittingBookingAdapter
import com.app.mobile.features.customer.dialogs.DirectBookingDetailBottomSheet
import com.app.mobile.features.customer.dialogs.FittingBookingDetailBottomSheet
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.DirectBooking
import com.app.mobile.shared.models.FittingBooking
import kotlinx.coroutines.launch
import retrofit2.HttpException

class CustomerMyBookingsFragment : Fragment() {

    private lateinit var tabFitting: LinearLayout
    private lateinit var tabDirect: LinearLayout
    private lateinit var tvTabFitting: TextView
    private lateinit var tvTabDirect: TextView
    private lateinit var indicatorFitting: View
    private lateinit var indicatorDirect: View
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var recyclerView: RecyclerView
    private lateinit var layoutEmpty: LinearLayout
    private lateinit var tvEmptySubtext: TextView

    private lateinit var fittingAdapter: CustomerFittingBookingAdapter
    private lateinit var directAdapter: CustomerDirectBookingAdapter

    private var fittingBookings = listOf<FittingBooking>()
    private var directBookings  = listOf<DirectBooking>()
    private var activeTab = "Fitting"

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        inflater.inflate(R.layout.fragment_customer_my_bookings, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        tabFitting       = view.findViewById(R.id.tabFitting)
        tabDirect        = view.findViewById(R.id.tabDirect)
        tvTabFitting     = view.findViewById(R.id.tvTabFitting)
        tvTabDirect      = view.findViewById(R.id.tvTabDirect)
        indicatorFitting = view.findViewById(R.id.indicatorFitting)
        indicatorDirect  = view.findViewById(R.id.indicatorDirect)
        swipeRefresh     = view.findViewById(R.id.swipeRefresh)
        recyclerView     = view.findViewById(R.id.recyclerView)
        layoutEmpty      = view.findViewById(R.id.layoutEmpty)
        tvEmptySubtext   = view.findViewById(R.id.tvEmptySubtext)

        fittingAdapter = CustomerFittingBookingAdapter { booking ->
            val sheet = FittingBookingDetailBottomSheet.newInstance(booking)
            sheet.onCancelled = { loadData() }
            sheet.show(childFragmentManager, "fitting_detail")
        }

        directAdapter = CustomerDirectBookingAdapter { booking ->
            val sheet = DirectBookingDetailBottomSheet.newInstance(booking)
            sheet.onCancelled = { loadData() }
            sheet.show(childFragmentManager, "direct_detail")
        }

        recyclerView.layoutManager = LinearLayoutManager(requireContext())

        tabFitting.setOnClickListener { switchTab("Fitting") }
        tabDirect.setOnClickListener  { switchTab("Direct") }

        swipeRefresh.setColorSchemeColors(ContextCompat.getColor(requireContext(), R.color.brand_burgundy))
        swipeRefresh.setOnRefreshListener { loadData() }

        switchTab("Fitting")
        loadData()
    }

    private fun switchTab(tab: String) {
        activeTab = tab
        val burgundy     = ContextCompat.getColor(requireContext(), R.color.brand_burgundy)
        val subtle       = ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle)
        val transparent  = Color.TRANSPARENT

        tvTabFitting.setTextColor(if (tab == "Fitting") burgundy else subtle)
        tvTabFitting.paint.isFakeBoldText = tab == "Fitting"
        indicatorFitting.setBackgroundColor(if (tab == "Fitting") burgundy else transparent)

        tvTabDirect.setTextColor(if (tab == "Direct") burgundy else subtle)
        tvTabDirect.paint.isFakeBoldText = tab == "Direct"
        indicatorDirect.setBackgroundColor(if (tab == "Direct") burgundy else transparent)

        if (tab == "Fitting") {
            recyclerView.adapter = fittingAdapter
            fittingAdapter.submitList(fittingBookings)
            updateEmpty(fittingBookings.isEmpty(), "No fitting appointments found.\nBook a fitting from the Browse tab!")
        } else {
            recyclerView.adapter = directAdapter
            directAdapter.submitList(directBookings)
            updateEmpty(directBookings.isEmpty(), "No direct rentals found.\nBrowse our collection to get started!")
        }
    }

    private fun loadData() {
        viewLifecycleOwner.lifecycleScope.launch {
            swipeRefresh.isRefreshing = true
            try {
                fittingBookings = ApiClient.customerApi.getMyFittingBookings(ApiClient.bearerToken())
                directBookings  = ApiClient.customerApi.getAllMyDirectBookings(ApiClient.bearerToken())
                switchTab(activeTab)
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? DashboardActivity)?.showSessionExpiredDialog()
                else Toast.makeText(requireContext(), "Error loading bookings", Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {
                Toast.makeText(requireContext(), "Network error. Check connection.", Toast.LENGTH_SHORT).show()
            }
            swipeRefresh.isRefreshing = false
        }
    }

    private fun updateEmpty(isEmpty: Boolean, message: String) {
        layoutEmpty.visibility  = if (isEmpty) View.VISIBLE else View.GONE
        tvEmptySubtext.text     = message
    }
}
