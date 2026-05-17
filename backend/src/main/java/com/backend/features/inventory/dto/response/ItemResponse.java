package com.backend.features.inventory.dto.response;

import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data
public class ItemResponse {
    private String id;
    private String name;
    private String category;
    private String subtype;
    private List<String> sizes;
    private Double price;
    private String status;
    private LocalDate maintenanceEndDate;
    private String ageRange;
    private String description;
    private List<MediaFile> mediaFiles;

    @Data
    public static class MediaFile {
        private String url;
        private String type;
    }
}