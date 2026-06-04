package com.app.mobile.features.customer.fragments

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.app.mobile.R
import com.app.mobile.features.customer.activities.DashboardActivity
import com.app.mobile.features.customer.adapters.CustomerInventoryAdapter
import com.app.mobile.features.customer.dialogs.ItemDetailBottomSheet
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.InventoryItem
import com.app.mobile.shared.models.Promotion
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.time.LocalDate

class CustomerBrowseFragment : Fragment() {

    private lateinit var etSearch: EditText
    private lateinit var chipRow: LinearLayout
    private lateinit var tvItemCount: TextView
    private lateinit var tvActiveFilter: TextView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var recyclerView: RecyclerView
    private lateinit var tvEmpty: TextView

    private lateinit var adapter: CustomerInventoryAdapter
    private var allItems   = listOf<InventoryItem>()
    private var promotions = listOf<Promotion>()
    private var searchQuery   = ""
    private var activeCategory = ""

    // Item IDs the current user has active bookings for
    private var bookedFittingItemIds = setOf<String>()
    private var bookedDirectItemIds  = setOf<String>()

    private var categories = listOf("All")

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        inflater.inflate(R.layout.fragment_customer_browse, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        etSearch       = view.findViewById(R.id.etSearch)
        chipRow        = view.findViewById(R.id.chipRow)
        tvItemCount    = view.findViewById(R.id.tvItemCount)
        tvActiveFilter = view.findViewById(R.id.tvActiveFilter)
        swipeRefresh   = view.findViewById(R.id.swipeRefresh)
        recyclerView   = view.findViewById(R.id.recyclerView)
        tvEmpty        = view.findViewById(R.id.tvEmpty)

        adapter = CustomerInventoryAdapter { item ->
            ItemDetailBottomSheet.newInstance(item, promotions)
                .show(childFragmentManager, "item_detail")
        }

        recyclerView.layoutManager = GridLayoutManager(requireContext(), 2)
        recyclerView.adapter = adapter

        etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { searchQuery = s.toString().trim(); applyFilter() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        swipeRefresh.setColorSchemeColors(ContextCompat.getColor(requireContext(), R.color.brand_burgundy))
        swipeRefresh.setOnRefreshListener { loadData() }

        loadData()
    }

    private fun buildCategoryChips() {
        chipRow.removeAllViews()
        val density  = resources.displayMetrics.density
        val burgundy = ContextCompat.getColor(requireContext(), R.color.brand_burgundy)
        val grayBg   = Color.parseColor("#F3F4F6")
        val strokeColor = Color.parseColor("#D1D5DB")

        categories.forEach { cat ->
            val tv = TextView(requireContext()).apply {
                text     = cat
                textSize = 12.5f
                val hPad = (16 * density).toInt()
                val vPad = (8 * density).toInt()
                setPadding(hPad, vPad, hPad, vPad)
                isClickable = true
                isFocusable = true
                val isActive = (cat == "All" && activeCategory.isEmpty()) || cat == activeCategory
                val bg = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = 50f * density
                    setColor(if (isActive) burgundy else grayBg)
                    if (!isActive) setStroke((1 * density).toInt(), strokeColor)
                }
                background = bg
                setTextColor(if (isActive) Color.WHITE else Color.parseColor("#374151"))
                setTypeface(null, if (isActive) Typeface.BOLD else Typeface.NORMAL)
                setOnClickListener {
                    activeCategory = if (cat == "All") "" else cat
                    buildCategoryChips()
                    applyFilter()
                }
            }
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.marginEnd = (8 * density).toInt() }
            chipRow.addView(tv, lp)
        }
    }

    private fun loadData() {
        viewLifecycleOwner.lifecycleScope.launch {
            swipeRefresh.isRefreshing = true
            try {
                val token = ApiClient.bearerToken()
                allItems   = ApiClient.customerApi.getInventoryItems()
                promotions = ApiClient.customerApi.getPromotions()

                // Load user's active bookings to mark already-booked items
                loadUserBookings(token)

                adapter.updatePromotions(promotions)
                adapter.updateBookedIds(bookedFittingItemIds, bookedDirectItemIds)

                // Build chip list from categories that actually have available items
                val availableCategories = allItems
                    .filter { it.isAvailable && it.id !in bookedFittingItemIds && it.id !in bookedDirectItemIds }
                    .map { it.category }
                    .distinct()
                    .sorted()
                categories = listOf("All") + availableCategories

                // Reset active filter if it no longer has any items
                if (activeCategory.isNotEmpty() && activeCategory !in availableCategories) {
                    activeCategory = ""
                }

                buildCategoryChips()
                applyFilter()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? DashboardActivity)?.showSessionExpiredDialog()
                else Toast.makeText(requireContext(), "Error loading items", Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {
                Toast.makeText(requireContext(), "Network error. Check connection.", Toast.LENGTH_SHORT).show()
            }
            swipeRefresh.isRefreshing = false
        }
    }

    private suspend fun loadUserBookings(token: String) {
        val today = try { LocalDate.now().toString() } catch (_: Exception) { "" }

        // Fitting: CONFIRMED status with a future/today fitting date
        bookedFittingItemIds = try {
            ApiClient.customerApi.getMyFittingBookings(token)
                .filter { b ->
                    b.status.equals("CONFIRMED", ignoreCase = true) &&
                    b.fittingDate >= today &&
                    b.itemId != null
                }
                .mapNotNull { it.itemId }
                .toSet()
        } catch (_: Exception) { emptySet() }

        // Direct: Pending, Approved, or Confirmed status
        bookedDirectItemIds = try {
            ApiClient.customerApi.getAllMyDirectBookings(token)
                .filter { b ->
                    b.bookingStatus.lowercase() in listOf("pending", "approved", "confirmed") &&
                    b.inventoryItemId != null
                }
                .mapNotNull { it.inventoryItemId }
                .toSet()
        } catch (_: Exception) { emptySet() }
    }

    private fun applyFilter() {
        val filtered = allItems.filter { item ->
            // Hide unavailable items (maintenance, pending review, etc.)
            if (!item.isAvailable) return@filter false
            // Hide items the user already has an active booking for
            if (item.id in bookedFittingItemIds || item.id in bookedDirectItemIds) return@filter false

            val matchesSearch = searchQuery.isEmpty() ||
                item.name.contains(searchQuery, true) ||
                item.category.contains(searchQuery, true) ||
                item.subtype?.contains(searchQuery, true) == true ||
                item.description?.contains(searchQuery, true) == true
            val matchesCategory = activeCategory.isEmpty() ||
                item.category.equals(activeCategory, ignoreCase = true)
            matchesSearch && matchesCategory
        }
        adapter.submitList(filtered)
        tvItemCount.text = "${filtered.size} item${if (filtered.size != 1) "s" else ""}"
        tvEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE

        if (activeCategory.isNotEmpty()) {
            tvActiveFilter.visibility = View.VISIBLE
            tvActiveFilter.text = activeCategory
        } else {
            tvActiveFilter.visibility = View.GONE
        }
    }
}
