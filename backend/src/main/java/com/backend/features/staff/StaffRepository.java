package com.backend.features.staff;

import com.backend.shared.entity.Staff;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StaffRepository extends JpaRepository<Staff, String> {

    Optional<Staff> findByIdAndDeletedAtIsNull(String id);

    Optional<Staff> findByEmailAndDeletedAtIsNull(String email);

    boolean existsByEmailAndDeletedAtIsNull(String email);

    boolean existsByEmailAndIdNotAndDeletedAtIsNull(String email, String id);

    java.util.List<Staff> findAllByDeletedAtIsNull();

    @Query(value = "SELECT * FROM staff s WHERE s.deleted_at IS NULL " +
            "AND (:searchTerm IS NULL OR lower(s.full_name) LIKE lower(CONCAT('%', CAST(:searchTerm AS text), '%')) " +
            "OR lower(s.email) LIKE lower(CONCAT('%', CAST(:searchTerm AS text), '%'))) " +
            "AND (:status IS NULL OR lower(s.status) = lower(CAST(:status AS text)))", countQuery = "SELECT count(*) FROM staff s WHERE s.deleted_at IS NULL "
                    +
                    "AND (:searchTerm IS NULL OR lower(s.full_name) LIKE lower(CONCAT('%', CAST(:searchTerm AS text), '%')) "
                    +
                    "OR lower(s.email) LIKE lower(CONCAT('%', CAST(:searchTerm AS text), '%'))) " +
                    "AND (:status IS NULL OR lower(s.status) = lower(CAST(:status AS text)))", nativeQuery = true)
    Page<Staff> searchFiltered(@Param("searchTerm") String searchTerm,
            @Param("status") String status,
            Pageable pageable);
}
