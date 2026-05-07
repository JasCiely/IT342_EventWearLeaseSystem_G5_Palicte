package com.backend.service.impl;

import com.backend.dto.request.CreateStaffRequest;
import com.backend.dto.request.UpdateStaffRequest;
import com.backend.dto.response.StaffPageResponse;
import com.backend.dto.response.StaffResponse;
import com.backend.entity.SalarySettings;
import com.backend.entity.Staff;
import com.backend.repository.SalarySettingsRepository;
import com.backend.repository.StaffRepository;
import com.backend.service.StaffService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class StaffServiceImpl implements StaffService {

    private static final String DEFAULT_PASSWORD = "EventWear@123";
    private static final String ON_DUTY = "On Duty";
    private static final String OFF_DUTY = "Off Duty";
    private static final int DEFAULT_DAILY_RATE = 300;

    private final StaffRepository staffRepository;
    private final SalarySettingsRepository salarySettingsRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public StaffResponse createStaff(CreateStaffRequest request) {
        String email = request.getEmail().toLowerCase().trim();
        if (staffRepository.existsByEmailAndDeletedAtIsNull(email)) {
            throw new IllegalArgumentException("Staff already exists with email: " + email);
        }

        validateStatus(request.getStatus());
        validateCustomRate(request.getCustomRate());

        Staff staff = new Staff();
        staff.setFullName(request.getFullName().trim());
        staff.setEmail(email);
        staff.setRole(request.getRole().trim());
        staff.setStatus(normalizeStatus(request.getStatus()));
        staff.setDaysWorked(0);
        staff.setCustomRate(request.getCustomRate());
        staff.setPassword(passwordEncoder.encode(DEFAULT_PASSWORD));

        Staff saved = staffRepository.save(staff);
        return buildStaffResponse(saved);
    }

    @Override
    public StaffPageResponse getStaff(int page, int size, String search, String status) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim();
        String normalizedStatus = status == null || status.isBlank() ? null : status.trim();

        Page<Staff> staffPage = staffRepository.searchFiltered(normalizedSearch, normalizedStatus, pageable);
        List<StaffResponse> content = staffPage.stream()
                .map(this::buildStaffResponse)
                .collect(Collectors.toList());

        return new StaffPageResponse(
                content,
                staffPage.getNumber(),
                staffPage.getSize(),
                staffPage.getTotalElements(),
                staffPage.getTotalPages());
    }

    @Override
    public StaffResponse getStaffById(String id) {
        Staff staff = staffRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new IllegalArgumentException("Staff not found with id: " + id));
        return buildStaffResponse(staff);
    }

    @Override
    public StaffResponse updateStaff(String id, UpdateStaffRequest request) {
        Staff staff = staffRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new IllegalArgumentException("Staff not found with id: " + id));

        validateStatus(request.getStatus());

        staff.setFullName(request.getFullName().trim());
        staff.setRole(request.getRole().trim());
        staff.setStatus(normalizeStatus(request.getStatus()));
        staff.setCustomRate(request.getCustomRate());

        Staff updated = staffRepository.save(staff);
        return buildStaffResponse(updated);
    }

    @Override
    public void deleteStaff(String id) {
        Staff staff = staffRepository.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new IllegalArgumentException("Staff not found with id: " + id));
        staff.softDelete();
        staffRepository.save(staff);
    }

    private StaffResponse buildStaffResponse(Staff staff) {
        return StaffResponse.from(staff, getActiveDailyRate());
    }

    private int getActiveDailyRate() {
        return salarySettingsRepository.findFirstByOrderByCreatedAtDesc()
                .map(SalarySettings::getDefaultDailyRate)
                .orElse(DEFAULT_DAILY_RATE);
    }

    private void validateStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new IllegalArgumentException("Status is required");
        }
        String normalized = status.trim();
        if (!normalized.equalsIgnoreCase(ON_DUTY) && !normalized.equalsIgnoreCase(OFF_DUTY)) {
            throw new IllegalArgumentException("Status must be either 'On Duty' or 'Off Duty'");
        }
    }

    private void validateCustomRate(Double customRate) {
        if (customRate != null && customRate < 0) {
            throw new IllegalArgumentException("Custom rate cannot be negative");
        }
    }

    private String normalizeStatus(String status) {
        String trimmed = status.trim();
        if (trimmed.equalsIgnoreCase(ON_DUTY)) {
            return ON_DUTY;
        }
        return OFF_DUTY;
    }
}
