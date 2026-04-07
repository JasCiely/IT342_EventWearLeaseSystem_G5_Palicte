package com.backend.controller;

import com.backend.dto.request.FittingBookingRequest;
import com.backend.dto.request.ItemRequest;
import com.backend.dto.request.PromotionRequest;
import com.backend.dto.response.FittingBookingResponse;
import com.backend.dto.response.ItemResponse;
import com.backend.dto.response.PromotionResponse;
import com.backend.entity.Booking;
import com.backend.service.BookingService;
import com.backend.service.EmailService;
import com.backend.service.InventoryService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/inventory")
@CrossOrigin(origins = "${app.cors.origin:http://localhost:5173}")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;
    private final EmailService emailService;
    private final ObjectMapper objectMapper;
    private final BookingService bookingService;

    // ── Items (public GET, ADMIN write) ─────────────────────

    @GetMapping("/items")
    public ResponseEntity<List<ItemResponse>> getAllItems() {
        return ResponseEntity.ok(inventoryService.getAllItems());
    }

    @GetMapping("/items/{id}")
    public ResponseEntity<ItemResponse> getItem(@PathVariable String id) {
        return ResponseEntity.ok(inventoryService.getItem(id));
    }

    @PostMapping("/items")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ItemResponse> createItem(
            @RequestPart("data") String dataJson,
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        try {
            ItemRequest request = objectMapper.readValue(dataJson, ItemRequest.class);
            return new ResponseEntity<>(inventoryService.createItem(request, files), HttpStatus.CREATED);
        } catch (Exception e) {
            log.error("Create item error: {}", e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
    }

    @PutMapping("/items/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ItemResponse> updateItem(
            @PathVariable String id,
            @RequestPart("data") String dataJson,
            @RequestPart(value = "files", required = false) List<MultipartFile> newFiles,
            @RequestPart(value = "keepUrls", required = false) String keepUrlsJson) {
        try {
            ItemRequest request = objectMapper.readValue(dataJson, ItemRequest.class);
            List<String> keepUrls = keepUrlsJson != null
                    ? objectMapper.readValue(keepUrlsJson,
                            objectMapper.getTypeFactory().constructCollectionType(List.class, String.class))
                    : List.of();
            return ResponseEntity.ok(inventoryService.updateItem(id, request, newFiles, keepUrls));
        } catch (Exception e) {
            log.error("Update item error: {}", e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
    }

    @DeleteMapping("/items/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteItem(@PathVariable String id) {
        inventoryService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }

    // ── Promotions (public GET, ADMIN write) ─────────────────

    @GetMapping("/promotions")
    public ResponseEntity<List<PromotionResponse>> getAllPromotions() {
        return ResponseEntity.ok(inventoryService.getAllPromotions());
    }

    @PostMapping("/promotions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PromotionResponse> createPromotion(
            @RequestBody PromotionRequest request) {
        return new ResponseEntity<>(inventoryService.createPromotion(request), HttpStatus.CREATED);
    }

    @PutMapping("/promotions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PromotionResponse> updatePromotion(
            @PathVariable String id,
            @RequestBody PromotionRequest request) {
        return ResponseEntity.ok(inventoryService.updatePromotion(id, request));
    }

    @DeleteMapping("/promotions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deletePromotion(@PathVariable String id) {
        inventoryService.deletePromotion(id);
        return ResponseEntity.noContent().build();
    }

    // ── Fitting Booking (authenticated users) ─────────────────

    @PostMapping("/book-fitting")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<FittingBookingResponse> bookFitting(
            @RequestBody FittingBookingRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        log.info("Booking fitting for user: {}", userDetails.getUsername());

        // Set customer email from authenticated user if not provided
        if (request.getCustomerEmail() == null || request.getCustomerEmail().isEmpty()) {
            request.setCustomerEmail(userDetails.getUsername());
        }

        FittingBookingResponse response = bookingService.createBooking(request);

        if ("FAILED".equals(response.getStatus())) {
            return ResponseEntity.badRequest().body(response);
        }

        return ResponseEntity.ok(response);
    }

    // Add this new endpoint to get user's bookings
    @GetMapping("/bookings/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<Booking>> getMyBookings(@AuthenticationPrincipal UserDetails userDetails) {
        log.info("Fetching bookings for user: {}", userDetails.getUsername());
        List<Booking> bookings = bookingService.getBookingsByEmail(userDetails.getUsername());
        return ResponseEntity.ok(bookings);
    }
}