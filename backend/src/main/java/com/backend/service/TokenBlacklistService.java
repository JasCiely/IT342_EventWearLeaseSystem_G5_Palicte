package com.backend.service;

import com.backend.entity.TokenBlacklist;
import com.backend.repository.TokenBlacklistRepository;
import com.backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Date;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenBlacklistService {

    private final TokenBlacklistRepository tokenBlacklistRepository;
    private final JwtService jwtService;

    public void blacklistToken(String token) {
        try {
            String email = jwtService.extractUsername(token);
            Date expiration = jwtService.extractExpiration(token);
            LocalDateTime expiresAt = expiration.toInstant()
                    .atZone(java.time.ZoneId.systemDefault())
                    .toLocalDateTime();

            TokenBlacklist blacklisted = new TokenBlacklist(
                    token,
                    email,
                    LocalDateTime.now(),
                    expiresAt);

            tokenBlacklistRepository.save(blacklisted);
            log.info("Token blacklisted for user: {}", email);

        } catch (Exception e) {
            // Log but don't fail — if token is malformed it's already useless
            log.warn("Could not blacklist token: {}", e.getMessage());
        }
    }

    /**
     * Check if a token has been blacklisted.
     * Called in JwtAuthenticationFilter on every authenticated request.
     */
    public boolean isBlacklisted(String token) {
        return tokenBlacklistRepository.existsByToken(token);
    }

    /**
     * Scheduled cleanup: remove expired tokens from the DB every day at midnight.
     * Keeps the blacklist table from growing indefinitely.
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void cleanupExpiredTokens() {
        log.info("Running token blacklist cleanup...");
        tokenBlacklistRepository.deleteAllExpiredTokens(LocalDateTime.now());
        log.info("Token blacklist cleanup complete.");
    }
}