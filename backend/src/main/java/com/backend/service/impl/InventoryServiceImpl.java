package com.backend.service.impl;

import com.backend.decorator.BasicInfoDecorator;
import com.backend.dto.request.ItemRequest;
import com.backend.dto.request.PromotionRequest;
import com.backend.dto.response.ItemResponse;
import com.backend.dto.response.PromotionResponse;
import com.backend.entity.Item;
import com.backend.entity.Promotion;
import com.backend.factory.ItemFactoryRegistry;
import com.backend.repository.ItemRepository;
import com.backend.repository.PromotionRepository;
import com.backend.service.InventoryService;
import com.backend.service.InventorySupabaseService;
import com.backend.service.promotion.PromotionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class InventoryServiceImpl implements InventoryService {

    private final ItemRepository itemRepository;
    private final PromotionRepository promotionRepository;
    private final InventorySupabaseService supabaseService;
    private final ItemFactoryRegistry factoryRegistry;
    private final BasicInfoDecorator basicInfoDecorator;
    private final PromotionService promotionService;

    public InventoryServiceImpl(
            ItemRepository itemRepository,
            PromotionRepository promotionRepository,
            InventorySupabaseService supabaseService,
            ItemFactoryRegistry factoryRegistry,
            BasicInfoDecorator basicInfoDecorator,
            PromotionService promotionService) {
        this.itemRepository = itemRepository;
        this.promotionRepository = promotionRepository;
        this.supabaseService = supabaseService;
        this.factoryRegistry = factoryRegistry;
        this.basicInfoDecorator = basicInfoDecorator;
        this.promotionService = promotionService;
    }

    @Override
    public List<ItemResponse> getAllItems() {
        return itemRepository.findAll().stream()
                .map(this::toItemResponse)
                .collect(Collectors.toList());
    }

    @Override
    public ItemResponse getItem(String id) {
        Item item = itemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found: " + id));
        return toItemResponse(item);
    }

    @Override
    public ItemResponse createItem(ItemRequest request, List<MultipartFile> files) {
        log.info("Creating item with category: {}", request.getCategory());

        var factory = factoryRegistry.getFactory(request.getCategory());
        Item item = factory.createItem(request);

        List<String> urls = new ArrayList<>();
        List<String> types = new ArrayList<>();
        uploadFiles(files, urls, types);

        item.setMediaUrls(String.join(",", urls));
        item.setMediaTypes(String.join(",", types));

        log.info("Created new {} item: {}", request.getCategory(), item.getName());
        return toItemResponse(itemRepository.save(item));
    }

    @Override
    public ItemResponse updateItem(String id, ItemRequest request,
            List<MultipartFile> newFiles, List<String> keepUrls) {
        Item item = itemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found: " + id));

        List<String> oldUrls = parseList(item.getMediaUrls());
        oldUrls.stream()
                .filter(url -> !keepUrls.contains(url))
                .forEach(supabaseService::deleteFile);

        List<String> oldTypes = parseList(item.getMediaTypes());
        List<String> urls = new ArrayList<>();
        List<String> types = new ArrayList<>();

        for (int i = 0; i < oldUrls.size(); i++) {
            if (keepUrls.contains(oldUrls.get(i))) {
                urls.add(oldUrls.get(i));
                types.add(i < oldTypes.size() ? oldTypes.get(i) : "image");
            }
        }

        uploadFiles(newFiles, urls, types);

        applyRequest(item, request);
        item.setMediaUrls(String.join(",", urls));
        item.setMediaTypes(String.join(",", types));

        return toItemResponse(itemRepository.save(item));
    }

    @Override
    public void deleteItem(String id) {
        Item item = itemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found: " + id));
        parseList(item.getMediaUrls()).forEach(supabaseService::deleteFile);
        itemRepository.delete(item);
    }

    @Override
    public List<PromotionResponse> getAllPromotions() {
        return promotionRepository.findAll().stream()
                .map(this::toPromoResponse)
                .collect(Collectors.toList());
    }

    @Override
    public PromotionResponse createPromotion(PromotionRequest request) {
        Promotion p = new Promotion();
        applyPromoRequest(p, request);
        return toPromoResponse(promotionRepository.save(p));
    }

    @Override
    public PromotionResponse updatePromotion(String id, PromotionRequest request) {
        Promotion p = promotionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Promotion not found: " + id));
        applyPromoRequest(p, request);
        return toPromoResponse(promotionRepository.save(p));
    }

    @Override
    public void deletePromotion(String id) {
        promotionRepository.deleteById(id);
    }

    private void applyRequest(Item item, ItemRequest r) {
        item.setName(r.getName());
        item.setCategory(r.getCategory());
        item.setSubtype(r.getSubtype());
        item.setSize(r.getSize());
        item.setColor(r.getColor());
        item.setPrice(r.getPrice());
        item.setStatus(r.getStatus() != null ? r.getStatus() : "Available");
        item.setAgeRange(r.getAgeRange());
        item.setDescription(r.getDescription());
    }

    private void applyPromoRequest(Promotion p, PromotionRequest r) {
        p.setCode(r.getCode().toUpperCase().trim());
        p.setType(r.getType());
        p.setValue(r.getValue());
        p.setStartDate(LocalDate.parse(r.getStart()));
        p.setEndDate(LocalDate.parse(r.getEnd()));
        p.setActive(r.isActive());
        p.setItemIds(r.getItems() != null ? String.join(",", r.getItems()) : "");
    }

    private void uploadFiles(List<MultipartFile> files, List<String> urls, List<String> types) {
        if (files == null)
            return;
        for (MultipartFile file : files) {
            if (file.isEmpty())
                continue;
            String ct = file.getContentType() != null ? file.getContentType() : "";
            String type = ct.startsWith("video/") ? "video" : "image";
            String url = supabaseService.uploadFile(file, "inventory");
            urls.add(url);
            types.add(type);
        }
    }

    private ItemResponse toItemResponse(Item item) {
        ItemResponse response = new ItemResponse();
        response = basicInfoDecorator.decorate(item, response);

        PromotionResult promotionResult = calculateBestPromotion(item);
        response.setFinalPrice(promotionResult.finalPrice);
        response.setDiscountApplied(promotionResult.promotionCode);

        return response;
    }

    private PromotionResult calculateBestPromotion(Item item) {
        LocalDate today = LocalDate.now();

        List<Promotion> applicablePromotions = promotionRepository.findAll().stream()
                .filter(promo -> promo.isActive())
                .filter(promo -> !today.isBefore(promo.getStartDate()))
                .filter(promo -> !today.isAfter(promo.getEndDate()))
                .filter(promo -> isPromotionApplicableToItem(promo, item))
                .collect(Collectors.toList());

        if (applicablePromotions.isEmpty()) {
            return new PromotionResult(item.getPrice(), null);
        }

        Double bestPrice = item.getPrice();
        String bestPromoCode = null;

        for (Promotion promo : applicablePromotions) {
            try {
                Double calculatedPrice = promotionService.applyPromotion(promo.getCode(), item.getPrice());
                if (calculatedPrice < bestPrice) {
                    bestPrice = calculatedPrice;
                    bestPromoCode = promo.getCode();
                }
            } catch (Exception e) {
                log.warn("Failed to apply promotion {}: {}", promo.getCode(), e.getMessage());
            }
        }

        if (bestPromoCode != null) {
            log.debug("Applied promotion {} to item {}, price: {} -> {}",
                    bestPromoCode, item.getName(), item.getPrice(), bestPrice);
        }

        return new PromotionResult(bestPrice, bestPromoCode);
    }

    private boolean isPromotionApplicableToItem(Promotion promotion, Item item) {
        if (promotion.getItemIds() == null || promotion.getItemIds().isBlank()) {
            return true;
        }

        List<String> applicableItemIds = Arrays.asList(promotion.getItemIds().split(","));
        return applicableItemIds.contains(item.getId());
    }

    private static class PromotionResult {
        Double finalPrice;
        String promotionCode;

        PromotionResult(Double finalPrice, String promotionCode) {
            this.finalPrice = finalPrice;
            this.promotionCode = promotionCode;
        }
    }

    private PromotionResponse toPromoResponse(Promotion p) {
        PromotionResponse r = new PromotionResponse();
        r.setId(p.getId());
        r.setCode(p.getCode());
        r.setType(p.getType());
        r.setValue(p.getValue());
        r.setStart(p.getStartDate().toString());
        r.setEnd(p.getEndDate().toString());
        r.setActive(p.isActive());
        r.setItems(parseList(p.getItemIds()));
        return r;
    }

    private List<String> parseList(String csv) {
        if (csv == null || csv.isBlank())
            return new ArrayList<>();
        return Arrays.stream(csv.split(","))
                .map(String::trim).filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}