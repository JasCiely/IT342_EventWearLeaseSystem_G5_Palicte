package com.backend.dto.request;

import lombok.Data;
import java.util.List;

@Data
public class ItemRequest {
    private String name;
    private String category;
    private String subtype;
    private String size;
    private String color;
    private Double price;
    private String status;
    private String ageRange;
    private String description;
}