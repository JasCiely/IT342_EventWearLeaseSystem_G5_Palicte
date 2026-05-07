package com.backend.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class StaffPageResponse {

    private List<StaffResponse> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
}
