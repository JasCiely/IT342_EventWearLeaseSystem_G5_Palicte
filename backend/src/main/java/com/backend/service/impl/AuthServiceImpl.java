package com.backend.service.impl;

import com.backend.dto.request.ChangePasswordRequest;
import com.backend.dto.request.LoginRequest;
import com.backend.dto.request.RegisterRequest;
import com.backend.dto.response.AuthResponse;
import com.backend.entity.PasswordResetToken;
import com.backend.entity.Role;
import com.backend.entity.User;
import com.backend.exception.InvalidCredentialsException;
import com.backend.exception.ResourceAlreadyExistsException;
import com.backend.repository.PasswordResetTokenRepository;
import com.backend.repository.UserRepository;
import com.backend.security.JwtService;
import com.backend.service.AuthService;
import com.backend.service.EmailService;

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
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;

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
        user.setRole(Role.CUSTOMER);
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

    @Override
    public void sendPasswordResetOtp(String email) {
        // Check user exists — but don't reveal if they don't (security best practice)
        boolean userExists = userRepository.findByEmail(email).isPresent();
        if (!userExists) {
            // Silently succeed to prevent email enumeration
            log.warn("Password reset requested for non-existent email: {}", email);
            return;
        }

        // Delete any old tokens for this email
        passwordResetTokenRepository.deleteAllByEmail(email);

        // Generate 6-digit OTP
        String otp = String.format("%06d", new java.util.Random().nextInt(999999));

        PasswordResetToken token = new PasswordResetToken();
        token.setEmail(email);
        token.setOtp(otp);
        token.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        token.setUsed(false);
        passwordResetTokenRepository.save(token);

        emailService.sendOtpEmail(email, otp);
        log.info("Password reset OTP sent for email: {}", email);
    }

    @Override
    public void verifyOtp(String email, String otp) {
        PasswordResetToken token = passwordResetTokenRepository
                .findTopByEmailOrderByExpiresAtDesc(email)
                .orElseThrow(() -> new RuntimeException("No OTP found. Please request a new one."));

        if (token.isUsed()) {
            throw new RuntimeException("This OTP has already been used.");
        }
        if (token.isExpired()) {
            throw new RuntimeException("OTP has expired. Please request a new one.");
        }
        if (!token.getOtp().equals(otp)) {
            throw new RuntimeException("Invalid OTP. Please check and try again.");
        }
        // OTP is valid — frontend will proceed to reset step
    }

    @Override
    @Transactional
    public void resetPassword(String email, String otp, String newPassword) {
        PasswordResetToken token = passwordResetTokenRepository
                .findTopByEmailOrderByExpiresAtDesc(email)
                .orElseThrow(() -> new RuntimeException("No OTP found. Please restart the process."));

        if (token.isUsed()) {
            throw new RuntimeException("This OTP has already been used.");
        }
        if (token.isExpired()) {
            throw new RuntimeException("OTP has expired. Please request a new one.");
        }
        if (!token.getOtp().equals(otp)) {
            throw new RuntimeException("Invalid OTP. Please restart the process.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found."));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Mark token as used
        token.setUsed(true);
        passwordResetTokenRepository.save(token);

        log.info("Password reset successfully for: {}", email);
    }
}