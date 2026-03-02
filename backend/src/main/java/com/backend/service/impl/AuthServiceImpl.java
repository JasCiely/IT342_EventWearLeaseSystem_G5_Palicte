package com.backend.service.impl;

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
        // Check if email already exists
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResourceAlreadyExistsException("Email", "email", request.getEmail());
        }

        // Create new user
        User user = new User();
        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(request.getEmail().toLowerCase().trim());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.USER);
        user.setActive(true);
        user.setMustChangePassword(false);

        // Save user
        User savedUser = userRepository.save(user);

        // Generate JWT token
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
            // FIX: Use the authentication principal directly to avoid unused variable
            // warning
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail().toLowerCase().trim(),
                            request.getPassword()));

            // FIX: Get user from authenticated principal instead of re-querying
            User user = (User) authentication.getPrincipal();

            // Update last login time
            user.setLastLoginAt(LocalDateTime.now());
            userRepository.save(user);

            // Generate JWT token
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
}