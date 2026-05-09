package com.backend.shared.security;

public interface TokenBlacklistService {
    void blacklistToken(String token);

    boolean isBlacklisted(String token);
}
