package com.app.mobile.ui.admin

import android.app.Activity
import android.app.DatePickerDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.*
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.mobile.ApiClient
import com.app.mobile.AdminDashboardActivity
import com.app.mobile.R
import com.app.mobile.adapters.InventoryAdapter
import com.app.mobile.adapters.PromotionAdapter
import com.app.mobile.databinding.FragmentInventoryBinding
import com.app.mobile.models.*
import com.app.mobile.sse.SseClient
import com.bumptech.glide.Glide
import com.google.android.material.button.MaterialButton
import com.google.gson.Gson
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.time.LocalDate
import java.util.*

class InventoryFragment : Fragment(), SseClient.SseListener {

    private var _binding: FragmentInventoryBinding? = null
    private val binding get() = _binding!!

    private lateinit var itemAdapter: InventoryAdapter
    private lateinit var promoAdapter: PromotionAdapter

    private var allItems  = listOf<InventoryItem>()
    private var allPromos = listOf<Promotion>()
    private var searchQuery  = ""
    private var filterStatus = ""
    private var currentTab   = TAB_ITEMS

    private val categories = listOf(
        "Gown", "Suit", "Barong", "Dress", "Casual Wear", "Formal Wear",
        "Kids Wear", "Accessories", "Other"
    )
    private val subtypeMap = mapOf(
        "Gown"        to listOf("Wedding Gown", "Evening Gown", "Ball Gown", "Cocktail Dress"),
        "Suit"        to listOf("Business Suit", "Tuxedo", "Three-Piece Suit"),
        "Barong"      to listOf("Barong Tagalog", "Filipiniana"),
        "Dress"       to listOf("Casual Dress", "Party Dress", "Maxi Dress"),
        "Formal Wear" to listOf("Black Tie", "White Tie", "Semi-Formal"),
        "Kids Wear"   to listOf("Kids Gown", "Kids Suit", "Kids Casual")
    )
    private val sizeOptions   = listOf("XS", "S", "M", "L", "XL", "XXL", "3XL")
    private val statusOptions = listOf("Available", "In Maintenance", "Pending Review")

    private var selectedUris = mutableListOf<Uri>()
    private var tvPhotoCount: TextView? = null

