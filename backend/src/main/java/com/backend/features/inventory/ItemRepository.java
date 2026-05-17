package com.backend.features.inventory;

import com.backend.shared.entity.Item;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ItemRepository extends JpaRepository<Item, String> {
    List<Item> findByCategory(String category);

    List<Item> findByStatus(String status);

    @Query("SELECT i FROM Item i WHERE i.status = 'Under Maintenance' AND i.maintenanceEndDate <= :today")
    List<Item> findMaintenanceItemsDue(@Param("today") LocalDate today);
}