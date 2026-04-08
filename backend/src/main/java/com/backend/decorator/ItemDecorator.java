package com.backend.decorator;

import com.backend.entity.Item;
import com.backend.dto.response.ItemResponse;

public interface ItemDecorator {
    ItemResponse decorate(Item item, ItemResponse response);
}