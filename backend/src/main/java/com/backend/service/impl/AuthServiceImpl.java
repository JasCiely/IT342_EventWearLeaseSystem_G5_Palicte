package com.backend.service.impl;

import com.backend.dto.request.ChangePasswordRequest;
import com.backend.dto.request.LoginRequest;
import com.backend.dto.request.RegisterRequest;
import com.backend.dto.response.AuthResponse;
import com.backend.entity.Role;
import com.backend.entity.User;
import com.backend.exception.InvalidCredentialsException;
import com.backend.exception.ResourceAlreadyExistsException;
import com.backend.repository.UserRepository;
import com.backend.security.JwtService;
import com.backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    @Override
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResourceAlreadyExistsException("Email", "email", request.getEmail());
        }

        User user = new User();
        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(request.getEmail().toLowerCase().trim());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.USER);
        user.setActive(true);
        user.setMustChangePassword(false);

        User savedUser = userRepository.save(user);

        Map<String, Object> claims = new HashMap<>();
        claims.put("role", "ROLE_USER");
        claims.put("userId", savedUser.getId());

        String token = jwtService.generateToken(claims, savedUser);

        return new AuthResponse(
                token,
                savedUser.getEmail(),
                savedUser.getFirstName(),
                savedUser.getLastName(),
                savedUser.getRole().name(),
                false,
                "Registration successful",
                HttpStatus.CREATED.value());
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail().toLowerCase().trim(),
                            request.getPassword()));

            User user = (User) authentication.getPrincipal();

            user.setLastLoginAt(LocalDateTime.now());
            userRepository.save(user);

            Map<String, Object> claims = new HashMap<>();
            claims.put("role", "ROLE_" + user.getRole().name());
            claims.put("userId", user.getId());
            claims.put("mustChangePassword", user.isMustChangePassword());

            String token = jwtService.generateToken(claims, user);

            String message = user.isMustChangePassword()
                    ? "Please change your temporary password"
                    : "Login successful";

            return new AuthResponse(
                    token,
                    user.getEmail(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.getRole().name(),
                    user.isMustChangePassword(),
                    message,
                    HttpStatus.OK.value());

        } catch (BadCredentialsException e) {
            throw new InvalidCredentialsException("Invalid email or password");
        } catch (DisabledException e) {
            throw new InvalidCredentialsException("Account is disabled. Please contact administrator.");
        }
    }

    @Override
    public void changePassword(String email, ChangePasswordRequest request) {
        log.info("=== changePassword() called for email: {}", email);

        log.info("Step 1: Looking up user by email...");
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("User not found"));
        log.info("Step 1 OK: User found - {}", user.getEmail());

        log.info("Step 2: Verifying current password...");
        boolean matches = passwordEncoder.matches(request.getCurrentPassword(), user.getPassword());
        log.info("Step 2: Password matches = {}", matches);
        if (!matches) {
            throw new InvalidCredentialsException("Current password is incorrect");
        }

        log.info("Step 3: Encoding new password...");
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        log.info("Step 3 OK");

        log.info("Step 4: Setting mustChangePassword = false...");
        user.setMustChangePassword(false);
        log.info("Step 4 OK");

        log.info("Step 5: Saving user...");
        userRepository.save(user);
        log.info("Step 5 OK: User saved successfully");
    }
}