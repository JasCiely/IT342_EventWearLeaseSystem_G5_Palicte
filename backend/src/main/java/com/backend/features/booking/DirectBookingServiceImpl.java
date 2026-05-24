package com.backend.features.booking;

import com.backend.features.booking.dto.request.AdminDirectBookingRequest;
import com.backend.features.booking.dto.request.DirectBookingRequest;
import com.backend.features.booking.dto.response.DirectBookingResponse;
import com.backend.features.booking.settings.BookingTimeSettingsService;
import com.backend.features.booking.settings.dto.BookingTimeSettingsDto;
import com.backend.features.inventory.InventorySettingsService;
import com.backend.features.inventory.ItemRepository;
import com.backend.features.inventory.dto.response.InventorySettingsResponse;
import com.backend.shared.entity.DirectBooking;
import com.backend.shared.entity.Item;
import com.backend.shared.email.EmailService;
import com.backend.shared.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DirectBookingServiceImpl implements DirectBookingService {

    private final DirectBookingRepository directBookingRepository;
    private final ItemRepository itemRepository;
    private final EmailService emailService;
    private final UserRepository userRepository;
    private final BookingTimeSettingsService settingsService;
    private final InventorySettingsService inventorySettingsService;

    // ── Public customer-facing creation (enforces 2-day advance booking rule) ──

    @Override
    @Transactional
    public DirectBookingResponse createDirectBooking(String userId, DirectBookingRequest request) {
        log.info("Creating direct booking for user {} and item {}", userId, request.getInventoryItemId());

        // Leasing bookings must be made at least 2 days before the pickup date.
        if (request.getStartDate().isBefore(LocalDate.now().plusDays(2))) {
            throw new IllegalArgumentException(
                    "Leasing bookings must be made at least 2 days before the pickup date. Same-day and next-day bookings are not allowed.");
        }

        return createBookingInternal(userId, request, "Pending");
    }

    // ── Admin creation bypasses the 2-day advance rule ──

    @Override
    @Transactional
    public DirectBookingResponse createDirectBookingForCustomer(AdminDirectBookingRequest req) {
        String userId = userRepository.findByEmail(req.getCustomerEmail())
                .map(u -> u.getId())
                .orElse(req.getCustomerEmail());

        DirectBookingRequest request = new DirectBookingRequest();
        request.setInventoryItemId(req.getItemId());
        request.setItemName(req.getItemName());
        request.setStartDate(req.getStartDate());
        request.setEndDate(req.getEndDate());
        request.setBasePrice(req.getBasePrice());
        request.setDiscountAmount(req.getDiscountAmount());
        request.setFinalPrice(req.getFinalPrice());
        request.setNotes(req.getNotes());
        request.setCustomerName(req.getCustomerName());
        request.setCustomerEmail(req.getCustomerEmail());
        request.setCustomerPhone(req.getCustomerPhone());
        request.setPreferredSize(req.getPreferredSize());

        // Admin-created bookings skip the 2-day advance rule and go straight to Approved.
        return createBookingInternal(userId, request, "Approved");
    }

    // ── Shared internal booking creation (no advance-booking-rule check here) ──

    private DirectBookingResponse createBookingInternal(String userId, DirectBookingRequest request, String initialStatus) {
        if (request.getStartDate().isAfter(request.getEndDate())) {
            throw new IllegalArgumentException("Start date cannot be after end date");
        }

        if (request.getCustomerName() == null || request.getCustomerName().trim().isEmpty()) {
            throw new IllegalArgumentException("Customer name is required");
        }
        if (request.getCustomerEmail() == null || request.getCustomerEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Customer email is required");
        }
        if (request.getCustomerPhone() == null || request.getCustomerPhone().trim().isEmpty()) {
            throw new IllegalArgumentException("Customer phone is required");
        }

        if (!isItemAvailable(request.getInventoryItemId(), request.getStartDate(), request.getEndDate())) {
            throw new IllegalArgumentException("Item is not available for the selected dates");
        }

        // Validate and coerce preferredSize based on item's available sizes
        Item bookingItem = itemRepository.findById(request.getInventoryItemId())
                .orElseThrow(() -> new IllegalArgumentException("Item not found"));
        List<String> itemSizes = parseSizeList(bookingItem.getSize());
        if (itemSizes.size() > 1) {
            String reqSize = request.getPreferredSize() != null ? request.getPreferredSize().trim() : null;
            if (reqSize == null || reqSize.isEmpty()) {
                throw new IllegalArgumentException("A size must be selected for this item. Available sizes: " + String.join(", ", itemSizes));
            }
            if (!itemSizes.contains(reqSize)) {
                throw new IllegalArgumentException("Invalid size '" + reqSize + "'. Choose from: " + String.join(", ", itemSizes));
            }
            request.setPreferredSize(reqSize);
        } else if (itemSizes.size() == 1) {
            request.setPreferredSize(itemSizes.get(0));
        } else {
            request.setPreferredSize(null);
        }

        int totalDays = (int) ChronoUnit.DAYS.between(request.getStartDate(), request.getEndDate()) + 1;

        if (request.getBasePrice() == null || request.getBasePrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Base price must be greater than zero");
        }

        if (request.getDiscountAmount() == null) {
            request.setDiscountAmount(BigDecimal.ZERO);
        }

        if (request.getFinalPrice() == null) {
            request.setFinalPrice(request.getBasePrice().subtract(request.getDiscountAmount()));
        }

        DirectBooking booking = new DirectBooking();
        booking.setUserId(userId);
        booking.setInventoryItemId(request.getInventoryItemId());
        booking.setStartDate(request.getStartDate());
        booking.setEndDate(request.getEndDate());
        booking.setTotalDays(totalDays);
        booking.setBasePrice(request.getBasePrice());
        booking.setDiscountAmount(request.getDiscountAmount());
        booking.setFinalPrice(request.getFinalPrice());
        booking.setNotes(request.getNotes());
        booking.setBookingStatus(initialStatus);
        booking.setCustomerName(request.getCustomerName());
        booking.setCustomerEmail(request.getCustomerEmail());
        booking.setCustomerPhone(request.getCustomerPhone());
        booking.setPreferredSize(request.getPreferredSize());
        booking.setItemName(request.getItemName() != null ? request.getItemName() : "");

        DirectBooking savedBooking = directBookingRepository.save(booking);
        log.info("Booking created with ID {} and status {}", savedBooking.getId(), initialStatus);

        try {
            emailService.sendDirectBookingConfirmation(
                    savedBooking.getCustomerEmail(),
                    savedBooking.getCustomerName(),
                    savedBooking.getId(),
                    savedBooking.getItemName(),
                    savedBooking.getStartDate().toString(),
                    savedBooking.getEndDate().toString(),
                    savedBooking.getTotalDays(),
                    savedBooking.getFinalPrice());
        } catch (Exception e) {
            log.warn("Failed to send confirmation email for booking {}: {}", savedBooking.getId(), e.getMessage());
        }

        return mapToResponse(savedBooking);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    @Override
    public Page<DirectBookingResponse> getUserBookings(String userId, Pageable pageable) {
        return directBookingRepository.findByUserId(userId, pageable)
                .map(this::mapToResponse);
    }

    @Override
    public Page<DirectBookingResponse> getAllBookings(Pageable pageable) {
        return directBookingRepository.findAll(pageable)
                .map(this::mapToResponse);
    }

    @Override
    public DirectBookingResponse getBookingById(String bookingId) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        return mapToResponse(booking);
    }

    // ── Status machine ────────────────────────────────────────────────────────

    @Override
    @Transactional
    public DirectBookingResponse updateBookingStatus(String bookingId, String status) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        String oldStatus = booking.getBookingStatus();

        if ("Active Lease".equals(status)) {
            throw new IllegalStateException("Use the pickup endpoint to activate the lease.");
        }
        if ("Approved".equals(status) && !"Pending".equals(oldStatus)) {
            throw new IllegalStateException("Only Pending bookings can be approved");
        }
        if ("Rejected".equals(status) && !"Pending".equals(oldStatus)) {
            throw new IllegalStateException("Only Pending bookings can be rejected");
        }
        if ("Cancelled".equals(status) && !"Pending".equals(oldStatus) && !"Approved".equals(oldStatus)) {
            throw new IllegalStateException("Only Pending or Approved bookings can be cancelled (before pickup)");
        }
        if ("Returned".equals(status) || "Completed".equals(status)) {
            throw new IllegalStateException("Use the dedicated return endpoint for this operation");
        }

        booking.setBookingStatus(status);
        DirectBooking updatedBooking = directBookingRepository.save(booking);
        log.info("Updated booking {} status from {} to {}", bookingId, oldStatus, status);

        try {
            if ("Approved".equals(status) || "Rejected".equals(status)) {
                emailService.sendDirectBookingStatusUpdate(
                        updatedBooking.getCustomerEmail(),
                        updatedBooking.getCustomerName(),
                        updatedBooking.getItemName(),
                        status,
                        updatedBooking.getId());
            }
        } catch (Exception e) {
            log.warn("Failed to send status update email for booking {}: {}", bookingId, e.getMessage());
        }

        return mapToResponse(updatedBooking);
    }

    // ── Availability (buffer-aware) ───────────────────────────────────────────

    @Override
    public boolean isItemAvailable(String itemId, LocalDate startDate, LocalDate endDate) {
        if (!isItemStatusAvailable(itemId)) return false;
        // Checks whether [startDate, endDate] overlaps with any existing booking's effective
        // range [existingStart, existingEnd + 2 maintenance days].
        return !directBookingRepository.hasOverlappingBookingsWithBuffer(
                itemId, startDate.minusDays(2), endDate);
    }

    @Override
    public boolean isItemAvailableExcluding(String itemId, LocalDate startDate, LocalDate endDate, String excludeBookingId) {
        return !directBookingRepository.hasOverlappingBookingsExcludingWithBuffer(
                itemId, startDate.minusDays(2), endDate, excludeBookingId);
    }

    private boolean isItemStatusAvailable(String itemId) {
        return itemRepository.findById(itemId)
                .map(item -> "Available".equals(item.getStatus()))
                .orElse(false);
    }

    // ── Return / complete ─────────────────────────────────────────────────────

    @Override
    @Transactional
    public DirectBookingResponse returnAndCompleteLease(String bookingId) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!"Active Lease".equals(booking.getBookingStatus())) {
            throw new IllegalArgumentException("Only active leases can be returned");
        }

        booking.setBookingStatus("Returned");
        directBookingRepository.save(booking);

        booking.setBookingStatus("Completed");
        DirectBooking completed = directBookingRepository.save(booking);

        // Trigger 2-day maintenance unconditionally after return
        itemRepository.findById(completed.getInventoryItemId()).ifPresent(item -> {
            item.setStatus("Under Maintenance");
            item.setMaintenanceEndDate(LocalDate.now().plusDays(2));
            itemRepository.save(item);
            log.info("Item {} set to Under Maintenance until {}", item.getId(), item.getMaintenanceEndDate());
        });

        log.info("Lease {} returned and completed", bookingId);

        try {
            emailService.sendLeaseCompletedEmail(
                    completed.getCustomerEmail(),
                    completed.getCustomerName(),
                    completed.getItemName(),
                    completed.getId());
        } catch (Exception e) {
            log.warn("Failed to send lease completed email for booking {}: {}", bookingId, e.getMessage());
        }

        return mapToResponse(completed);
    }

    // ── Extend lease ──────────────────────────────────────────────────────────

    @Override
    @Transactional
    public DirectBookingResponse extendLease(String bookingId, LocalDate newEndDate) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!"Active Lease".equals(booking.getBookingStatus())) {
            throw new IllegalArgumentException("Only active leases can be extended");
        }

        if (!newEndDate.isAfter(booking.getEndDate())) {
            throw new IllegalArgumentException("New end date must be after current end date");
        }

        LocalDate extensionStart = booking.getEndDate().plusDays(1);

        // Check that the extension window [extensionStart, newEndDate] is free of other bookings.
        if (directBookingRepository.hasOverlappingBookingsExcluding(
                booking.getInventoryItemId(),
                extensionStart,
                newEndDate,
                bookingId)) {
            throw new IllegalArgumentException("The selected extension dates conflict with another booking");
        }

        // Also protect the new 2-day maintenance buffer [newEndDate+1, newEndDate+2].
        if (directBookingRepository.hasOverlappingBookingsExcluding(
                booking.getInventoryItemId(),
                newEndDate.plusDays(1),
                newEndDate.plusDays(2),
                bookingId)) {
            throw new IllegalArgumentException(
                    "Cannot extend to that date — a booking is scheduled during the required 2-day maintenance window after the new return date");
        }

        LocalDate oldEndDate = booking.getEndDate();
        int newTotalDays = (int) ChronoUnit.DAYS.between(booking.getStartDate(), newEndDate) + 1;

        // Recalculate base price using daily rate, then re-derive discount from new duration
        if (booking.getBasePrice() != null && booking.getTotalDays() != null && booking.getTotalDays() > 0) {
            BigDecimal dailyRate = booking.getBasePrice()
                    .divide(BigDecimal.valueOf(booking.getTotalDays()), 4, RoundingMode.HALF_UP);
            BigDecimal newBasePrice = dailyRate.multiply(BigDecimal.valueOf(newTotalDays))
                    .setScale(2, RoundingMode.HALF_UP);

            InventorySettingsResponse settings = inventorySettingsService.getSettings();
            int weeks = newTotalDays / 7;
            BigDecimal weeklyDiscountAmount = BigDecimal.valueOf((long) weeks * settings.getWeeklyDiscount());
            BigDecimal monthlyDiscountCap = BigDecimal.valueOf(settings.getMonthlyDiscountCap());
            BigDecimal newDiscount = weeklyDiscountAmount.min(monthlyDiscountCap);

            booking.setBasePrice(newBasePrice);
            booking.setDiscountAmount(newDiscount);
            booking.setFinalPrice(newBasePrice.subtract(newDiscount).setScale(2, RoundingMode.HALF_UP));
        }

        booking.setEndDate(newEndDate);
        booking.setTotalDays(newTotalDays);
        booking.setExtended(true);

        DirectBooking updated = directBookingRepository.save(booking);
        log.info("Lease {} extended from {} to {}", bookingId, oldEndDate, newEndDate);

        return mapToResponse(updated);
    }

    // ── Unavailable date ranges (calendar feed) ───────────────────────────────

    @Override
    public List<Map<String, String>> getUnavailableDateRanges(String itemId, String excludeBookingId) {
        List<DirectBooking> active = directBookingRepository.findActiveBookingsForItem(itemId, excludeBookingId);
        List<Map<String, String>> ranges = new ArrayList<>();

        for (DirectBooking b : active) {
            // Booking's own date range
            Map<String, String> range = new HashMap<>();
            range.put("startDate", b.getStartDate().toString());
            range.put("endDate", b.getEndDate().toString());
            range.put("status", b.getBookingStatus());
            ranges.add(range);

            // 2-day maintenance buffer after each confirmed booking
            // Approved and Active Lease bookings produce a hard block ("Under Maintenance").
            // Pending bookings produce a soft block (kept as "Pending") so the frontend can
            // distinguish and prompt the customer before proceeding.
            String bufferStatus = ("Approved".equals(b.getBookingStatus()) || "Active Lease".equals(b.getBookingStatus()))
                    ? "Under Maintenance"
                    : "Pending";
            Map<String, String> buffer = new HashMap<>();
            buffer.put("startDate", b.getEndDate().plusDays(1).toString());
            buffer.put("endDate", b.getEndDate().plusDays(2).toString());
            buffer.put("status", bufferStatus);
            ranges.add(buffer);
        }

        // Current item-level maintenance (set when a lease is returned)
        itemRepository.findById(itemId).ifPresent(item -> {
            if ("Under Maintenance".equals(item.getStatus()) && item.getMaintenanceEndDate() != null) {
                Map<String, String> maintenanceRange = new HashMap<>();
                maintenanceRange.put("startDate", LocalDate.now().toString());
                maintenanceRange.put("endDate", item.getMaintenanceEndDate().toString());
                maintenanceRange.put("status", "Under Maintenance");
                ranges.add(maintenanceRange);
            }
        });

        return ranges;
    }

    // ── Customer date edit ────────────────────────────────────────────────────

    @Override
    @Transactional
    public DirectBookingResponse editCustomerBookingDates(String bookingId, String userId, LocalDate startDate, LocalDate endDate) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!booking.getUserId().equals(userId)) {
            throw new SecurityException("You are not allowed to edit this booking");
        }

        String status = booking.getBookingStatus();
        if (!"Pending".equals(status) && !"Approved".equals(status) && !"Active Lease".equals(status)) {
            throw new IllegalStateException("Only Pending, Approved, or Active Lease bookings can be edited");
        }

        // Active Lease: start date is locked (item already picked up)
        if ("Active Lease".equals(status)) {
            startDate = booking.getStartDate();
        } else {
            // Pending / Approved: enforce 2-day advance booking rule on new start date
            if (startDate.isBefore(LocalDate.now().plusDays(2))) {
                throw new IllegalArgumentException(
                        "Leasing bookings must be made at least 2 days before the pickup date. Same-day and next-day bookings are not allowed.");
            }
        }

        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("Start date cannot be after end date");
        }

        if (endDate.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("End date cannot be in the past");
        }

        // Buffer-aware overlap check (excludes self)
        if (directBookingRepository.hasOverlappingBookingsExcludingWithBuffer(
                booking.getInventoryItemId(), startDate.minusDays(2), endDate, bookingId)) {
            throw new IllegalArgumentException("Item is not available for the selected dates");
        }

        int newTotalDays = (int) ChronoUnit.DAYS.between(startDate, endDate) + 1;

        if (booking.getBasePrice() != null && booking.getTotalDays() != null && booking.getTotalDays() > 0) {
            BigDecimal dailyRate = booking.getBasePrice()
                    .divide(BigDecimal.valueOf(booking.getTotalDays()), 4, RoundingMode.HALF_UP);
            BigDecimal newBasePrice = dailyRate.multiply(BigDecimal.valueOf(newTotalDays))
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal discount = booking.getDiscountAmount() != null ? booking.getDiscountAmount() : BigDecimal.ZERO;
            booking.setBasePrice(newBasePrice);
            booking.setFinalPrice(newBasePrice.subtract(discount).setScale(2, RoundingMode.HALF_UP));
        }

        booking.setStartDate(startDate);
        booking.setEndDate(endDate);
        booking.setTotalDays(newTotalDays);

        DirectBooking updated = directBookingRepository.save(booking);
        log.info("Customer {} edited booking {} dates to {} - {}", userId, bookingId, startDate, endDate);

        return mapToResponse(updated);
    }

    // ── Admin date edit ───────────────────────────────────────────────────────

    @Override
    @Transactional
    public DirectBookingResponse updateDirectBookingDates(String bookingId, LocalDate startDate, LocalDate endDate) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        String status = booking.getBookingStatus();
        if (!"Pending".equals(status) && !"Approved".equals(status)) {
            throw new IllegalStateException("Dates can only be edited for Pending or Approved bookings");
        }

        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("Start date cannot be after end date");
        }

        // Buffer-aware overlap check (excludes self)
        if (directBookingRepository.hasOverlappingBookingsExcludingWithBuffer(
                booking.getInventoryItemId(), startDate.minusDays(2), endDate, bookingId)) {
            throw new IllegalArgumentException("Item is not available for the selected dates");
        }

        int newTotalDays = (int) ChronoUnit.DAYS.between(startDate, endDate) + 1;

        if (booking.getBasePrice() != null && booking.getTotalDays() != null && booking.getTotalDays() > 0) {
            BigDecimal dailyRate = booking.getBasePrice()
                    .divide(BigDecimal.valueOf(booking.getTotalDays()), 4, RoundingMode.HALF_UP);
            BigDecimal newBasePrice = dailyRate.multiply(BigDecimal.valueOf(newTotalDays))
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal discount = booking.getDiscountAmount() != null ? booking.getDiscountAmount() : BigDecimal.ZERO;
            booking.setBasePrice(newBasePrice);
            booking.setFinalPrice(newBasePrice.subtract(discount).setScale(2, RoundingMode.HALF_UP));
        }

        booking.setStartDate(startDate);
        booking.setEndDate(endDate);
        booking.setTotalDays(newTotalDays);

        DirectBooking updated = directBookingRepository.save(booking);
        log.info("Booking {} dates updated to {} – {}", bookingId, startDate, endDate);

        return mapToResponse(updated);
    }

    // ── Auto-expire approved bookings ─────────────────────────────────────────

    @Override
    @Transactional
    public void autoExpireApprovedBookings() {
        BookingTimeSettingsDto settings = settingsService.getSettings();
        LocalDateTime now = LocalDateTime.now();

        List<DirectBooking> candidates = directBookingRepository.findApprovedBookingsToActivate(LocalDate.now());
        for (DirectBooking booking : candidates) {
            LocalDateTime pickupDeadline;
            if (settings.isEnableTimeRestrictions()) {
                try {
                    LocalTime closeTime = LocalTime.parse(settings.getShopCloseTime());
                    pickupDeadline = LocalDateTime.of(booking.getStartDate(), closeTime);
                } catch (Exception e) {
                    pickupDeadline = booking.getStartDate().plusDays(1).atStartOfDay();
                }
            } else {
                pickupDeadline = booking.getStartDate().plusDays(1).atStartOfDay();
            }

            if (!now.isBefore(pickupDeadline)) {
                booking.setBookingStatus("Cancelled");
                directBookingRepository.save(booking);
                log.info("Auto-cancelled booking {} — pickup deadline {} passed", booking.getId(), pickupDeadline);
                try {
                    emailService.sendDirectBookingCancellation(
                            booking.getCustomerEmail(), booking.getCustomerName(),
                            booking.getItemName(), booking.getId());
                } catch (Exception e) {
                    log.warn("Failed to send auto-expiry email for booking {}: {}", booking.getId(), e.getMessage());
                }
            }
        }
    }

    // ── Pickup ────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public DirectBookingResponse markPickedUp(String bookingId) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!"Approved".equals(booking.getBookingStatus())) {
            throw new IllegalStateException("Only approved bookings can be marked as picked up");
        }

        LocalDate today = LocalDate.now();
        if (!today.equals(booking.getStartDate())) {
            throw new IllegalStateException("Item can only be picked up on the scheduled pickup date (" + booking.getStartDate() + ")");
        }

        booking.setBookingStatus("Active Lease");
        DirectBooking updated = directBookingRepository.save(booking);
        log.info("Booking {} marked as picked up — lease is now active", bookingId);
        return mapToResponse(updated);
    }

    @Override
    @Transactional
    public DirectBookingResponse undoPickup(String bookingId) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!"Active Lease".equals(booking.getBookingStatus())) {
            throw new IllegalStateException("Only Active Lease bookings can be reset to Approved");
        }

        booking.setBookingStatus("Approved");
        DirectBooking updated = directBookingRepository.save(booking);
        log.info("Booking {} reset from Active Lease back to Approved (undo pickup)", bookingId);
        return mapToResponse(updated);
    }

    private List<String> parseSizeList(String csv) {
        if (csv == null || csv.isBlank()) return new ArrayList<>();
        List<String> result = new ArrayList<>();
        for (String s : csv.split(",")) {
            String t = s.trim();
            if (!t.isEmpty()) result.add(t);
        }
        return result;
    }

    // ── Email resend ──────────────────────────────────────────────────────────

    @Override
    public void resendDirectBookingConfirmationEmail(String bookingId) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        emailService.sendDirectBookingConfirmation(
                booking.getCustomerEmail(), booking.getCustomerName(),
                booking.getId(), booking.getItemName(),
                booking.getStartDate().toString(), booking.getEndDate().toString(),
                booking.getTotalDays(), booking.getFinalPrice());
    }

    // ── Lists ─────────────────────────────────────────────────────────────────

    @Override
    public List<DirectBookingResponse> getAllUserBookingsList(String userId) {
        Pageable unlimited = Pageable.unpaged();
        Page<DirectBooking> page = directBookingRepository.findByUserId(userId, unlimited);
        return page.getContent().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public void cancelDirectBooking(String bookingId, String userId) {
        DirectBooking booking = directBookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (!booking.getUserId().equals(userId)) {
            throw new SecurityException("You are not allowed to cancel this booking");
        }

        String status = booking.getBookingStatus();
        if (!"Pending".equals(status) && !"Approved".equals(status)) {
            throw new IllegalStateException("Only pending or approved bookings can be cancelled");
        }

        booking.setBookingStatus("Cancelled");
        directBookingRepository.save(booking);
        log.info("Direct booking {} cancelled by customer {}", bookingId, userId);

        try {
            emailService.sendDirectBookingCancellation(
                    booking.getCustomerEmail(),
                    booking.getCustomerName(),
                    booking.getItemName(),
                    booking.getId());
        } catch (Exception e) {
            log.warn("Failed to send cancellation email for direct booking {}: {}", bookingId, e.getMessage());
        }
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private DirectBookingResponse mapToResponse(DirectBooking booking) {
        DirectBookingResponse response = new DirectBookingResponse();
        response.setId(booking.getId());
        response.setUserId(booking.getUserId());
        response.setInventoryItemId(booking.getInventoryItemId());
        response.setItemName(booking.getItemName());
        response.setBookingType(booking.getBookingType());
        response.setStartDate(booking.getStartDate());
        response.setEndDate(booking.getEndDate());
        response.setTotalDays(booking.getTotalDays());
        response.setBasePrice(booking.getBasePrice());
        response.setDiscountAmount(booking.getDiscountAmount());
        response.setFinalPrice(booking.getFinalPrice());
        response.setBookingStatus(booking.getBookingStatus());
        response.setNotes(booking.getNotes());
        response.setCreatedAt(booking.getCreatedAt());
        response.setUpdatedAt(booking.getUpdatedAt());
        response.setCustomerName(booking.getCustomerName());
        response.setCustomerEmail(booking.getCustomerEmail());
        response.setCustomerPhone(booking.getCustomerPhone());
        response.setPreferredSize(booking.getPreferredSize());
        response.setExtended(booking.isExtended());
        return response;
    }
}
