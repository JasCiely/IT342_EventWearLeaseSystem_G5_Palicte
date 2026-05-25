package com.backend.features.inventory;

import com.backend.features.inventory.dto.request.ItemRequest;
import com.backend.features.inventory.dto.request.PromotionRequest;
import com.backend.features.inventory.dto.response.ItemResponse;
import com.backend.features.inventory.dto.response.PromotionResponse;
import com.backend.shared.sse.SseService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
    private final ObjectMapper objectMapper;
    private final SseService sseService;

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
            ItemResponse created = inventoryService.createItem(request, files);
            sseService.broadcast("INVENTORY_UPDATE");
            return new ResponseEntity<>(created, HttpStatus.CREATED);
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
            ItemResponse updated = inventoryService.updateItem(id, request, newFiles, keepUrls);
            sseService.broadcast("INVENTORY_UPDATE");
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            log.error("Update item error: {}", e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
    }

    @DeleteMapping("/items/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteItem(@PathVariable String id) {
        inventoryService.deleteItem(id);
        sseService.broadcast("INVENTORY_UPDATE");
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/items/{id}/mark-available")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ItemResponse> markItemAvailable(@PathVariable String id) {
        try {
            ItemResponse result = inventoryService.markItemAvailable(id);
            sseService.broadcast("INVENTORY_UPDATE");
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            log.error("Mark available error: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/items/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ItemResponse> updateItemStatus(
            @PathVariable String id,
            @RequestBody java.util.Map<String, String> body) {
        try {
            String status = body.get("status");
            if (status == null || status.isBlank()) {
                return ResponseEntity.badRequest().build();
            }
            ItemResponse result = inventoryService.updateItemStatus(id, status, body.get("maintenanceEndDate"));
            sseService.broadcast("INVENTORY_UPDATE");
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            log.error("Update status error: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        }
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
        PromotionResponse created = inventoryService.createPromotion(request);
        sseService.broadcast("INVENTORY_UPDATE");
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @PutMapping("/promotions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PromotionResponse> updatePromotion(
            @PathVariable String id,
            @RequestBody PromotionRequest request) {
        PromotionResponse updated = inventoryService.updatePromotion(id, request);
        sseService.broadcast("INVENTORY_UPDATE");
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/promotions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deletePromotion(@PathVariable String id) {
        inventoryService.deletePromotion(id);
        sseService.broadcast("INVENTORY_UPDATE");
        return ResponseEntity.noContent().build();
    }
}