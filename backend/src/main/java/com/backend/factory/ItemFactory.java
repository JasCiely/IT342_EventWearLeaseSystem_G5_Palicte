package com.backend.factory;

import com.backend.dto.request.ItemRequest;
import com.backend.entity.Item;

public interface ItemFactory {
    Item createItem(ItemRequest request);

    String getSupportedCategory();
}