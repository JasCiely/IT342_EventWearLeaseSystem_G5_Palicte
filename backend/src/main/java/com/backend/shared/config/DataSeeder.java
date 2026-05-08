package com.backend.shared.config;

import com.backend.shared.entity.Role;
import com.backend.shared.entity.User;
import com.backend.shared.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.email}")
    private String adminEmail;

    @Value("${admin.temp-password}")
    private String adminTempPassword;

    @Override
    public void run(String... args) {
        // ── Check by ROLE, NOT by email ──
        // This ensures we never create a duplicate admin even if
        // the admin changes their email, name, password, or phone.
        // As long as ONE user with ADMIN role exists → skip seeding.
        if (userRepository.existsByRole(Role.ADMIN)) {
            log.info("✅ Admin already exists — skipping seed.");
            return;
        }

        User admin = new User();
        admin.setFirstName("System");
        admin.setLastName("Administrator");
        admin.setEmail(adminEmail);
        admin.setPassword(passwordEncoder.encode(adminTempPassword));
        admin.setRole(Role.ADMIN);
        admin.setActive(true);
        admin.setMustChangePassword(true);

        userRepository.save(admin);
        log.info("✅ Admin account created — email: {}", adminEmail);
        log.warn("⚠️  Temporary password: {} — please change this immediately!", adminTempPassword);
    }
}