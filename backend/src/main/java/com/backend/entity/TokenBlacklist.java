package com.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "token_blacklist", indexes = {
        @Index(name = "idx_token_blacklist_token", columnList = "token"),
        @Index(name = "idx_token_blacklist_expires_at", columnList = "expiresAt")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TokenBlacklist {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    // Store only the last 36 chars (JWT ID) or the full token
    // We store full token for simplicity — indexed for fast lookup
    @Column(nullable = false, unique = true, length = 2048)
    private String token;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private LocalDateTime blacklistedAt;

    // When the token naturally expires — used for cleanup
    @Column(nullable = false)
    private LocalDateTime expiresAt;

    public TokenBlacklist(String token, String email, LocalDateTime blacklistedAt, LocalDateTime expiresAt) {
        this.token = token;
        this.email = email;
        this.blacklistedAt = blacklistedAt;
        this.expiresAt = expiresAt;
    }
}