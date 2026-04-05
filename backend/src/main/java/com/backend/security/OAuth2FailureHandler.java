package com.backend.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Handles OAuth2 authentication failures, including user cancellations.
 * Redirects users back to the auth page with appropriate error parameters.
 */
@Slf4j
@Component
public class OAuth2FailureHandler extends SimpleUrlAuthenticationFailureHandler {

    @Value("${app.cors.origin:http://localhost:5173}")
    private String frontendUrl;

    @Override
    public void onAuthenticationFailure(HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception) throws IOException, ServletException {

        String errorParam = "oauth_failed";

        // Determine the specific error type
        if (exception instanceof OAuth2AuthenticationException oauth2Exception) {
            OAuth2Error error = oauth2Exception.getError();
            String errorCode = error.getErrorCode();

            log.warn("OAuth2 authentication failed: errorCode={}, description={}",
                    errorCode, error.getDescription());

            // Handle common OAuth2 error codes
            switch (errorCode) {
                case "access_denied":
                    // User cancelled the sign-in or denied permissions
                    errorParam = "cancelled";
                    log.info("User cancelled OAuth2 sign-in");
                    break;
                case "invalid_request":
                case "unauthorized_client":
                case "unsupported_response_type":
                case "invalid_scope":
                case "server_error":
                case "temporarily_unavailable":
                    errorParam = "oauth_failed";
                    break;
                default:
                    errorParam = "oauth_failed";
            }
        } else {
            log.error("OAuth2 authentication failed with unexpected exception", exception);
        }

        // Redirect back to auth page with error parameter
        String redirectUrl = frontendUrl + "/auth?error=" + errorParam;
        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }
}