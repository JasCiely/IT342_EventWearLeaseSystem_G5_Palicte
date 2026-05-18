package com.app.mobile.ui.admin

import android.app.Activity
import android.content.Intent
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
import com.app.mobile.databinding.FragmentInventoryBinding
import com.app.mobile.models.CreateItemRequest
import com.app.mobile.models.InventoryItem
import com.app.mobile.sse.SseClient
import com.google.gson.Gson
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException

class InventoryFragment : Fragment(), SseClient.SseListener {

    private var _binding: FragmentInventoryBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: InventoryAdapter
    private var allItems    = listOf<InventoryItem>()
    private var searchQuery = ""

    // ── Category / Subtype constants matching web CATEGORIES ─────────────────
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
    private val sizeOptions = listOf("XS", "S", "M", "L", "XL", "XXL", "3XL")
    private val statusOptions = listOf("Available", "In Maintenance", "Pending Review")

    // ── Selected photo URIs for current dialog ────────────────────────────────
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
            tvPhotoCount?.text = if (selectedUris.isEmpty()) "No photos selected"
                                 else "${selectedUris.size} photo(s) selected"
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentInventoryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = InventoryAdapter { item -> showItemActions(item) }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { searchQuery = s.toString(); applyFilter() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        binding.swipeRefresh.setOnRefreshListener { loadItems() }
        binding.fabAdd.setOnClickListener { showItemFormDialog(null) }
        SseClient.addListener(this)
        loadItems()
    }

    private fun loadItems() {
        viewLifecycleOwner.lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            try {
                allItems = ApiClient.adminApi.getInventoryItems()
                applyFilter()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Error: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
            binding.swipeRefresh.isRefreshing = false
        }
    }

    private fun applyFilter() {
        val filtered = if (searchQuery.isEmpty()) allItems
        else allItems.filter {
            it.name.contains(searchQuery, true) ||
            it.category.contains(searchQuery, true) ||
            it.status.contains(searchQuery, true)
        }
        adapter.submitList(filtered)
        binding.tvEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun showItemActions(item: InventoryItem) {
        val actions = mutableListOf("View Details", "Edit", "Delete")
        if (!item.isAvailable) actions.add(0, "Mark Available")

        AlertDialog.Builder(requireContext())
            .setTitle(item.name)
            .setMessage("${item.category} | ₱${String.format("%.2f", item.price)} | ${item.status}")
            .setItems(actions.toTypedArray()) { _, idx ->
                when (actions[idx]) {
                    "View Details"   -> showItemDetails(item)
                    "Edit"           -> showItemFormDialog(item)
                    "Mark Available" -> markAvailable(item.id)
                    "Delete"         -> confirmDelete(item)
                }
            }.show()
    }

    private fun showItemDetails(item: InventoryItem) {
        val msg = buildString {
            append("Category: ${item.category}\n")
            item.subtype?.let { append("Subtype: $it\n") }
            item.size?.let { append("Sizes: $it\n") }
            append("Price: ₱${String.format("%.2f", item.price)}\n")
            append("Status: ${item.status}\n")
            item.ageRange?.let { append("Age Range: $it\n") }
            item.description?.let { append("\n$it") }
        }
        AlertDialog.Builder(requireContext())
            .setTitle(item.name)
            .setMessage(msg)
            .setPositiveButton("Close", null)
            .show()
    }

    private fun markAvailable(id: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.adminApi.markItemAvailable(ApiClient.bearerToken(), id)
                toast("Item marked as available")
                loadItems()
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
                loadItems()
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    // ── Item Form Dialog (Add / Edit) ─────────────────────────────────────────
    private fun showItemFormDialog(existingItem: InventoryItem?) {
        selectedUris.clear()
        val view         = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_add_item, null)
        val etName       = view.findViewById<EditText>(R.id.etItemName)
        val spCategory   = view.findViewById<Spinner>(R.id.spinnerCategory)
        val spSubtype    = view.findViewById<Spinner>(R.id.spinnerSubtype)
        val etCustomSub  = view.findViewById<EditText>(R.id.etCustomSubtype)
        val sizeChipsRow = view.findViewById<LinearLayout>(R.id.sizeChipsRow)
        val etPrice      = view.findViewById<EditText>(R.id.etPrice)
        val spStatus     = view.findViewById<Spinner>(R.id.spinnerStatus)
        val etAgeRange   = view.findViewById<EditText>(R.id.etAgeRange)
        val etDesc       = view.findViewById<EditText>(R.id.etDescription)
        val btnPhotos    = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnSelectPhotos)
        tvPhotoCount     = view.findViewById(R.id.tvPhotoCount)

        // ── Category spinner ──────────────────────────────────────────────────
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

        // ── Size chips ────────────────────────────────────────────────────────
        fun buildSizeChips(preSelected: Set<String> = emptySet()) {
            sizeChipsRow.removeAllViews()
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
                val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                lp.marginEnd = 8
                lp.bottomMargin = 8
                sizeChipsRow.addView(chip, lp)
            }
        }

