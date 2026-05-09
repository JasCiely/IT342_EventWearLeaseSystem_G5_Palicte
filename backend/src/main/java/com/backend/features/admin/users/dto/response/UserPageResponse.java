package com.backend.features.admin.users.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class UserPageResponse {

    private List<UserSummaryResponse> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
}