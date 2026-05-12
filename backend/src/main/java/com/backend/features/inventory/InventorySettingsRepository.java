package com.backend.features.inventory;

import com.backend.shared.entity.InventorySettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface InventorySettingsRepository extends JpaRepository<InventorySettings, Long> {

    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO inventory_settings (id, min_lease_days, weekly_discount, monthly_discount_cap, version)
            VALUES (1, :minDays, :weekly, :monthlyCap, 0)
            ON CONFLICT (id) DO NOTHING
            """, nativeQuery = true)
    void createIfNotExists(@Param("minDays") int minDays,
            @Param("weekly") int weekly,
            @Param("monthlyCap") int monthlyCap);
}