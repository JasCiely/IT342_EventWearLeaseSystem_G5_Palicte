package com.app.mobile.api

import com.app.mobile.models.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.*

interface AdminApiService {

    // ── Auth ──────────────────────────────────────────────────────────────
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): Map<String, Any>

    @POST("api/auth/logout")
    suspend fun logout(@Header("Authorization") token: String): MessageResponse

    @POST("api/auth/change-password")
    suspend fun changePassword(
        @Header("Authorization") token: String,
        @Body body: ChangePasswordRequest
    ): MessageResponse

    // ── Profile ───────────────────────────────────────────────────────────
    @GET("api/user/profile")
    suspend fun getProfile(@Header("Authorization") token: String): UserProfile

    @PUT("api/user/profile")
    suspend fun updateProfile(
        @Header("Authorization") token: String,
        @Body body: UpdateProfileRequest
    ): UserProfile

    // ── Admin Users ───────────────────────────────────────────────────────
    @GET("api/admin/users")
    suspend fun getUsers(
        @Header("Authorization") token: String,
        @Query("page") page: Int = 0,
        @Query("size") size: Int = 20,
        @Query("search") search: String = "",
        @Query("status") status: String = ""
    ): PageResponse<AdminUser>

    @PATCH("api/admin/users/{id}/status")
    suspend fun updateUserStatus(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body body: StatusRequest
    ): AdminUser

    // ── Staff ─────────────────────────────────────────────────────────────
    @GET("api/admin/staff")
    suspend fun getStaff(
        @Header("Authorization") token: String,
        @Query("page") page: Int = 0,
        @Query("size") size: Int = 50,
        @Query("search") search: String = ""
    ): PageResponse<Staff>

    @POST("api/admin/staff")
    suspend fun createStaff(
        @Header("Authorization") token: String,
        @Body body: CreateStaffRequest
    ): Staff

    @PUT("api/admin/staff/{id}")
    suspend fun updateStaff(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body body: CreateStaffRequest
    ): Staff

    @DELETE("api/admin/staff/{id}")
    suspend fun deleteStaff(
        @Header("Authorization") token: String,
        @Path("id") id: String
    )

    // ── Fitting Bookings ──────────────────────────────────────────────────
    @GET("api/admin/bookings/fitting")
    suspend fun getFittingBookings(
        @Header("Authorization") token: String,
        @Query("page") page: Int = 0,
        @Query("size") size: Int = 50,
        @Query("status") status: String = ""
    ): PageResponse<FittingBooking>

    @PUT("api/admin/bookings/fitting/{bookingId}/status")
    suspend fun updateFittingStatus(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String,
        @Query("status") status: String
    ): StatusResponse

    @PUT("api/admin/bookings/fitting/{bookingId}/reschedule")
    suspend fun rescheduleFitting(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String,
        @Body body: RescheduleRequest
    ): FittingBooking

    @POST("api/admin/bookings/fitting/{bookingId}/resend-email")
    suspend fun resendFittingEmail(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String
    ): MessageResponse

    // ── Direct Bookings ───────────────────────────────────────────────────
    @GET("api/admin/bookings/direct")
    suspend fun getDirectBookings(
        @Header("Authorization") token: String,
        @Query("page") page: Int = 0,
        @Query("size") size: Int = 50,
        @Query("status") status: String = ""
    ): PageResponse<DirectBooking>

    @PUT("api/admin/bookings/direct/{bookingId}/status")
    suspend fun updateDirectStatus(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String,
        @Query("status") status: String
    ): StatusResponse

    @PUT("api/admin/bookings/direct/{bookingId}/pickup")
    suspend fun markPickup(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String
    ): DirectBooking

    @PUT("api/admin/bookings/direct/{bookingId}/undo-pickup")
    suspend fun undoPickup(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String
    ): DirectBooking

    @PUT("api/admin/bookings/direct/{bookingId}/return")
    suspend fun markReturn(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String
    ): DirectBooking

    @PUT("api/admin/bookings/direct/{bookingId}/extend")
    suspend fun extendLease(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String,
        @Body body: ExtendRequest
    ): DirectBooking

    @PUT("api/admin/bookings/direct/{bookingId}/dates")
    suspend fun updateBookingDates(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String,
        @Body body: UpdateDatesRequest
    ): DirectBooking

    @POST("api/admin/bookings/direct/{bookingId}/resend-email")
    suspend fun resendDirectEmail(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String
    ): MessageResponse

    // ── Customer detail ───────────────────────────────────────────────────
    @GET("api/admin/users/{id}")
    suspend fun getUserById(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): AdminUser

    // ── Booking Settings ──────────────────────────────────────────────────
    @GET("api/admin/booking-settings")
    suspend fun getBookingSettings(@Header("Authorization") token: String): BookingSettings

    @PUT("api/admin/booking-settings")
    suspend fun saveBookingSettings(
        @Header("Authorization") token: String,
        @Body body: BookingSettings
    ): BookingSettings

    // ── Inventory Settings ────────────────────────────────────────────────
    @GET("api/admin/inventory-settings")
    suspend fun getInventorySettings(@Header("Authorization") token: String): InventorySettings

    @PUT("api/admin/inventory-settings")
    suspend fun updateInventorySettings(
        @Header("Authorization") token: String,
        @Body body: InventorySettings
    ): InventorySettings

    // ── Create Bookings ───────────────────────────────────────────────────
    @POST("api/admin/bookings/fitting")
    suspend fun createFittingBooking(
        @Header("Authorization") token: String,
        @Body body: CreateFittingBookingRequest
    ): FittingBooking

    @POST("api/admin/bookings/direct")
    suspend fun createDirectBooking(
        @Header("Authorization") token: String,
        @Body body: CreateDirectBookingRequest
    ): DirectBooking

    // ── Availability ──────────────────────────────────────────────────────
    @GET("api/direct-bookings/unavailable-dates")
    suspend fun getOccupiedDates(
        @Header("Authorization") token: String,
        @Query("itemId") itemId: String
    ): List<OccupiedDateRange>

    @GET("api/direct-bookings/unavailable-dates")
    suspend fun getUnavailableDates(
        @Header("Authorization") token: String,
        @Query("itemId") itemId: String,
        @Query("excludeBookingId") excludeBookingId: String = ""
    ): List<OccupiedDateRange>

    @GET("api/direct-bookings/availability")
    suspend fun checkDirectAvailability(
        @Header("Authorization") token: String,
        @Query("itemId") itemId: String,
        @Query("startDate") startDate: String,
        @Query("endDate") endDate: String
    ): DirectAvailabilityResponse

    @GET("api/inventory/fitting/booked-slots")
    suspend fun getBookedFittingSlots(
        @Query("itemId") itemId: String,
        @Query("date") date: String
    ): List<String>

    // ── Fitting Without Lease ─────────────────────────────────────────────
    @PUT("api/admin/bookings/fitting/{bookingId}/complete-no-lease")
    suspend fun completeFittingNoLease(
        @Header("Authorization") token: String,
        @Path("bookingId") bookingId: String
    ): MessageResponse

    // ── Inventory ─────────────────────────────────────────────────────────
    @GET("api/inventory/items")
    suspend fun getInventoryItems(): List<InventoryItem>

    @Multipart
    @POST("api/inventory/items")
    suspend fun createInventoryItem(
        @Header("Authorization") token: String,
        @Part("data") data: RequestBody,
        @Part files: List<MultipartBody.Part>
    ): InventoryItem

    @Multipart
    @PUT("api/inventory/items/{id}")
    suspend fun updateInventoryItem(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Part("data") data: RequestBody,
        @Part("keepUrls") keepUrls: RequestBody,
        @Part files: List<MultipartBody.Part>
    ): InventoryItem

    @DELETE("api/inventory/items/{id}")
    suspend fun deleteInventoryItem(
        @Header("Authorization") token: String,
        @Path("id") id: String
    )

    @PUT("api/inventory/items/{id}/mark-available")
    suspend fun markItemAvailable(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): InventoryItem

    // ── Promotions ────────────────────────────────────────────────────────
    @GET("api/inventory/promotions")
    suspend fun getPromotions(): List<Promotion>

    @POST("api/inventory/promotions")
    suspend fun createPromotion(
        @Header("Authorization") token: String,
        @Body body: CreatePromotionRequest
    ): Promotion

    @PUT("api/inventory/promotions/{id}")
    suspend fun updatePromotion(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body body: CreatePromotionRequest
    ): Promotion

    @DELETE("api/inventory/promotions/{id}")
    suspend fun deletePromotion(
        @Header("Authorization") token: String,
        @Path("id") id: String
    )

    // ── Attendance ────────────────────────────────────────────────────────
    @POST("api/admin/attendance/record")
    suspend fun recordAttendance(@Header("Authorization") token: String): MessageResponse

    @GET("api/admin/attendance/today")
    suspend fun getTodayAttendance(@Header("Authorization") token: String): TodayAttendanceResponse

    @PUT("api/admin/attendance/unlock")
    suspend fun unlockAttendance(@Header("Authorization") token: String): MessageResponse

    @PUT("api/admin/attendance/edit/{recordId}")
    suspend fun editAttendanceRecord(
        @Header("Authorization") token: String,
        @Path("recordId") recordId: String,
        @Body body: UpdateAttendanceRequest
    ): MessageResponse

    @GET("api/admin/attendance/history")
    suspend fun getAttendanceHistory(
        @Header("Authorization") token: String,
        @Query("date") date: String = "",
        @Query("staffId") staffId: String = "",
        @Query("status") status: String = ""
    ): List<AttendanceRecord>

    // ── Settings ──────────────────────────────────────────────────────────
    @GET("api/admin/settings")
    suspend fun getSettings(@Header("Authorization") token: String): AppSettings

    @PUT("api/admin/settings/salary")
    suspend fun updateSalarySettings(
        @Header("Authorization") token: String,
        @Body body: SalarySettingsRequest
    ): AppSettings
}
