package com.backend.service.impl;

import com.backend.dto.request.ItemRequest;
import com.backend.dto.request.PromotionRequest;
import com.backend.dto.response.ItemResponse;
import com.backend.dto.response.PromotionResponse;
import com.backend.entity.Item;
import com.backend.entity.Promotion;
import com.backend.repository.ItemRepository;
import com.backend.repository.PromotionRepository;
import com.backend.service.InventoryService;
import com.backend.service.InventorySupabaseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private final ItemRepository itemRepository;
    private final PromotionRepository promotionRepository;
    private final InventorySupabaseService supabaseService;

    // ── Items ────────────────────────────────────────────────

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
        Item item = new Item();
        applyRequest(item, request);

        List<String> urls = new ArrayList<>();
        List<String> types = new ArrayList<>();
        uploadFiles(files, urls, types);

        item.setMediaUrls(String.join(",", urls));
        item.setMediaTypes(String.join(",", types));

        return toItemResponse(itemRepository.save(item));
    }

    @Override
    public ItemResponse updateItem(String id, ItemRequest request,
            List<MultipartFile> newFiles, List<String> keepUrls) {
        Item item = itemRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Item not found: " + id));

        // Delete removed files from Supabase
        List<String> oldUrls = parseList(item.getMediaUrls());
        oldUrls.stream()
                .filter(url -> !keepUrls.contains(url))
                .forEach(supabaseService::deleteFile);

        // Start with kept urls + types
        List<String> oldTypes = parseList(item.getMediaTypes());
        List<String> urls = new ArrayList<>();
        List<String> types = new ArrayList<>();

        for (int i = 0; i < oldUrls.size(); i++) {
            if (keepUrls.contains(oldUrls.get(i))) {
                urls.add(oldUrls.get(i));
                types.add(i < oldTypes.size() ? oldTypes.get(i) : "image");
            }
        }

        // Upload new files
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
        // Delete all media from Supabase
        parseList(item.getMediaUrls()).forEach(supabaseService::deleteFile);
        itemRepository.delete(item);
    }

    // ── Promotions ───────────────────────────────────────────

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

    // ── Helpers ──────────────────────────────────────────────

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
        ItemResponse r = new ItemResponse();
        r.setId(item.getId());
        r.setName(item.getName());
        r.setCategory(item.getCategory());
        r.setSubtype(item.getSubtype());
        r.setSize(item.getSize());
        r.setColor(item.getColor());
        r.setPrice(item.getPrice());
        r.setStatus(item.getStatus());
        r.setAgeRange(item.getAgeRange());
        r.setDescription(item.getDescription());

        List<String> urls = parseList(item.getMediaUrls());
        List<String> types = parseList(item.getMediaTypes());
        List<ItemResponse.MediaFile> mediaFiles = new ArrayList<>();
        for (int i = 0; i < urls.size(); i++) {
            ItemResponse.MediaFile mf = new ItemResponse.MediaFile();
            mf.setUrl(urls.get(i));
            mf.setType(i < types.size() ? types.get(i) : "image");
            mediaFiles.add(mf);
        }
        r.setMediaFiles(mediaFiles);
        return r;
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