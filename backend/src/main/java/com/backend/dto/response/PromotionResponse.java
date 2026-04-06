package com.backend.dto.response;

import lombok.Data;
import java.util.List;

@Data
public class PromotionResponse {
    private String id;
    private String code;
    private String type;
    private Double value;
    private String start;
    private String end;
    private boolean active;
    private List<String> items;
}