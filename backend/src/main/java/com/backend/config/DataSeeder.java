package com.backend.config;

import com.backend.entity.Role;
import com.backend.entity.User;
import com.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

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
        // Create admin account if it doesn't exist
        if (!userRepository.existsByEmail(adminEmail)) {
            User admin = new User();
            admin.setFirstName("System");
            admin.setLastName("Administrator");
            admin.setEmail(adminEmail);
            admin.setPassword(passwordEncoder.encode(adminTempPassword));
            admin.setRole(Role.ADMIN);
            admin.setActive(true);
            admin.setMustChangePassword(true);

            userRepository.save(admin);
            System.out.println("Admin account created successfully!");
            System.out.println("Admin email: " + adminEmail);
            System.out.println("Temporary password: " + adminTempPassword);
        }
    }
}
