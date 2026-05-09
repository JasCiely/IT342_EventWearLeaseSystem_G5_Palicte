package com.backend.features.inventory;

import com.backend.shared.entity.Item;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ItemRepository extends JpaRepository<Item, String> {
    List<Item> findByCategory(String category);

    List<Item> findByStatus(String status);
}