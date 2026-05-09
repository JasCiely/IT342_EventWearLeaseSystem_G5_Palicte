package com.backend.shared.repository;

import com.backend.shared.entity.SalarySettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SalarySettingsRepository extends JpaRepository<SalarySettings, String> {

    Optional<SalarySettings> findFirstByOrderByCreatedAtDesc();
}
