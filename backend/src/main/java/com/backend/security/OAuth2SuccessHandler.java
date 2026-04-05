package com.backend.security;

import com.backend.entity.Role;
import com.backend.entity.User;
import com.backend.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.cors.origin:http://localhost:5173}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException {

        try {
            OAuth2User oauthUser = (OAuth2User) authentication.getPrincipal();

            String email = oauthUser.getAttribute("email");
            String firstName = oauthUser.getAttribute("given_name");
            String lastName = oauthUser.getAttribute("family_name");

            // Fallback if given_name / family_name are null
            if (firstName == null || firstName.isBlank()) {
                String fullName = oauthUser.getAttribute("name");
                if (fullName != null && fullName.contains(" ")) {
                    String[] parts = fullName.split(" ", 2);
                    firstName = parts[0];
                    lastName = parts[1];
                } else {
                    firstName = fullName != null ? fullName : "User";
                    lastName = "-";
                }
            }
            if (lastName == null || lastName.isBlank()) {
                lastName = "-";
            }

            // ── Detect flow from the OAuth2 client registration ID ──────────
            // This is reliable — Spring Security passes it through the whole flow
            boolean isRegisterFlow = false;
            if (authentication instanceof OAuth2AuthenticationToken oauthToken) {
                String registrationId = oauthToken.getAuthorizedClientRegistrationId();
                isRegisterFlow = registrationId != null && registrationId.contains("register");
            }

            Optional<User> existingUser = userRepository.findByEmail(email);

            // ── SIGN IN flow + email NOT in database → block ────────────────
            if (!isRegisterFlow && existingUser.isEmpty()) {
                getRedirectStrategy().sendRedirect(request, response,
                        frontendUrl + "/auth?error=not_registered");
                return;
            }

            // ── All other cases ─────────────────────────────────────────────
            // SIGN UP + new user → create account then log in
            // SIGN UP + already registered → just log them in
            // SIGN IN + already registered → log in normally
            final String finalFirstName = firstName;
            final String finalLastName = lastName;

            User user = existingUser.orElseGet(() -> {
                User newUser = new User();
                newUser.setEmail(email);
                newUser.setFirstName(finalFirstName);
                newUser.setLastName(finalLastName);
                newUser.setRole(Role.CUSTOMER);
                newUser.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
                newUser.setActive(true);
                return userRepository.save(newUser);
            });

            // Generate JWT
            String token = jwtService.generateToken(
                    Map.of(
                            "role", user.getRole().name(),
                            "firstName", user.getFirstName(),
                            "lastName", user.getLastName()),
                    user);

            String redirectUrl = frontendUrl + "/oauth2/callback"
                    + "?token=" + token
                    + "&email=" + user.getEmail()
                    + "&firstName=" + user.getFirstName()
                    + "&lastName=" + user.getLastName()
                    + "&role=" + user.getRole().name();

            getRedirectStrategy().sendRedirect(request, response, redirectUrl);

        } catch (Exception e) {
            System.err.println("OAuth2 login failed: " + e.getMessage());
            e.printStackTrace();
            getRedirectStrategy().sendRedirect(request, response,
                    frontendUrl + "/auth?error=oauth_failed");
        }
    }
}