package com.backend.shared.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class JacksonConfig {

    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .findAndRegisterModules()
                .configure(SerializationFeature.FAIL_ON_EMPTY_BEANS, false)
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}