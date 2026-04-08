package com.backend.dto.response;

import lombok.Data;
import java.util.List;

@Data
public class ItemResponse {
    private String id;
    private String name;
    private String category;
    private String subtype;
    private String size;
    private String color;
    private Double price;
    private Double finalPrice;
    private String discountApplied;
    private String status;
    private String ageRange;
    private String description;
    private List<MediaFile> mediaFiles;

    @Data
    public static class MediaFile {
        private String url;
        private String type;
    }
}