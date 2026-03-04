package com.backend.controller;

import com.backend.dto.response.UserPageResponse;
import com.backend.dto.response.UserSummaryResponse;
import com.backend.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    /**
     * GET /api/admin/users?page=0&size=8&search=&status=
     *
     * @param page   0-based page index
     * @param size   rows per page (default 8)
     * @param search optional name / email search string
     * @param status optional filter: "active" | "inactive" | "" (all)
     */
    @GetMapping
    public ResponseEntity<UserPageResponse> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "8") int size,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "") String status) {

        UserPageResponse response = adminUserService.getUsers(page, size, search, status);
        return ResponseEntity.ok(response);
    }

    /**
     * PATCH /api/admin/users/{id}/status
     * Body: { "active": true | false }
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<UserSummaryResponse> updateStatus(
            @PathVariable String id,
            @RequestBody Map<String, Boolean> body) {

        boolean active = Boolean.TRUE.equals(body.get("active"));
        UserSummaryResponse updated = adminUserService.updateStatus(id, active);
        return ResponseEntity.ok(updated);
    }
}