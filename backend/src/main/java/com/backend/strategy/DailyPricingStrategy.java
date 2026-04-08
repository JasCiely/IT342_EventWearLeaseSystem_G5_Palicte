package com.backend.strategy;

import com.backend.entity.Item;
import com.backend.entity.User;
import org.springframework.stereotype.Component;

@Component
public class DailyPricingStrategy implements PricingStrategy {

    @Override
    public Double calculatePrice(Item item, User user, Integer rentalDays) {
        return item.getPrice() * rentalDays;
    }

    @Override
    public String getStrategyName() {
        return "Daily Rate";
    }
}