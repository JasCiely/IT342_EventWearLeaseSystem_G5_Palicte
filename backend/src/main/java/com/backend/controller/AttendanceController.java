package com.backend.controller;

import com.backend.dto.request.EditAttendanceRequest;
import com.backend.dto.response.AttendanceHistoryResponse;
import com.backend.dto.response.AttendanceResponse;
import com.backend.security.JwtService;
import com.backend.service.AttendanceService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/attendance")
@CrossOrigin(origins = "http://localhost:5173", methods = {
        RequestMethod.GET,
        RequestMethod.POST,
        RequestMethod.PUT,
        RequestMethod.DELETE,
        RequestMethod.OPTIONS
})
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final JwtService jwtService;

    /*
     * POST /api/admin/attendance/record
     * Records attendance for today. Fails if already recorded.
     */
    @PostMapping("/record")
    public ResponseEntity<Map<String, Object>> recordAttendance(HttpServletRequest request) {
        String adminId = extractAdminId(request);
        attendanceService.recordTodayAttendance(adminId);
        return ResponseEntity.ok(Map.of(
                "message", "Attendance recorded successfully",
                "date", LocalDate.now().toString()));
    }

    /*
     * GET /api/admin/attendance/today
     * Returns today's session + all individual staff records.
     */
    @GetMapping("/today")
    public ResponseEntity<AttendanceResponse> getTodayAttendance() {
        AttendanceResponse response = attendanceService.getTodayAttendance();
        return ResponseEntity.ok(response);
    }

    /*
     * PUT /api/admin/attendance/unlock?date=2026-05-07
     * Unlocks a session so records can be edited.
     * Defaults to today if no date provided.
     */
    @PutMapping("/unlock")
    public ResponseEntity<Map<String, Object>> unlockAttendance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest request) {

        String adminId = extractAdminId(request);
        LocalDate targetDate = date != null ? date : LocalDate.now();
        attendanceService.unlockAttendance(targetDate, adminId);
        return ResponseEntity.ok(Map.of(
                "message", "Attendance unlocked for editing",
                "date", targetDate.toString()));
    }

    /*
     * PUT /api/admin/attendance/edit/{recordId}
     * Edits a single staff attendance record. Session must be unlocked first.
     * Body: { status, isLate, lateMinutes }
     */
    @PutMapping("/edit/{recordId}")
    public ResponseEntity<Map<String, Object>> editAttendanceRecord(
            @PathVariable String recordId,
            @RequestBody EditAttendanceRequest editRequest,
            HttpServletRequest request) {

        String adminId = extractAdminId(request);
        attendanceService.editAttendanceRecord(recordId, editRequest, adminId);
        return ResponseEntity.ok(Map.of("message", "Attendance record updated successfully"));
    }

    /*
     * GET /api/admin/attendance/history
     * Returns filtered attendance history across all dates.
     * Query params: date, staffId, isLate, status
     */
    @GetMapping("/history")
    public ResponseEntity<List<AttendanceHistoryResponse>> getAttendanceHistory(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String staffId,
            @RequestParam(required = false) Boolean isLate,
            @RequestParam(required = false) String status) {

        List<AttendanceHistoryResponse> history = attendanceService.getAttendanceHistory(date, staffId, isLate, status);
        return ResponseEntity.ok(history);
    }

    /*
     * DELETE /api/admin/attendance/reset
     * Resets today's attendance — reverses daysWorked and deletes all records.
     */
    @DeleteMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetAttendance() {
        attendanceService.resetTodayAttendance();
        return ResponseEntity.ok(Map.of(
                "message", "Attendance reset successfully",
                "date", LocalDate.now().toString()));
    }

    /* ── helpers ── */
    private String extractAdminId(HttpServletRequest request) {
        String token = extractToken(request);
        return jwtService.extractClaim(token, claims -> claims.get("userId", String.class));
    }

    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Missing or invalid Authorization header");
        }
        return authHeader.substring(7);
    }
}