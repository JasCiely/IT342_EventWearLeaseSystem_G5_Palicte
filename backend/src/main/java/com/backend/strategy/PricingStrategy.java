package com.backend.strategy;

import com.backend.entity.Item;
import com.backend.entity.User;

public interface PricingStrategy {
    Double calculatePrice(Item item, User user, Integer rentalDays);

    String getStrategyName();
}