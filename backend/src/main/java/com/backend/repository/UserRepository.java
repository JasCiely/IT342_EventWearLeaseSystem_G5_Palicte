package com.backend.repository;

import com.backend.entity.User;
import com.backend.entity.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE " +
            "(:role IS NULL OR u.role = :role) AND " +
            "(:searchTerm IS NULL OR LOWER(u.firstName) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
            "OR LOWER(u.lastName) LIKE LOWER(CONCAT('%', :searchTerm, '%')) " +
            "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :searchTerm, '%'))) AND " +
            "(:active IS NULL OR u.active = :active)")
    Page<User> findUsersFiltered(
            @Param("role") Role role,
            @Param("searchTerm") String searchTerm,
            @Param("active") Boolean active,
            Pageable pageable);
}