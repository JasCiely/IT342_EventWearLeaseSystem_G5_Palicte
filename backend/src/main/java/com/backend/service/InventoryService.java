package com.backend.service;

import com.backend.dto.request.ItemRequest;
import com.backend.dto.request.PromotionRequest;
import com.backend.dto.response.ItemResponse;
import com.backend.dto.response.PromotionResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface InventoryService {
    List<ItemResponse> getAllItems();

    ItemResponse getItem(String id);

    ItemResponse createItem(ItemRequest request, List<MultipartFile> files);

    ItemResponse updateItem(String id, ItemRequest request, List<MultipartFile> newFiles, List<String> keepUrls);

    void deleteItem(String id);

    List<PromotionResponse> getAllPromotions();

    PromotionResponse createPromotion(PromotionRequest request);

    PromotionResponse updatePromotion(String id, PromotionRequest request);

    void deletePromotion(String id);
}