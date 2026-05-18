package com.app.mobile.ui.admin

import android.app.DatePickerDialog
import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.app.mobile.ApiClient
import com.app.mobile.AdminDashboardActivity
import com.app.mobile.R
import com.app.mobile.adapters.PromotionAdapter
import com.app.mobile.databinding.FragmentPromotionsBinding
import com.app.mobile.models.CreatePromotionRequest
import com.app.mobile.models.Promotion
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
        AlertDialog.Builder(requireContext())
            .setTitle(promo.code)
            .setMessage("${promo.type.replaceFirstChar { it.uppercase() }} | ${if (promo.type == "percentage") "${promo.value}%" else "₱${promo.value}"}\n${promo.startDate} → ${promo.endDate}\nActive: ${promo.active}")
            .setItems(arrayOf("Edit", "Delete")) { _, idx ->
                if (idx == 0) showPromoDialog(promo) else confirmDelete(promo)
            }
            .setNegativeButton("Close", null).show()
    }

    private fun showPromoDialog(promo: Promotion?) {
        val view = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_promotion, null)
        val etCode      = view.findViewById<EditText>(R.id.etCode)
        val spType      = view.findViewById<Spinner>(R.id.spType)
        val etValue     = view.findViewById<EditText>(R.id.etValue)
        val etStart     = view.findViewById<EditText>(R.id.etStartDate)
        val etEnd       = view.findViewById<EditText>(R.id.etEndDate)
        val cbActive    = view.findViewById<CheckBox>(R.id.cbActive)

        val types = arrayOf("percentage", "flat")
        spType.adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, types)

        promo?.let {
            etCode.setText(it.code)
            spType.setSelection(types.indexOf(it.type).coerceAtLeast(0))
            etValue.setText(it.value.toString())
            etStart.setText(it.startDate)
            etEnd.setText(it.endDate)
            cbActive.isChecked = it.active
        } ?: run { cbActive.isChecked = true }

        fun pickDate(et: EditText) {
            val cal = Calendar.getInstance()
            DatePickerDialog(requireContext(), { _, y, m, d ->
                et.setText("$y-${"%02d".format(m + 1)}-${"%02d".format(d)}")
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
        }
        etStart.setOnClickListener { pickDate(etStart) }
        etEnd.setOnClickListener { pickDate(etEnd) }

        AlertDialog.Builder(requireContext())
            .setTitle(if (promo == null) "Add Promotion" else "Edit Promotion")
            .setView(view)
            .setPositiveButton(if (promo == null) "Add" else "Save") { _, _ ->
                val code  = etCode.text.toString().trim()
                val type  = spType.selectedItem.toString()
                val value = etValue.text.toString().toDoubleOrNull()
                val start = etStart.text.toString().trim()
                val end   = etEnd.text.toString().trim()
                if (code.isEmpty() || value == null || start.isEmpty() || end.isEmpty()) {
                    toast("Fill all required fields"); return@setPositiveButton
                }
                val body = CreatePromotionRequest(code, type, value, start, end, cbActive.isChecked, null)
                viewLifecycleOwner.lifecycleScope.launch {
                    try {
                        if (promo == null) ApiClient.adminApi.createPromotion(ApiClient.bearerToken(), body)
                        else ApiClient.adminApi.updatePromotion(ApiClient.bearerToken(), promo.id, body)
                        toast(if (promo == null) "Promotion created" else "Promotion updated")
                        loadPromotions()
                    } catch (_: Exception) { toast(getString(R.string.error_network)) }
                }
            }
            .setNegativeButton("Cancel", null).show()
    }

    private fun confirmDelete(promo: Promotion) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete Promotion")
            .setMessage("Delete code \"${promo.code}\"?")
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
