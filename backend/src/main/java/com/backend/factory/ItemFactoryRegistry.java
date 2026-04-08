package com.backend.factory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class ItemFactoryRegistry {

    private final Map<String, ItemFactory> factoryMap = new HashMap<>();

    @Autowired
    private List<ItemFactory> factories;

    @PostConstruct
    public void init() {
        for (ItemFactory factory : factories) {
            factoryMap.put(factory.getSupportedCategory().toUpperCase(), factory);
            System.out.println("Registered factory for: " + factory.getSupportedCategory());
        }
        System.out.println("All registered categories: " + factoryMap.keySet());
    }

    public ItemFactory getFactory(String category) {
        ItemFactory factory = factoryMap.get(category.toUpperCase());
        if (factory == null) {
            throw new IllegalArgumentException("No factory found for category: " + category +
                    ". Supported categories: " + factoryMap.keySet());
        }
        return factory;
    }
}