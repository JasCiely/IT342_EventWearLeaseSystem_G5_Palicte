package com.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import java.math.BigDecimal;

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
        }
    }

    public void sendDirectBookingConfirmation(String toEmail, String customerName,
            String bookingId, String itemName,
            String startDate, String endDate,
            int totalDays, BigDecimal finalPrice) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail, appName);
            helper.setTo(toEmail);
            helper.setSubject(appName + " – Direct Booking Confirmation #" + bookingId);

            String htmlContent = String.format(
                    """
                            <!DOCTYPE html>
                            <html>
                            <head><meta charset="UTF-8"></head>
                            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                                    <div style="text-align: center; border-bottom: 2px solid #15803d; padding-bottom: 10px; margin-bottom: 20px;">
                                        <h2 style="color: #15803d; margin: 0;">%s</h2>
                                        <p style="margin: 5px 0 0; color: #666;">Direct Booking Confirmation</p>
                                    </div>

                                    <p>Dear <strong>%s</strong>,</p>
                                    <p>Your direct booking has been <strong style="color: #15803d;">submitted successfully</strong> and is now pending approval!</p>

                                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                        <h3 style="margin: 0 0 10px 0; color: #15803d;">Booking Details</h3>
                                        <table style="width: 100%%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 8px 0; width: 140px;"><strong>Booking ID:</strong></td>
                                                <td style="padding: 8px 0;">%s</td>
                                             </tr>
                                             <tr>
                                                <td style="padding: 8px 0;"><strong>Item:</strong></td>
                                                <td style="padding: 8px 0;">%s</td>
                                             </tr>
                                             <tr>
                                                <td style="padding: 8px 0;"><strong>Rental Period:</strong></td>
                                                <td style="padding: 8px 0;">%s to %s</td>
                                             </tr>
                                             <tr>
                                                <td style="padding: 8px 0;"><strong>Total Days:</strong></td>
                                                <td style="padding: 8px 0;">%d days</td>
                                             </tr>
                                             <tr>
                                                <td style="padding: 8px 0;"><strong>Total Amount:</strong></td>
                                                <td style="padding: 8px 0;"><strong style="color: #15803d; font-size: 16px;">₱%s</strong></td>
                                             </tr>
                                        </table>
                                    </div>

                                    <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                                        <strong>📌 Next Steps:</strong>
                                        <ul style="margin: 10px 0 0 20px;">
                                            <li>Our team will review your booking within <strong>24 hours</strong></li>
                                            <li>You will receive another email once your booking is approved</li>
                                            <li>After approval, you will be contacted for payment and pickup arrangements</li>
                                        </ul>
                                    </div>

                                    <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid #15803d; margin: 20px 0;">
                                        <strong>💰 Payment Information:</strong>
                                        <ul style="margin: 10px 0 0 20px;">
                                            <li>Full payment is required upon approval</li>
                                            <li>Payment methods: GCash, Bank Transfer, or Cash on Pickup</li>
                                            <li>A security deposit may be required for high-value items</li>
                                        </ul>
                                    </div>

                                    <p>If you have any questions, please don't hesitate to contact us.</p>

                                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                                    <p style="font-size: 12px; color: #999; text-align: center;">
                                        Need help? Contact us at support@eventwear.com<br>
                                        – The %s Team
                                    </p>
                                </div>
                            </body>
                            </html>
                            """,
                    appName, customerName, bookingId, itemName, startDate, endDate, totalDays,
                    finalPrice.toString(), appName);

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Direct booking confirmation email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send direct booking confirmation email to {}: {}", toEmail, e.getMessage());
        }
    }

    public void sendDirectBookingStatusUpdate(String toEmail, String customerName,
            String itemName, String status, String bookingId) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail, appName);
            helper.setTo(toEmail);
            helper.setSubject(appName + " – Direct Booking Status Update #" + bookingId);

            String statusColor = status.equals("Approved") ? "#15803d"
                    : (status.equals("Rejected") ? "#dc2626" : "#f59e0b");
            String statusDisplay = status.equals("Approved") ? "Approved"
                    : (status.equals("Rejected") ? "Rejected" : "Confirmed");

            String htmlContent = String.format(
                    """
                            <!DOCTYPE html>
                            <html>
                            <head><meta charset="UTF-8"></head>
                            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                                    <div style="text-align: center; border-bottom: 2px solid %s; padding-bottom: 10px; margin-bottom: 20px;">
                                        <h2 style="color: %s; margin: 0;">%s</h2>
                                        <p style="margin: 5px 0 0; color: #666;">Direct Booking Status Update</p>
                                    </div>

                                    <p>Dear <strong>%s</strong>,</p>
                                    <p>Your direct booking for <strong>%s</strong> has been <strong style="color: %s;">%s</strong>!</p>

                                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                        <h3 style="margin: 0 0 10px 0; color: %s;">Booking Details</h3>
                                        <table style="width: 100%%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 8px 0; width: 140px;"><strong>Booking ID:</strong></td>
                                                <td style="padding: 8px 0;">%s</td>
                                             </tr>
                                        </table>
                                    </div>
                                    """,
                    statusColor, statusColor, statusDisplay, customerName, itemName, statusColor, statusDisplay,
                    statusColor, bookingId);

            if (status.equals("Approved")) {
                htmlContent += """
                        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid #15803d; margin: 20px 0;">
                            <strong>✅ What's Next?</strong>
                            <ul style="margin: 10px 0 0 20px;">
                                <li>Our team will contact you within 24 hours for payment arrangements</li>
                                <li>Once payment is confirmed, your booking will be finalized</li>
                                <li>Pickup details will be provided after payment</li>
                            </ul>
                        </div>
                        """;
            } else if (status.equals("Rejected")) {
                htmlContent += """
                        <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #dc2626; margin: 20px 0;">
                            <strong>❌ Booking Rejected</strong>
                            <ul style="margin: 10px 0 0 20px;">
                                <li>The item may no longer be available for your selected dates</li>
                                <li>Please try booking different dates or browse other items</li>
                                <li>Contact us if you need assistance finding an alternative</li>
                            </ul>
                        </div>
                        """;
            }

            htmlContent += String.format("""
                            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                            <p style="font-size: 12px; color: #999; text-align: center;">
                                Need help? Contact us at support@eventwear.com<br>
                                – The %s Team
                            </p>
                        </div>
                    </body>
                    </html>
                    """, appName);

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Direct booking status update email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send status update email to {}: {}", toEmail, e.getMessage());
        }
    }
}