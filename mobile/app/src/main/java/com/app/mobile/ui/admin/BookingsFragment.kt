package com.app.mobile.ui.admin

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.app.mobile.databinding.FragmentBookingsBinding
import com.google.android.material.tabs.TabLayoutMediator

class BookingsFragment : Fragment() {

    private var _binding: FragmentBookingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentBookingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.viewPager.adapter = object : FragmentStateAdapter(this) {
            override fun getItemCount() = 2
            override fun createFragment(position: Int): Fragment =
                if (position == 0) FittingBookingsFragment() else DirectBookingsFragment()
        }

        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, pos ->
            tab.text = if (pos == 0) "Fitting" else "Direct Lease"
        }.attach()

        binding.fabNewBooking.setOnClickListener {
            val dialog = CreateBookingDialogFragment()
            dialog.onSuccess = {
                childFragmentManager.fragments.forEach { f ->
                    when (f) {
                        is FittingBookingsFragment -> f.reload()
                        is DirectBookingsFragment  -> f.reload()
                    }
                }
            }
            dialog.show(childFragmentManager, "create_booking")
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
