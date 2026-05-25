package com.app.mobile.shared.models

import com.google.gson.annotations.SerializedName

data class PageResponse<T>(
    val content: List<T>,
    val totalElements: Int,
    val totalPages: Int,
    val number: Int,
    val size: Int
)

data class AdminUser(
    val id: String,
    val firstName: String,
    val lastName: String,
    val email: String,
    val phone: String?,
    val role: String,
    val active: Boolean,
    val createdAt: String?,
    val lastLoginAt: String?
) {
    val fullName get() = "$firstName $lastName"
    val initials get() = "${firstName.firstOrNull() ?: ""}${lastName.firstOrNull() ?: ""}".uppercase()
}

data class FittingBooking(
    val id: String,
    val bookingId: String,
    val leaseBookingId: String? = null,
    val itemId: String? = null,
    val itemName: String,
    val customerName: String,
    val customerEmail: String,
    val customerPhone: String,
    val fittingDate: String,
    val fittingTime: String,
    val preferredSize: String? = null,
    val notes: String?,
    val status: String,
    val leaseStarted: Boolean = false,
    val createdAt: String
)

data class DirectBooking(
    val id: String,
    val userId: String?,
    val inventoryItemId: String?,
    val itemName: String,
    val startDate: String,
    val endDate: String,
    val totalDays: Int,
    val basePrice: Double,
    val discountAmount: Double,
    val finalPrice: Double,
    val bookingStatus: String,
    val customerName: String,
    val customerEmail: String,
    val customerPhone: String,
    val preferredSize: String? = null,
    val notes: String?,
    val extended: Boolean = false,
    val createdAt: String
)

data class InventoryItem(
    val id: String,
    val name: String,
    val category: String,
    val subtype: String?,
    val sizes: List<String>?,
    val price: Double,
    val status: String,
    val ageRange: String?,
    val description: String?,
    val mediaFiles: List<MediaFile>?,
    val maintenanceEndDate: String?,
    val createdAt: String?
) {
    data class MediaFile(val url: String, val type: String)

    val firstImageUrl: String?
        get() = mediaFiles?.firstOrNull { it.type == "image" }?.url ?: mediaFiles?.firstOrNull()?.url

    val isAvailable get() = status.equals("Available", ignoreCase = true)
}

data class Promotion(
    val id: String,
    val code: String,
    val type: String,
    val value: Double,
    val start: String,
    val end: String,
    val active: Boolean,
    val items: List<String>?
)

data class AttendanceRecord(
    val id: String,
    val staffId: String,
    val staffName: String?,
    val attendanceDate: String,
    val status: String,
    @SerializedName("late") val isLate: Boolean,
    val lateMinutes: Int?,
    val recordedAt: String?,
    val editedAt: String?
)

data class TodayAttendanceItem(
    val id: String,
    val staffId: String,
    val staffName: String?,
    val status: String,
    @SerializedName("late") val isLate: Boolean,
    val lateMinutes: Int?
)

// Matches the flat JSON returned by GET /api/admin/attendance/today
// { id, date, recordedBy, locked, records: [...] }
// When no session exists the backend returns 500, so all fields default to null/empty.
data class TodayAttendanceResponse(
    val id: String? = null,
    val date: String? = null,
    val recordedBy: String? = null,
    val locked: Boolean = true,
    val records: List<TodayAttendanceItem> = emptyList()
)

data class SalarySettings(
    val baseRate: Double,
    val overtimeRate: Double
)

data class AppSettings(
    val defaultDailyRate: Double = 300.0,
    val salarySettings: SalarySettings? = null
)

data class UserProfile(
    val id: String,
    val firstName: String,
    val lastName: String,
    val email: String,
    val phone: String?,
    val role: String,
    val profilePhotoUrl: String?
) {
    val fullName get() = "$firstName $lastName"
    val initials get() = "${firstName.firstOrNull() ?: ""}${lastName.firstOrNull() ?: ""}".uppercase()
}

// ── Request / Response bodies ──────────────────────────────────────────────

data class LoginRequest(val email: String, val password: String)
data class RegisterRequest(val firstName: String, val lastName: String, val email: String, val password: String, val phone: String?)
data class ChangePasswordRequest(val currentPassword: String, val newPassword: String)
data class StatusRequest(val active: Boolean)
data class MessageResponse(val message: String)
data class StatusResponse(val id: String, val status: String)
data class TokenValidResponse(val valid: Boolean, val email: String?)

data class UpdateAttendanceRequest(
    val status: String,
    val isLate: Boolean,
    val lateMinutes: Int?
)

data class SalarySettingsRequest(val defaultDailyRate: Double)

data class UpdateProfileRequest(
    val firstName: String,
    val lastName: String,
    val email: String,
    val phone: String?
)

data class CreatePromotionRequest(
    val code: String,
    val type: String,
    val value: Double,
    val start: String,
    val end: String,
    val active: Boolean,
    val items: List<String>?
)

data class RescheduleRequest(val fittingDate: String, val fittingTime: String)
data class ExtendRequest(val newEndDate: String)
data class UpdateDatesRequest(val startDate: String, val endDate: String)

data class CustomerBookFittingRequest(
    val itemId: String,
    val itemName: String,
    val fittingDate: String,
    val fittingTime: String,
    val preferredSize: String?,
    val notes: String?
)

data class CreateItemRequest(
    val name: String,
    val category: String,
    val subtype: String?,
    val sizes: List<String>?,
    val price: Double,
    val status: String = "Available",
    val ageRange: String?,
    val description: String?
)

data class UpdateStatusRequest(
    val status: String,
    val maintenanceEndDate: String? = null
)

// ── Booking Settings ──────────────────────────────────────────────────────
data class BookingSettings(
    val enableTimeRestrictions: Boolean = true,
    val shopOpenTime: String = "09:00",
    val shopCloseTime: String = "17:00",
    val workingDays: List<Int> = listOf(1, 2, 3, 4, 5),
    val timezone: String = "Asia/Manila",
    val autoApproveThreshold: Int = 500,
    val fittingDurationMinutes: Int = 30
)

// ── Inventory Settings ────────────────────────────────────────────────────
data class InventorySettings(
    val minLeaseDays: Int = 2,
    val weeklyDiscount: Int = 100,
    val monthlyDiscountCap: Int = 300
)

// ── Booking Availability ──────────────────────────────────────────────────
data class OccupiedDateRange(
    val startDate: String,
    val endDate: String,
    val status: String? = null
)

data class DirectAvailabilityResponse(
    val available: Boolean
)

// ── Create Booking Requests ───────────────────────────────────────────────
data class CreateFittingBookingRequest(
    val customerEmail: String,
    val customerName: String,
    val customerPhone: String,
    val itemId: String,
    val itemName: String,
    val fittingDate: String,
    val fittingTime: String,
    val preferredSize: String?,
    val notes: String?
)

data class CreateDirectBookingRequest(
    val customerEmail: String,
    val customerName: String,
    val customerPhone: String,
    val inventoryItemId: String,
    val itemName: String,
    val startDate: String,
    val endDate: String,
    val totalDays: Int,
    val basePrice: Double,
    val discountAmount: Double = 0.0,
    val finalPrice: Double,
    val notes: String?,
    val preferredSize: String?
)
