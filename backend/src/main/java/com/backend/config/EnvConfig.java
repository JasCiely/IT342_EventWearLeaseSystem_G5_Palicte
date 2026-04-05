package com.backend.config;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.context.annotation.Configuration;
import java.io.File;

@Configuration
public class EnvConfig {
    static {
        try {
            Dotenv dotenv = null;
            String currentDir = System.getProperty("user.dir");

            if (new File(currentDir + "/.env").exists()) {
                dotenv = Dotenv.configure()
                        .directory(currentDir)
                        .load();
                System.out.println("✅ .env loaded from: " + currentDir);
            } else if (new File(currentDir + "/backend/.env").exists()) {
                dotenv = Dotenv.configure()
                        .directory(currentDir + "/backend")
                        .load();
                System.out.println("✅ .env loaded from: " + currentDir + "/backend");
            } else {
                System.out.println("⚠️ .env file not found in: " + currentDir);
                System.out.println("Creating empty dotenv - using system environment variables only");
                dotenv = Dotenv.configure()
                        .ignoreIfMissing()
                        .load();
            }

            if (dotenv != null) {
                dotenv.entries().forEach(entry -> {
                    System.setProperty(entry.getKey(), entry.getValue());
                });
            }

        } catch (Exception e) {
            System.out.println("❌ Error loading .env file: " + e.getMessage());
        }
    }
}