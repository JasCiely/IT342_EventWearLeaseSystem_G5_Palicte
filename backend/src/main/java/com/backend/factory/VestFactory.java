package com.backend.factory;

import com.backend.dto.request.ItemRequest;
import com.backend.entity.Item;
import org.springframework.stereotype.Component;

@Component
public class VestFactory implements ItemFactory {

    @Override
    public Item createItem(ItemRequest request) {
        Item item = new Item();

        item.setName(request.getName());
        item.setCategory(request.getCategory());
        item.setSubtype(request.getSubtype());
        item.setSize(request.getSize());
        item.setColor(request.getColor());
        item.setDescription(request.getDescription());
        item.setAgeRange(request.getAgeRange());
        item.setStatus(request.getStatus() != null ? request.getStatus() : "Available");
        item.setPrice(request.getPrice() != null ? request.getPrice() : 0.0);

        return item;
    }

    @Override
    public String getSupportedCategory() {
        return "VEST";
    }
}