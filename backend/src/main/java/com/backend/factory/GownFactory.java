package com.backend.factory;

import com.backend.dto.request.ItemRequest;
import com.backend.entity.Item;
import org.springframework.stereotype.Component;

@Component
public class GownFactory implements ItemFactory {

    @Override
    public Item createItem(ItemRequest request) {
        Item item = new Item();

        // Base fields
        item.setName(request.getName());
        item.setCategory(request.getCategory());
        item.setSubtype(request.getSubtype());
        item.setSize(request.getSize());
        item.setColor(request.getColor());
        item.setDescription(request.getDescription());
        item.setAgeRange(request.getAgeRange());
        item.setStatus(request.getStatus() != null ? request.getStatus() : "Available");
        item.setPrice(request.getPrice() != null ? request.getPrice() : 0.0);

        // Gown-specific validation
        if (request.getSize() == null || request.getSize().isBlank()) {
            throw new IllegalArgumentException("Gown requires a size (XS, S, M, L, XL)");
        }

        return item;
    }

    @Override
    public String getSupportedCategory() {
        return "GOWN";
    }
}