package com.backend.dto.response;

import com.backend.entity.User;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class UserSummaryResponse {

    private String id;
    private String firstName;
    private String lastName;
    private String email;
    private String role;
    private boolean active;
    private LocalDateTime createdAt;

    public static UserSummaryResponse from(User user) {
        UserSummaryResponse dto = new UserSummaryResponse();
        dto.setId(user.getId());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setEmail(user.getEmail());
        dto.setRole(user.getRole().name());
        dto.setActive(user.isActive());
        dto.setCreatedAt(user.getCreatedAt());
        return dto;
    }
}