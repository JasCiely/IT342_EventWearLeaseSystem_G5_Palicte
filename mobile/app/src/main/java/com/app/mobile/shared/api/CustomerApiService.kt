package com.app.mobile.shared.api

import com.app.mobile.shared.models.*
import okhttp3.MultipartBody
import retrofit2.http.*

interface CustomerApiService {

    // ── Fitting Bookings ──────────────────────────────────────────────────
    @POST("api/inventory/book-fitting")
    suspend fun bookFitting(
        @Header("Authorization") token: String,
        @Body body: CreateFittingBookingRequest
    ): FittingBooking

    @GET("api/inventory/bookings/my")
    suspend fun getMyFittingBookings(
        @Header("Authorization") token: String
    ): List<FittingBooking>

    @PATCH("api/inventory/bookings/{id}/cancel")
    suspend fun cancelFittingBooking(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): MessageResponse

    @PATCH("api/inventory/bookings/{id}/reschedule")
    suspend fun rescheduleFittingBooking(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body body: RescheduleRequest
    ): FittingBooking

    // ── Direct Bookings ───────────────────────────────────────────────────
    @POST("api/direct-bookings")
    suspend fun createDirectBooking(
        @Header("Authorization") token: String,
        @Body body: CreateDirectBookingRequest
    ): DirectBooking

    @GET("api/direct-bookings/my-bookings")
    suspend fun getMyActiveDirectBookings(
        @Header("Authorization") token: String
    ): List<DirectBooking>

    @GET("api/direct-bookings/my-all-bookings")
    suspend fun getAllMyDirectBookings(
        @Header("Authorization") token: String
    ): List<DirectBooking>

    @PATCH("api/direct-bookings/{id}/cancel")
    suspend fun cancelDirectBooking(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): MessageResponse

    @PUT("api/direct-bookings/{id}/edit-dates")
    suspend fun editDirectBookingDates(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body body: UpdateDatesRequest
    ): DirectBooking

    // ── Profile ───────────────────────────────────────────────────────────
    @GET("api/user/profile")
    suspend fun getProfile(@Header("Authorization") token: String): UserProfile

    @PUT("api/user/profile")
    suspend fun updateProfile(
        @Header("Authorization") token: String,
        @Body body: UpdateProfileRequest
    ): UserProfile

    @Multipart
    @POST("api/user/profile/photo")
    suspend fun uploadProfilePhoto(
        @Header("Authorization") token: String,
        @Part photo: MultipartBody.Part
    ): UserProfile

    @POST("api/auth/change-password")
    suspend fun changePassword(
        @Header("Authorization") token: String,
        @Body body: ChangePasswordRequest
    ): MessageResponse

    // ── Shared Read-Only ──────────────────────────────────────────────────
    @GET("api/inventory/items")
    suspend fun getInventoryItems(): List<InventoryItem>

    @GET("api/inventory/promotions")
    suspend fun getPromotions(): List<Promotion>

    @GET("api/admin/booking-settings")
    suspend fun getBookingSettings(@Header("Authorization") token: String): BookingSettings

    @GET("api/direct-bookings/unavailable-dates")
    suspend fun getOccupiedDates(
        @Header("Authorization") token: String,
        @Query("itemId") itemId: String
    ): List<OccupiedDateRange>

    @GET("api/inventory/fitting/booked-slots")
    suspend fun getBookedFittingSlots(
        @Query("itemId") itemId: String,
        @Query("date") date: String
    ): List<String>

    @GET("api/admin/inventory-settings")
    suspend fun getInventorySettings(@Header("Authorization") token: String): InventorySettings
}
