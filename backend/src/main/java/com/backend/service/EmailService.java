package com.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    public void sendOtpEmail(String toEmail, String otp) {

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message);

        try {
            helper.setFrom("yourgmail@gmail.com", "EventWear");
            helper.setTo(toEmail);
            helper.setSubject("EventWear – Your Password Reset Code");
            helper.setText(
                    "Hi,\n\n" +
                            "You requested to reset your EventWear password.\n\n" +
                            "Your OTP code is: " + otp + "\n\n" +
                            "This code expires in 1 minute. Do not share it with anyone.\n\n" +
                            "If you did not request this, please ignore this email.\n\n" +
                            "– The EventWear Team");
            mailSender.send(message);
            log.info("OTP email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send OTP email to {}: {}", toEmail, e.getMessage());
            throw new RuntimeException("Failed to send OTP email. Please try again.");
        }
    }
}