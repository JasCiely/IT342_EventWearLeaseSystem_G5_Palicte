package com.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "items")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Item {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    private String subtype;
    private String size;
    private String color;

    @Column(nullable = false)
    private Double price;

    @Column(nullable = false)
    private String status = "Available";

    private String ageRange;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Stored as comma-separated Supabase CDN URLs
    @Column(name = "media_urls", columnDefinition = "TEXT")
    private String mediaUrls;

    // Stored as comma-separated types matching mediaUrls order ("image" or "video")
    @Column(name = "media_types", columnDefinition = "TEXT")
    private String mediaTypes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}