package com.app.mobile.models

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

data class Staff(
    val id: String,
    val fullName: String,
    val email: String,
    val role: String,
    val status: String,
    val daysWorked: Int,
    val customRate: Double?
) {
    val initials get() = fullName.split(" ").mapNotNull { it.firstOrNull() }.take(2).joinToString("").uppercase()
}

data class FittingBooking(
    val id: String,
    val bookingId: String,
    val itemName: String,
    val customerName: String,
    val customerEmail: String,
    val customerPhone: String,
    val fittingDate: String,
    val fittingTime: String,
    val preferredSize: String,
    val notes: String?,
    val status: String,
    val leaseStarted: Boolean = false,
    val createdAt: String
)

data class DirectBooking(
    val id: String,
    val userId: String?,
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
    val preferredSize: String,
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
    val attendanceDate: String,
    val status: String,
    val isLate: Boolean,
    val lateMinutes: Int?
)

data class TodayAttendanceItem(
    val id: String,
    val staffId: String,
    val staffName: String?,
    val status: String,
    val isLate: Boolean,
    val lateMinutes: Int?
)

data class AttendanceSession(
    val id: String,
    val date: String,
    val recordedBy: String,
    val locked: Boolean = true
)

data class TodayAttendanceResponse(
    val session: AttendanceSession?,
    val records: List<TodayAttendanceItem>
)

data class SalarySettings(
    val baseRate: Double,
    val overtimeRate: Double
)

data class AppSettings(
    val salarySettings: SalarySettings?
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
data class ChangePasswordRequest(val oldPassword: String, val newPassword: String)
data class StatusRequest(val active: Boolean)
data class MessageResponse(val message: String)
data class StatusResponse(val id: String, val status: String)
data class TokenValidResponse(val valid: Boolean, val email: String?)

data class CreateStaffRequest(
    val fullName: String,
    val email: String,
    val role: String,
    val status: String,
    val customRate: Double?
)

data class UpdateAttendanceRequest(
    val status: String,
    val isLate: Boolean,
    val lateMinutes: Int?
)

data class SalarySettingsRequest(val baseRate: Double, val overtimeRate: Double)

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
    val weeklyDiscount: Double = 100.0,
    val monthlyDiscountCap: Double = 300.0
)

// ── Booking Availability ──────────────────────────────────────────────────
data class OccupiedDateRange(
    val startDate: String,
    val endDate: String
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
    val itemId: String,
    val itemName: String,
    val startDate: String,
    val endDate: String,
    val basePrice: Double,
    val discountAmount: Double = 0.0,
    val finalPrice: Double,
    val notes: String?,
    val preferredSize: String?
)
