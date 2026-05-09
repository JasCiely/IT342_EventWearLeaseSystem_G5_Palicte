package com.backend.features.booking.settings;

import com.backend.shared.entity.BookingTimeSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BookingTimeSettingsRepository extends JpaRepository<BookingTimeSettings, Long> {
    // Singleton row: always fetch by id=1
}