    private val photoPicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            selectedUris.clear()
            val clip = result.data?.clipData
            if (clip != null) {
                for (i in 0 until clip.itemCount) selectedUris.add(clip.getItemAt(i).uri)
            } else {
                result.data?.data?.let { selectedUris.add(it) }
            }
            tvPhotoCount?.text = if (selectedUris.isEmpty()) "No new photos selected"
                                 else "${selectedUris.size} new photo(s) selected"
        }
    }

    companion object {
        private const val TAB_ITEMS  = 0
        private const val TAB_PROMOS = 1
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentInventoryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Item recycler
        itemAdapter = InventoryAdapter { item -> showItemDetailsDialog(item) }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = itemAdapter

        // Promo recycler
        promoAdapter = PromotionAdapter { promo -> showPromoActions(promo) }
        binding.rvPromos.layoutManager = LinearLayoutManager(requireContext())
        binding.rvPromos.adapter = promoAdapter

        // Search
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { searchQuery = s.toString(); applyFilter() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        // Swipe-refresh
        binding.swipeRefresh.setOnRefreshListener { loadData() }

        // FAB — action depends on active tab
        binding.fabAdd.setOnClickListener {
            if (currentTab == TAB_ITEMS) showItemFormDialog(null)
            else showPromoFormDialog(null)
        }

        // Tabs
        binding.tabItems.setOnClickListener  { switchTab(TAB_ITEMS) }
        binding.tabPromos.setOnClickListener { switchTab(TAB_PROMOS) }

        // Settings button
        binding.btnSettings.setOnClickListener { showSettingsDialog() }

        // Status filter chips
        binding.chipGroupFilter.setOnCheckedStateChangeListener { _, checkedIds ->
            filterStatus = when (checkedIds.firstOrNull()) {
                R.id.chipFilterAvailable   -> "Available"
                R.id.chipFilterMaintenance -> "In Maintenance"
                R.id.chipFilterPending     -> "Pending Review"
                else                       -> ""
            }
            applyFilter()
        }

        switchTab(TAB_ITEMS)
        SseClient.addListener(this)
        loadData()
    }

    // ── Tab switching ─────────────────────────────────────────────────────────
    private fun switchTab(tab: Int) {
        currentTab = tab
        val onItems     = tab == TAB_ITEMS
        val burgundy    = ContextCompat.getColor(requireContext(), R.color.brand_burgundy)
        val subtle      = ContextCompat.getColor(requireContext(), R.color.brand_text_subtitle)
        val transparent = android.graphics.Color.TRANSPARENT

        binding.sectionItems.visibility  = if (onItems) View.VISIBLE else View.GONE
        binding.sectionPromos.visibility = if (onItems) View.GONE    else View.VISIBLE

        binding.tabItems.setTextColor(if (onItems) burgundy else subtle)
        binding.tabPromos.setTextColor(if (!onItems) burgundy else subtle)

        binding.tabIndicatorItems.setBackgroundColor(if (onItems) burgundy else transparent)
        binding.tabIndicatorPromos.setBackgroundColor(if (!onItems) burgundy else transparent)
    }

    // ── Data loading ──────────────────────────────────────────────────────────
    private fun loadData() {
        viewLifecycleOwner.lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            try {
                allItems  = ApiClient.adminApi.getInventoryItems()
                allPromos = ApiClient.adminApi.getPromotions()
                itemAdapter.updatePromotions(allPromos)
                applyFilter()
                updatePromosList()
                updateStats()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Error: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
            binding.swipeRefresh.isRefreshing = false
        }
    }

    private fun updateStats() {
        binding.tvStatTotal.text       = allItems.size.toString()
        binding.tvStatAvailable.text   = allItems.count { it.isAvailable }.toString()
        binding.tvStatMaintenance.text = allItems.count {
            it.status.contains("Maintenance", ignoreCase = true)
        }.toString()
        binding.tvStatPending.text     = allItems.count {
            it.status.contains("Pending", ignoreCase = true)
        }.toString()
    }

    private fun applyFilter() {
        val filtered = allItems.filter { item ->
            val matchesSearch = searchQuery.isEmpty() ||
                item.name.contains(searchQuery, true) ||
                item.category.contains(searchQuery, true) ||
                item.status.contains(searchQuery, true) ||
                item.subtype?.contains(searchQuery, true) == true
            val matchesStatus = filterStatus.isEmpty() ||
                item.status.equals(filterStatus, ignoreCase = true)
            matchesSearch && matchesStatus
        }
        itemAdapter.submitList(filtered)
        binding.tvEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun updatePromosList() {
        promoAdapter.submitList(allPromos)
        binding.tvEmptyPromos.visibility = if (allPromos.isEmpty()) View.VISIBLE else View.GONE
    }

    // ── Active promo helper ───────────────────────────────────────────────────
    private fun activePromo(item: InventoryItem): Promotion? {
        val today = try { LocalDate.now().toString() } catch (_: Exception) { return null }
        return allPromos.find { p ->
            p.active && p.items?.contains(item.id) == true && p.start <= today && p.end >= today
        }
    }

    // ── Inventory Settings Dialog ─────────────────────────────────────────────
    private fun showSettingsDialog() {
        val settingsView = LayoutInflater.from(requireContext())
            .inflate(R.layout.dialog_inventory_settings, null)
        val etMinDays    = settingsView.findViewById<EditText>(R.id.etMinLeaseDays)
        val etWeekly     = settingsView.findViewById<EditText>(R.id.etWeeklyDiscount)
        val etMonthlyCap = settingsView.findViewById<EditText>(R.id.etMonthlyDiscountCap)

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val s = ApiClient.adminApi.getInventorySettings()
                etMinDays.setText(s.minLeaseDays.toString())
                etWeekly.setText(s.weeklyDiscount.toString())
                etMonthlyCap.setText(s.monthlyDiscountCap.toString())
            } catch (_: Exception) {
                etMinDays.setText("2")
                etWeekly.setText("100")
                etMonthlyCap.setText("300")
            }
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Inventory Settings")
            .setView(settingsView)
            .setPositiveButton("Save") { _, _ ->
                val minDays    = etMinDays.text.toString().toIntOrNull() ?: 2
                val weekly     = etWeekly.text.toString().toDoubleOrNull() ?: 100.0
                val monthlyCap = etMonthlyCap.text.toString().toDoubleOrNull() ?: 300.0
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.updateInventorySettings(
                            ApiClient.bearerToken(),
                            InventorySettings(minDays, weekly, monthlyCap)
                        )
                        toast("Settings saved")
                    } catch (_: Exception) { toast("Failed to save settings") }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ── Item detail modal ─────────────────────────────────────────────────────
    private fun showItemDetailsDialog(item: InventoryItem) {
        val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_item_detail, null)

        val ivImage        = dialogView.findViewById<ImageView>(R.id.idivImage)
        val tvName         = dialogView.findViewById<TextView>(R.id.idtvName)
        val tvStatus       = dialogView.findViewById<TextView>(R.id.idtvStatus)
        val tvCategory     = dialogView.findViewById<TextView>(R.id.idtvCategory)
        val tvPrice        = dialogView.findViewById<TextView>(R.id.idtvPrice)
        val tvPriceOld     = dialogView.findViewById<TextView>(R.id.idtvPriceOld)
        val tvPromoTag     = dialogView.findViewById<TextView>(R.id.idtvPromoTag)
        val labelSizes     = dialogView.findViewById<TextView>(R.id.idlabelSizes)
        val tvSizes        = dialogView.findViewById<TextView>(R.id.idtvSizes)
        val labelAgeRange  = dialogView.findViewById<TextView>(R.id.idlabelAgeRange)
        val tvAgeRange     = dialogView.findViewById<TextView>(R.id.idtvAgeRange)
        val labelMaint     = dialogView.findViewById<TextView>(R.id.idlabelMaintenance)
        val tvMaint        = dialogView.findViewById<TextView>(R.id.idtvMaintenance)
        val labelDesc      = dialogView.findViewById<TextView>(R.id.idlabelDescription)
        val tvDesc         = dialogView.findViewById<TextView>(R.id.idtvDescription)
        val tvPhotos       = dialogView.findViewById<TextView>(R.id.idtvPhotos)
        val btnEdit        = dialogView.findViewById<MaterialButton>(R.id.idbtnEdit)
        val btnDelete      = dialogView.findViewById<MaterialButton>(R.id.idbtnDelete)

        // Image
        val imgUrl = item.firstImageUrl
        if (!imgUrl.isNullOrEmpty()) {
            Glide.with(this).load(imgUrl).centerCrop().into(ivImage)
        } else {
            ivImage.setImageResource(android.R.drawable.ic_menu_gallery)
        }

        // Name
        tvName.text = item.name

        // Status badge
        tvStatus.text = item.status
        if (item.isAvailable) {
            tvStatus.setBackgroundColor(Color.parseColor("#D1FAE5"))
            tvStatus.setTextColor(Color.parseColor("#065F46"))
        } else {
            tvStatus.setBackgroundColor(Color.parseColor("#FEF3C7"))
            tvStatus.setTextColor(Color.parseColor("#92400E"))
        }

        // Category
        tvCategory.text = item.category + (item.subtype?.let { " · $it" } ?: "")

        // Price + promo
        val promo = activePromo(item)
        if (promo != null) {
            val discounted = if (promo.type == "percentage")
                item.price * (1 - promo.value / 100)
            else
                (item.price - promo.value).coerceAtLeast(0.0)
            tvPriceOld.visibility = View.VISIBLE
            tvPriceOld.text = "₱${String.format("%.2f", item.price)}"
            tvPriceOld.paintFlags = tvPriceOld.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
            tvPrice.text = "₱${String.format("%.0f", discounted)}"
            tvPrice.setTextColor(Color.parseColor("#15803d"))
            val savings = if (promo.type == "percentage") "${promo.value.toInt()}% off"
                          else "₱${promo.value.toInt()} off"
            tvPromoTag.visibility = View.VISIBLE
            tvPromoTag.text = "${promo.code} · $savings  (${promo.start} → ${promo.end})"
        } else {
            tvPrice.text = "₱${String.format("%.2f", item.price)}"
            tvPrice.setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_burgundy))
        }

        // Sizes
        val sizeText = item.sizes?.filter { it.isNotEmpty() }?.joinToString(", ")
        if (!sizeText.isNullOrEmpty()) {
            labelSizes.visibility = View.VISIBLE
            tvSizes.visibility = View.VISIBLE
            tvSizes.text = sizeText
        }

        // Age range
        item.ageRange?.let {
            labelAgeRange.visibility = View.VISIBLE
            tvAgeRange.visibility = View.VISIBLE
            tvAgeRange.text = it
        }

        // Maintenance
        if (item.status.contains("Maintenance", ignoreCase = true) && item.maintenanceEndDate != null) {
            labelMaint.visibility = View.VISIBLE
            tvMaint.visibility = View.VISIBLE
            tvMaint.text = item.maintenanceEndDate
        }

        // Description
        item.description?.takeIf { it.isNotBlank() }?.let {
            labelDesc.visibility = View.VISIBLE
            tvDesc.visibility = View.VISIBLE
            tvDesc.text = it
        }

        // Photo count
        val photoCount = item.mediaFiles?.size ?: 0
        if (photoCount > 0) {
            tvPhotos.visibility = View.VISIBLE
            tvPhotos.text = "$photoCount photo(s) attached"
        }

        val dialog = AlertDialog.Builder(requireContext())
            .setTitle(null)
            .setView(dialogView)
            .create()

        btnEdit.setOnClickListener {
            dialog.dismiss()
            showItemFormDialog(item)
        }

        btnDelete.setOnClickListener {
            dialog.dismiss()
            confirmDelete(item)
        }

        dialog.show()
    }

    private fun markAvailable(id: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.markItemAvailable(ApiClient.bearerToken(), id)
                toast("Item marked as available")
                loadData()
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun confirmDelete(item: InventoryItem) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete Item")
            .setMessage("Delete \"${item.name}\"? This cannot be undone.")
            .setPositiveButton("Delete") { _, _ -> deleteItem(item.id) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun deleteItem(id: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.deleteInventoryItem(ApiClient.bearerToken(), id)
                toast("Item deleted")
                loadData()
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    // ── Item Form Dialog (Add / Edit) ─────────────────────────────────────────
    private fun showItemFormDialog(existingItem: InventoryItem?) {
        selectedUris.clear()
        val view       = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_add_item, null)
        val etName     = view.findViewById<EditText>(R.id.etItemName)
        val spCategory = view.findViewById<Spinner>(R.id.spinnerCategory)
        val spSubtype  = view.findViewById<Spinner>(R.id.spinnerSubtype)
        val etCustomSub= view.findViewById<EditText>(R.id.etCustomSubtype)
        val sizeRow    = view.findViewById<LinearLayout>(R.id.sizeChipsRow)
        val etPrice    = view.findViewById<EditText>(R.id.etPrice)
        val spStatus   = view.findViewById<Spinner>(R.id.spinnerStatus)
        val etAgeRange = view.findViewById<EditText>(R.id.etAgeRange)
        val etDesc     = view.findViewById<EditText>(R.id.etDescription)
        val btnPhotos  = view.findViewById<MaterialButton>(R.id.btnSelectPhotos)
        tvPhotoCount   = view.findViewById(R.id.tvPhotoCount)

        val catAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, categories)
        catAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spCategory.adapter = catAdapter

        val selectedSizes = mutableSetOf<String>()

        fun TextView.chipSelect() {
            setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.brand_burgundy))
            setTextColor(ContextCompat.getColor(requireContext(), android.R.color.white))
        }
        fun TextView.chipDeselect() {
            setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.gray_300))
            setTextColor(ContextCompat.getColor(requireContext(), R.color.brand_text_dark))
        }

        fun buildSizeChips(preSelected: Set<String> = emptySet()) {
            sizeRow.removeAllViews()
            sizeOptions.forEach { sz ->
                val chip = TextView(requireContext()).apply {
                    text        = sz
                    textSize    = 12f
                    setPadding(24, 12, 24, 12)
                    isClickable = true
                    isFocusable = true
                    if (sz in preSelected) { selectedSizes.add(sz); chipSelect() } else chipDeselect()
                    setOnClickListener {
                        if (sz in selectedSizes) { selectedSizes.remove(sz); chipDeselect() }
                        else { selectedSizes.add(sz); chipSelect() }
                    }
                }
                val lp = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                lp.marginEnd = 8; lp.bottomMargin = 8
                sizeRow.addView(chip, lp)
            }
        }

        fun buildSubtypeList(category: String): List<String> =
            listOf("— None —") + (subtypeMap[category] ?: emptyList()) + listOf("Other (custom)")

        fun updateSubtypes(category: String, selectValue: String? = null) {
            val subs = buildSubtypeList(category)
            val subAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, subs)
            subAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            spSubtype.adapter = subAdapter
            if (selectValue != null) {
                val idx = subs.indexOf(selectValue)
                if (idx >= 0) spSubtype.setSelection(idx)
            }
        }

        spCategory.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                updateSubtypes(categories[pos])
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }

        spSubtype.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                etCustomSub.visibility =
                    if (spSubtype.selectedItem?.toString() == "Other (custom)") View.VISIBLE else View.GONE
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }

        val statusAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, statusOptions)
        statusAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spStatus.adapter = statusAdapter

        val preSelectedSizes = mutableSetOf<String>()
        if (existingItem != null) {
            etName.setText(existingItem.name)
            val catIdx = categories.indexOf(existingItem.category).coerceAtLeast(0)
            spCategory.setSelection(catIdx)

            val defaultSubs = subtypeMap[existingItem.category] ?: emptyList()
            val existingSubtype = existingItem.subtype
            if (existingSubtype != null && !defaultSubs.contains(existingSubtype)) {
                // Custom subtype — show in "Other (custom)" + pre-fill field
                updateSubtypes(existingItem.category, "Other (custom)")
                etCustomSub.visibility = View.VISIBLE
                etCustomSub.setText(existingSubtype)
            } else {
                updateSubtypes(existingItem.category, existingSubtype)
            }

            etPrice.setText(existingItem.price.toString())
            val statusIdx = statusOptions.indexOfFirst {
                it.equals(existingItem.status, ignoreCase = true) ||
                it.replace(" ", "").equals(existingItem.status.replace(" ", ""), ignoreCase = true)
            }.coerceAtLeast(0)
            spStatus.setSelection(statusIdx)
            existingItem.ageRange?.let { etAgeRange.setText(it) }
            existingItem.description?.let { etDesc.setText(it) }
            existingItem.sizes?.forEach { preSelectedSizes.add(it) }

            val existingCount = existingItem.mediaFiles?.size ?: 0
            tvPhotoCount?.text = if (existingCount > 0)
                "$existingCount existing photo(s) — select to add more"
            else
                "No photos — select to add"
        }
        buildSizeChips(preSelectedSizes)

        btnPhotos.setOnClickListener {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "image/*"
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
            photoPicker.launch(Intent.createChooser(intent, "Select Photos"))
        }

        AlertDialog.Builder(requireContext())
            .setTitle(if (existingItem == null) "Add Inventory Item" else "Edit Item")
            .setView(view)
            .setPositiveButton(if (existingItem == null) "Add" else "Save") { _, _ ->
                val name  = etName.text.toString().trim()
                val cat   = categories[spCategory.selectedItemPosition]
                val price = etPrice.text.toString().toDoubleOrNull()
                if (name.isEmpty() || price == null) {
                    toast("Name and price are required"); return@setPositiveButton
                }
                val selectedSubRaw = spSubtype.selectedItem?.toString() ?: ""
                val subtype = when {
                    selectedSubRaw == "— None —"      -> null
                    selectedSubRaw == "Other (custom)" -> etCustomSub.text.toString().trim().ifEmpty { null }
                    else                               -> selectedSubRaw
                }
                val sizeList  = if (selectedSizes.isEmpty()) null else selectedSizes.toList()
                val status    = statusOptions[spStatus.selectedItemPosition]
                val ageRange  = etAgeRange.text.toString().trim().ifEmpty { null }
                val desc      = etDesc.text.toString().trim().ifEmpty { null }

                val itemData = CreateItemRequest(name, cat, subtype, sizeList, price, status, ageRange, desc)
                if (existingItem == null) createItem(itemData)
                else updateItem(existingItem.id, itemData, existingItem)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun createItem(data: CreateItemRequest) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val jsonBody = Gson().toJson(data).toRequestBody("application/json".toMediaType())
                val parts    = buildFileParts()
                ApiClient.adminApi.createInventoryItem(ApiClient.bearerToken(), jsonBody, parts)
                toast("Item created successfully")
                loadData()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Error creating item: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun updateItem(id: String, data: CreateItemRequest, existingItem: InventoryItem) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val jsonBody = Gson().toJson(data).toRequestBody("application/json".toMediaType())
                // Always preserve existing photos; new ones are appended
                val existingUrls   = existingItem.mediaFiles?.map { it.url } ?: emptyList()
                val keepUrlsJson   = Gson().toJson(existingUrls)
                val keepUrls       = keepUrlsJson.toRequestBody("application/json".toMediaType())
                val parts          = buildFileParts()
                ApiClient.adminApi.updateInventoryItem(ApiClient.bearerToken(), id, jsonBody, keepUrls, parts)
                toast("Item updated")
                loadData()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Error updating item: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun buildFileParts(): List<MultipartBody.Part> {
        return selectedUris.mapIndexed { i, uri ->
            val stream   = requireContext().contentResolver.openInputStream(uri) ?: return@mapIndexed null
            val bytes    = stream.readBytes(); stream.close()
            val mimeType = requireContext().contentResolver.getType(uri) ?: "image/jpeg"
            val body     = bytes.toRequestBody(mimeType.toMediaType())
            val ext      = if (mimeType.contains("png")) "png" else "jpg"
            MultipartBody.Part.createFormData("files", "photo_$i.$ext", body)
        }.filterNotNull()
    }

    // ── Promotion management ──────────────────────────────────────────────────
    private fun showPromoActions(promo: Promotion) {
        val today  = try { LocalDate.now().toString() } catch (_: Exception) { "" }
        val isLive = promo.active && today.isNotEmpty() && promo.start <= today && promo.end >= today
        val typeLabel   = if (promo.type == "percentage") "${promo.value.toInt()}% off"
                          else "₱${promo.value.toInt()} off"
        val itemsLabel  = if (promo.items.isNullOrEmpty()) "All items" else "${promo.items.size} item(s)"
        val statusLabel = when {
            isLive       -> "Live"
            promo.active -> "Scheduled"
            else         -> "Inactive"
        }

        AlertDialog.Builder(requireContext())
            .setTitle("${promo.code} · $typeLabel")
            .setMessage("Status: $statusLabel\n${promo.start} → ${promo.end}\nApplies to: $itemsLabel")
            .setItems(arrayOf("Edit", "Delete")) { _, idx ->
                if (idx == 0) showPromoFormDialog(promo) else confirmDeletePromo(promo)
            }
            .setNegativeButton("Close", null)
            .show()
    }

    private fun showPromoFormDialog(promo: Promotion?) {
        val view            = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_promotion, null)
        val etCode          = view.findViewById<EditText>(R.id.etCode)
        val spType          = view.findViewById<Spinner>(R.id.spType)
        val etValue         = view.findViewById<EditText>(R.id.etValue)
        val etStart         = view.findViewById<EditText>(R.id.etStartDate)
        val etEnd           = view.findViewById<EditText>(R.id.etEndDate)
        val cbActive        = view.findViewById<CheckBox>(R.id.cbActive)
        val btnSelectItems  = view.findViewById<MaterialButton>(R.id.btnSelectItems)
        val tvSelectedItems = view.findViewById<TextView>(R.id.tvSelectedItems)

        val types = arrayOf("percentage", "flat")
        spType.adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, types)

        promo?.let {
            etCode.setText(it.code)
            spType.setSelection(types.indexOf(it.type).coerceAtLeast(0))
            etValue.setText(it.value.toString())
            etStart.setText(it.start)
            etEnd.setText(it.end)
            cbActive.isChecked = it.active
        } ?: run { cbActive.isChecked = true }

        val selectedItemIds = mutableSetOf<String>()
        promo?.items?.forEach { selectedItemIds.add(it) }

        fun refreshItemLabel() {
            tvSelectedItems.text = if (selectedItemIds.isEmpty()) "All items (no restriction)"
                                   else "${selectedItemIds.size} item(s) selected"
        }
        refreshItemLabel()

        btnSelectItems.setOnClickListener {
            if (allItems.isEmpty()) { toast("No items available"); return@setOnClickListener }
            val names   = allItems.map { "${it.name} (${it.category})" }.toTypedArray()
            val checked = allItems.map { it.id in selectedItemIds }.toBooleanArray()
            AlertDialog.Builder(requireContext())
                .setTitle("Select Items to Apply Promo")
                .setMultiChoiceItems(names, checked) { _, idx, isChecked ->
                    if (isChecked) selectedItemIds.add(allItems[idx].id)
                    else           selectedItemIds.remove(allItems[idx].id)
                }
                .setPositiveButton("Done")    { _, _ -> refreshItemLabel() }
                .setNeutralButton("Clear All") { _, _ -> selectedItemIds.clear(); refreshItemLabel() }
                .setNegativeButton("Cancel", null)
                .show()
        }

        fun pickDate(et: EditText) {
            val cal = Calendar.getInstance()
            DatePickerDialog(requireContext(), { _, y, m, d ->
                et.setText("$y-${"%02d".format(m + 1)}-${"%02d".format(d)}")
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
        }
        etStart.setOnClickListener { pickDate(etStart) }
        etEnd.setOnClickListener   { pickDate(etEnd) }

        AlertDialog.Builder(requireContext())
            .setTitle(if (promo == null) "Add Promotion" else "Edit Promotion")
            .setView(view)
            .setPositiveButton(if (promo == null) "Add" else "Save") { _, _ ->
                val code  = etCode.text.toString().trim().uppercase()
                val type  = spType.selectedItem.toString()
                val value = etValue.text.toString().toDoubleOrNull()
                val start = etStart.text.toString().trim()
                val end   = etEnd.text.toString().trim()

                if (code.isEmpty())  { toast("Promo code is required"); return@setPositiveButton }
                if (value == null || value <= 0) { toast("Value is required"); return@setPositiveButton }
                if (start.isEmpty()) { toast("Start date is required"); return@setPositiveButton }
                if (end.isEmpty())   { toast("End date is required");   return@setPositiveButton }
                if (type == "percentage" && value > 100) { toast("Percentage must be ≤ 100"); return@setPositiveButton }
                if (start > end)     { toast("End date must be after start date"); return@setPositiveButton }

                val itemsList = if (selectedItemIds.isEmpty()) null else selectedItemIds.toList()
                val body      = CreatePromotionRequest(code, type, value, start, end, cbActive.isChecked, itemsList)

                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        if (promo == null) ApiClient.adminApi.createPromotion(ApiClient.bearerToken(), body)
                        else               ApiClient.adminApi.updatePromotion(ApiClient.bearerToken(), promo.id, body)
                        toast(if (promo == null) "Promotion created" else "Promotion updated")
                        loadData()
                    } catch (e: HttpException) { toast("Error: ${e.message()}") }
                    catch (_: Exception)        { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun confirmDeletePromo(promo: Promotion) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete Promotion")
            .setMessage("Delete code \"${promo.code}\"? This cannot be undone.")
            .setPositiveButton("Delete") { _, _ ->
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.deletePromotion(ApiClient.bearerToken(), promo.id)
                        toast("Promotion deleted")
                        loadData()
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ── SSE ───────────────────────────────────────────────────────────────────
    override fun onEvent(type: String, data: String) {
        if (type == "INVENTORY_UPDATE" || type == "PROMOTION_UPDATE") loadData()
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        SseClient.removeListener(this)
        tvPhotoCount = null
        _binding = null
    }
}
