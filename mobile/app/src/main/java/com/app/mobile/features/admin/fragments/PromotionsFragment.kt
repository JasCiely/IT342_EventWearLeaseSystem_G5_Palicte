package com.app.mobile.features.admin.fragments

import android.app.DatePickerDialog
import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.mobile.features.admin.activities.AdminDashboardActivity
import com.app.mobile.features.admin.adapters.PromotionAdapter
import com.app.mobile.R
import com.app.mobile.databinding.FragmentPromotionsBinding
import com.app.mobile.shared.api.ApiClient
import com.app.mobile.shared.models.CreatePromotionRequest
import com.app.mobile.shared.models.InventoryItem
import com.app.mobile.shared.models.Promotion
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.util.*

class PromotionsFragment : Fragment() {

    private var _binding: FragmentPromotionsBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: PromotionAdapter
    private var promotions = listOf<Promotion>()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentPromotionsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.toolbar.setNavigationOnClickListener { parentFragmentManager.popBackStack() }

        adapter = PromotionAdapter { promo -> showPromoActions(promo) }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter

        binding.fabAdd.setOnClickListener { showPromoDialog(null) }
        binding.swipeRefresh.setOnRefreshListener { loadPromotions() }
        loadPromotions()
    }

    private fun loadPromotions() {
        viewLifecycleOwner.lifecycleScope.launch {
            binding.swipeRefresh.isRefreshing = true
            try {
                promotions = ApiClient.adminApi.getPromotions()
                adapter.submitList(promotions)
                binding.tvEmpty.visibility = if (promotions.isEmpty()) View.VISIBLE else View.GONE
            } catch (e: HttpException) {
                if (e.code() == 401) (activity as? AdminDashboardActivity)?.showSessionExpiredDialog()
            } catch (_: Exception) { toast(getString(R.string.error_network)) }
            binding.swipeRefresh.isRefreshing = false
        }
    }

    private fun showPromoActions(promo: Promotion) {
        val typeLabel = if (promo.type == "percentage") "${promo.value}%" else "₱${promo.value}"
        val itemsLabel = if (promo.items.isNullOrEmpty()) "All items"
                         else "${promo.items.size} specific item(s)"
        AlertDialog.Builder(requireContext())
            .setTitle(promo.code)
            .setMessage(
                "${promo.type.replaceFirstChar { it.uppercase() }} • $typeLabel\n" +
                "${promo.start} → ${promo.end}\n" +
                "Active: ${promo.active}\n" +
                "Applies to: $itemsLabel"
            )
            .setItems(arrayOf("Edit", "Delete")) { _, idx ->
                if (idx == 0) showPromoDialog(promo) else confirmDelete(promo)
            }
            .setNegativeButton("Close", null).show()
    }

    private fun showPromoDialog(promo: Promotion?) {
        val view        = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_promotion, null)
        val etCode      = view.findViewById<EditText>(R.id.etCode)
        val spType      = view.findViewById<Spinner>(R.id.spType)
        val etValue     = view.findViewById<EditText>(R.id.etValue)
        val etStart     = view.findViewById<EditText>(R.id.etStartDate)
        val etEnd       = view.findViewById<EditText>(R.id.etEndDate)
        val cbActive    = view.findViewById<CheckBox>(R.id.cbActive)
        val btnSelectItems = view.findViewById<MaterialButton>(R.id.btnSelectItems)
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

        var inventoryItems = listOf<InventoryItem>()
        val selectedItemIds = mutableSetOf<String>()

        promo?.items?.forEach { selectedItemIds.add(it) }

        fun refreshItemLabel() {
            tvSelectedItems.text = if (selectedItemIds.isEmpty())
                "All items (no restriction)"
            else
                "${selectedItemIds.size} item(s) selected"
        }
        refreshItemLabel()

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                inventoryItems = ApiClient.adminApi.getInventoryItems()
            } catch (_: Exception) { }
        }

        btnSelectItems.setOnClickListener {
            if (inventoryItems.isEmpty()) {
                toast("Loading items… please try again in a moment"); return@setOnClickListener
            }
            val names   = inventoryItems.map { it.name }.toTypedArray()
            val checked = inventoryItems.map { it.id in selectedItemIds }.toBooleanArray()

            AlertDialog.Builder(requireContext())
                .setTitle("Select Items to Apply Promo")
                .setMultiChoiceItems(names, checked) { _, idx, isChecked ->
                    if (isChecked) selectedItemIds.add(inventoryItems[idx].id)
                    else           selectedItemIds.remove(inventoryItems[idx].id)
                }
                .setPositiveButton("Done") { _, _ -> refreshItemLabel() }
                .setNeutralButton("Clear All") { _, _ ->
                    selectedItemIds.clear(); refreshItemLabel()
                }
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
                val code  = etCode.text.toString().trim()
                val type  = spType.selectedItem.toString()
                val value = etValue.text.toString().toDoubleOrNull()
                val start = etStart.text.toString().trim()
                val end   = etEnd.text.toString().trim()

                if (code.isEmpty())  { toast("Promo code is required"); return@setPositiveButton }
                if (value == null)   { toast("Value is required");      return@setPositiveButton }
                if (start.isEmpty()) { toast("Start date is required"); return@setPositiveButton }
                if (end.isEmpty())   { toast("End date is required");   return@setPositiveButton }
                if (type == "percentage" && (value <= 0.0 || value > 100.0)) {
                    toast("Percentage must be between 1 and 100"); return@setPositiveButton
                }
                if (start > end) { toast("End date must be after start date"); return@setPositiveButton }

                val itemsList = if (selectedItemIds.isEmpty()) null else selectedItemIds.toList()

                val body = CreatePromotionRequest(code, type, value, start, end, cbActive.isChecked, itemsList)
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        if (promo == null) ApiClient.adminApi.createPromotion(ApiClient.bearerToken(), body)
                        else               ApiClient.adminApi.updatePromotion(ApiClient.bearerToken(), promo.id, body)
                        toast(if (promo == null) "Promotion created" else "Promotion updated")
                        loadPromotions()
                    } catch (e: HttpException) {
                        val msg = runCatching { e.response()?.errorBody()?.string() }.getOrNull()
                        toast("Error: ${msg ?: e.message()}")
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null).show()
    }

    private fun confirmDelete(promo: Promotion) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete Promotion")
            .setMessage("Delete code \"${promo.code}\"? This cannot be undone.")
            .setPositiveButton("Delete") { _, _ ->
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        ApiClient.adminApi.deletePromotion(ApiClient.bearerToken(), promo.id)
                        toast("Promotion deleted")
                        loadPromotions()
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null).show()
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