        // ── Subtype spinner (cascades from category) ──────────────────────────
        fun updateSubtypes(category: String) {
            val subs = (subtypeMap[category] ?: emptyList()) + listOf("Other (custom)")
            val subAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, listOf("— None —") + subs)
            subAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            spSubtype.adapter = subAdapter
        }

        spCategory.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                updateSubtypes(categories[pos])
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }

        spSubtype.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                val sel = spSubtype.selectedItem?.toString() ?: ""
                etCustomSub.visibility = if (sel == "Other (custom)") View.VISIBLE else View.GONE
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }

        // ── Status spinner ────────────────────────────────────────────────────
        val statusAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, statusOptions)
        statusAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spStatus.adapter = statusAdapter

        // ── Pre-fill from existing item ───────────────────────────────────────
        val preSelectedSizes = mutableSetOf<String>()
        if (existingItem != null) {
            etName.setText(existingItem.name)
            val catIdx = categories.indexOf(existingItem.category).coerceAtLeast(0)
            spCategory.setSelection(catIdx)
            updateSubtypes(existingItem.category)
            etPrice.setText(existingItem.price.toString())
            val statusIdx = statusOptions.indexOfFirst {
                it.equals(existingItem.status, ignoreCase = true) ||
                it.replace(" ", "").equals(existingItem.status.replace(" ", ""), ignoreCase = true)
            }.coerceAtLeast(0)
            spStatus.setSelection(statusIdx)
            existingItem.ageRange?.let { etAgeRange.setText(it) }
            existingItem.description?.let { etDesc.setText(it) }
            // Parse sizes (stored as comma-separated)
            existingItem.size?.split(",")?.map { it.trim() }?.forEach { preSelectedSizes.add(it) }
        }
        buildSizeChips(preSelectedSizes)

        // ── Photo picker ──────────────────────────────────────────────────────
        btnPhotos.setOnClickListener {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type      = "image/*"
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
            photoPicker.launch(Intent.createChooser(intent, "Select Photos"))
        }

        val title = if (existingItem == null) "Add Inventory Item" else "Edit Item"
        AlertDialog.Builder(requireContext())
            .setTitle(title)
            .setView(view)
            .setPositiveButton(if (existingItem == null) "Add" else "Save") { _, _ ->
                val name = etName.text.toString().trim()
                val cat  = categories[spCategory.selectedItemPosition]
                val price = etPrice.text.toString().toDoubleOrNull()
                if (name.isEmpty() || price == null) {
                    toast("Name and price are required"); return@setPositiveButton
                }
                val selectedSubRaw = spSubtype.selectedItem?.toString() ?: ""
                val subtype = when {
                    selectedSubRaw == "— None —" -> null
                    selectedSubRaw == "Other (custom)" -> etCustomSub.text.toString().trim().ifEmpty { null }
                    else -> selectedSubRaw
                }
                val sizeStr = selectedSizes.joinToString(",").ifEmpty { null }
                val status  = statusOptions[spStatus.selectedItemPosition]
                val ageRange = etAgeRange.text.toString().trim().ifEmpty { null }
                val desc    = etDesc.text.toString().trim().ifEmpty { null }

                val itemData = CreateItemRequest(name, cat, subtype, sizeStr, price, status, ageRange, desc)
                if (existingItem == null) createItem(itemData) else updateItem(existingItem.id, itemData)
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
                loadItems()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Error creating item: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun updateItem(id: String, data: CreateItemRequest) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val jsonBody  = Gson().toJson(data).toRequestBody("application/json".toMediaType())
                val keepUrls  = "[]".toRequestBody("application/json".toMediaType())
                val parts     = buildFileParts()
                ApiClient.adminApi.updateInventoryItem(ApiClient.bearerToken(), id, jsonBody, keepUrls, parts)
                toast("Item updated")
                loadItems()
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
                else toast("Error updating item: ${e.message()}")
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
        }
    }

    private fun buildFileParts(): List<MultipartBody.Part> {
        return selectedUris.mapIndexed { i, uri ->
            val stream   = requireContext().contentResolver.openInputStream(uri) ?: return@mapIndexed null
            val bytes    = stream.readBytes()
            stream.close()
            val mimeType = requireContext().contentResolver.getType(uri) ?: "image/jpeg"
            val body     = bytes.toRequestBody(mimeType.toMediaType())
            val ext      = if (mimeType.contains("png")) "png" else "jpg"
            MultipartBody.Part.createFormData("files", "photo_$i.$ext", body)
        }.filterNotNull()
    }

    override fun onEvent(type: String, data: String) { if (type == "INVENTORY_UPDATE") loadItems() }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        SseClient.removeListener(this)
        tvPhotoCount = null
        _binding = null
    }
}
