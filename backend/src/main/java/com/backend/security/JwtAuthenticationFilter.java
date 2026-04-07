package com.backend.security;

import com.backend.service.TokenBlacklistService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final TokenBlacklistService tokenBlacklistService;

    // Public routes - skip JWT processing entirely for these
    private static final List<String> PUBLIC_ROUTES = List.of(
            "/api/auth/login",
            "/api/auth/register");

    // Public GET endpoints for inventory
    private static final List<String> PUBLIC_GET_PATHS = List.of(
            "/api/inventory/items",
            "/api/inventory/promotions");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        String method = request.getMethod();

        // Skip login/register endpoints
        if (PUBLIC_ROUTES.stream().anyMatch(path::equals)) {
            return true;
        }

        // Skip public GET endpoints for inventory
        if (method.equals("GET") && PUBLIC_GET_PATHS.stream().anyMatch(path::startsWith)) {
            return true;
        }

        return false;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        // If no auth header, just continue (let SecurityConfig handle authorization)
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.debug("No JWT token found for request: {} {}", request.getMethod(), request.getServletPath());
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = authHeader.substring(7);
        final String userEmail;

        // Safely extract email — if token is malformed just pass through
        try {
            userEmail = jwtService.extractUsername(jwt);
        } catch (Exception e) {
            log.warn("Failed to extract username from JWT: {}", e.getMessage());
            filterChain.doFilter(request, response);
            return;
        }

        // Reject blacklisted tokens (tokens invalidated on logout)
        if (tokenBlacklistService.isBlacklisted(jwt)) {
            log.warn("Blacklisted token used for request: {} {}", request.getMethod(), request.getServletPath());
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"Token has been invalidated. Please log in again.\"}");
            return;
        }

        if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                UserDetails userDetails = this.userDetailsService.loadUserByUsername(userEmail);

                if (jwtService.isTokenValid(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    log.debug("Authenticated user: {}", userEmail);
                } else {
                    log.warn("Invalid JWT token for user: {}", userEmail);
                }
            } catch (Exception e) {
                log.error("Error loading user details: {}", e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }
}