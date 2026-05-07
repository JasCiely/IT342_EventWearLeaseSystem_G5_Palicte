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

        boolean existsByRole(Role role);

        boolean existsByPhone(String phone);

        boolean existsByPhoneAndIdNot(String phone, String id);

        boolean existsByEmailAndIdNot(String email, String id);

        @Query(value = "SELECT * FROM users u WHERE " +
                        "(:role IS NULL OR u.role = CAST(:role AS text)) AND " +
                        "(:searchTerm IS NULL OR lower(u.first_name) LIKE lower(CONCAT('%', CAST(:searchTerm AS text), '%')) "
                        +
                        "OR lower(u.last_name) LIKE lower(CONCAT('%', CAST(:searchTerm AS text), '%')) " +
                        "OR lower(u.email) LIKE lower(CONCAT('%', CAST(:searchTerm AS text), '%'))) AND " +
                        "(:active IS NULL OR u.active = :active) " +
                        "ORDER BY u.created_at DESC", countQuery = "SELECT count(*) FROM users u WHERE " +
                                        "(:role IS NULL OR u.role = CAST(:role AS text)) AND " +
                                        "(:searchTerm IS NULL OR lower(u.first_name) LIKE lower(CONCAT('%', CAST(:searchTerm AS text), '%')) "
                                        +
                                        "OR lower(u.last_name) LIKE lower(CONCAT('%', CAST(:searchTerm AS text), '%')) "
                                        +
                                        "OR lower(u.email) LIKE lower(CONCAT('%', CAST(:searchTerm AS text), '%'))) AND "
                                        +
                                        "(:active IS NULL OR u.active = :active)", nativeQuery = true)
        Page<User> findUsersFiltered(
                        @Param("role") String role,
                        @Param("searchTerm") String searchTerm,
                        @Param("active") Boolean active,
                        Pageable pageable);

        @Query(value = "SELECT * FROM users u WHERE u.role = 'CUSTOMER' ORDER BY u.created_at DESC", countQuery = "SELECT count(*) FROM users u WHERE u.role = 'CUSTOMER'", nativeQuery = true)
        Page<User> findAllCustomers(Pageable pageable);
}