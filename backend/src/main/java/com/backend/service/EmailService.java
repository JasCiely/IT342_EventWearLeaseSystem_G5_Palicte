package com.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.name:EventWear}")
    private String appName;

    public void sendOtpEmail(String toEmail, String otp) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail, appName);
            helper.setTo(toEmail);
            helper.setSubject(appName + " – Your Password Reset Code");

            String htmlContent = String.format(
                    """
                            <!DOCTYPE html>
                            <html>
                            <head><meta charset="UTF-8"></head>
                            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                                    <h2 style="color: #6b2d39; text-align: center;">%s</h2>
                                    <p>Hi,</p>
                                    <p>You requested to reset your %s password.</p>
                                    <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
                                        <strong style="font-size: 24px; letter-spacing: 5px;">%s</strong>
                                    </div>
                                    <p>This code expires in <strong>1 minute</strong>. Do not share it with anyone.</p>
                                    <p>If you did not request this, please ignore this email.</p>
                                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                                    <p style="font-size: 12px; color: #999; text-align: center;">– The %s Team</p>
                                </div>
                            </body>
                            </html>
                            """,
                    appName, appName, otp, appName);

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("OTP email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send OTP email to {}: {}", toEmail, e.getMessage());
            throw new RuntimeException("Failed to send OTP email. Please try again.");
        }
    }

    public void sendFittingConfirmation(String toEmail, String customerName,
            String bookingId, String itemName,
            String fittingDate, String fittingTime) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail, appName);
            helper.setTo(toEmail);
            helper.setSubject(appName + " – Fitting Booking Confirmation #" + bookingId);

            String htmlContent = String.format(
                    """
                            <!DOCTYPE html>
                            <html>
                            <head><meta charset="UTF-8"></head>
                            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                                    <div style="text-align: center; border-bottom: 2px solid #6b2d39; padding-bottom: 10px; margin-bottom: 20px;">
                                        <h2 style="color: #6b2d39; margin: 0;">%s</h2>
                                        <p style="margin: 5px 0 0; color: #666;">Fitting Booking Confirmation</p>
                                    </div>

                                    <p>Dear <strong>%s</strong>,</p>
                                    <p>Your fitting booking has been <strong style="color: #15803d;">confirmed</strong>!</p>

                                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                        <h3 style="margin: 0 0 10px 0; color: #6b2d39;">Booking Details</h3>
                                        <table style="width: 100%%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 8px 0; width: 120px;"><strong>Booking ID:</strong></td>
                                                <td style="padding: 8px 0;">%s</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;"><strong>Item:</strong></td>
                                                <td style="padding: 8px 0;">%s</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;"><strong>Date:</strong></td>
                                                <td style="padding: 8px 0;">%s</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;"><strong>Time:</strong></td>
                                                <td style="padding: 8px 0;">%s</td>
                                            </tr>
                                        </table>
                                    </div>

                                    <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                                        <strong>📌 Important Reminder:</strong>
                                        <ul style="margin: 10px 0 0 20px;">
                                            <li>Please arrive <strong>10 minutes before</strong> your scheduled time</li>
                                            <li>If you need to reschedule, please contact us at least 24 hours in advance</li>
                                            <li>Bring a valid ID for verification</li>
                                        </ul>
                                    </div>

                                    <p>We look forward to helping you find the perfect attire!</p>

                                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                                    <p style="font-size: 12px; color: #999; text-align: center;">
                                        Need help? Contact us at support@eventwear.com<br>
                                        – The %s Team
                                    </p>
                                </div>
                            </body>
                            </html>
                            """,
                    appName, customerName, bookingId, itemName, fittingDate, fittingTime, appName);

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Fitting confirmation email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send fitting confirmation email to {}: {}", toEmail, e.getMessage());
            // Don't throw exception - booking is still successful even if email fails
        }
    }
}