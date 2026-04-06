package com.backend.dto.request;

import lombok.Data;
import java.util.List;

@Data
public class PromotionRequest {
    private String code;
    private String type;
    private Double value;
    private String start;
    private String end;
    private boolean active;
    private List<String> items;
}