package com.backend.service.impl;

import com.backend.dto.response.UserPageResponse;
import com.backend.dto.response.UserSummaryResponse;
import com.backend.entity.Role;
import com.backend.entity.User;
import com.backend.exception.ResourceAlreadyExistsException;
import com.backend.repository.UserRepository;
import com.backend.service.AdminUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class AdminUserServiceImpl implements AdminUserService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserPageResponse getUsers(int page, int size, String search, String status) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        // Resolve optional active filter
        Boolean activeFilter = null;
        if ("active".equalsIgnoreCase(status))
            activeFilter = true;
        if ("inactive".equalsIgnoreCase(status))
            activeFilter = false;

        Page<User> userPage = userRepository.findUsersFiltered(
                Role.USER, search.trim(), activeFilter, pageable);

        List<UserSummaryResponse> content = userPage.getContent()
                .stream()
                .map(UserSummaryResponse::from)
                .toList();

        return new UserPageResponse(
                content,
                userPage.getNumber(),
                userPage.getSize(),
                userPage.getTotalElements(),
                userPage.getTotalPages());
    }

    @Override
    public UserSummaryResponse updateStatus(String id, boolean active) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceAlreadyExistsException("User", "id", id));
        user.setActive(active);
        return UserSummaryResponse.from(userRepository.save(user));
    }
}