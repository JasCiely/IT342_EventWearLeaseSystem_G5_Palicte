package com.backend.features.admin.users;

import com.backend.features.admin.users.dto.response.UserPageResponse;
import com.backend.features.admin.users.dto.response.UserSummaryResponse;
import com.backend.shared.entity.Role;
import com.backend.shared.entity.User;
import com.backend.shared.exception.ResourceAlreadyExistsException;
import com.backend.shared.repository.UserRepository;
import com.backend.features.admin.users.AdminUserService;
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
        // ✅ No Sort here — ORDER BY u.created_at DESC is hardcoded in the native SQL
        // query
        Pageable pageable = PageRequest.of(page, size);

        // Resolve optional active filter
        Boolean activeFilter = null;
        if ("active".equalsIgnoreCase(status))
            activeFilter = true;
        if ("inactive".equalsIgnoreCase(status))
            activeFilter = false;

        // Handle null search safely
        String trimmedSearch = search != null ? search.trim() : null;

        Page<User> userPage = userRepository.findUsersFiltered(
                Role.CUSTOMER.name(),
                trimmedSearch,
                activeFilter,
                pageable);

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
        if (user.getRole() == Role.ADMIN) {
            throw new IllegalArgumentException("Admin accounts cannot be managed as customers");
        }
        user.setActive(active);
        return UserSummaryResponse.from(userRepository.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public UserSummaryResponse getUserById(String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceAlreadyExistsException("User", "id", id));
        return UserSummaryResponse.from(user);
    }
}