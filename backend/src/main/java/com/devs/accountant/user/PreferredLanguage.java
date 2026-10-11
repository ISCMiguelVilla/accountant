package com.devs.accountant.user;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;

/** UI language stored per user; serialized as its lowercase ISO code ({@code es}, {@code en}). */
public enum PreferredLanguage {
    ES("es"),
    EN("en");

    private final String code;

    PreferredLanguage(String code) {
        this.code = code;
    }

    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static PreferredLanguage fromCode(String code) {
        return Arrays.stream(values())
                .filter(language -> language.code.equalsIgnoreCase(code))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported language: " + code));
    }

    @Converter(autoApply = true)
    public static class JpaConverter implements AttributeConverter<PreferredLanguage, String> {

        @Override
        public String convertToDatabaseColumn(PreferredLanguage language) {
            return language == null ? null : language.code;
        }

        @Override
        public PreferredLanguage convertToEntityAttribute(String code) {
            return code == null ? null : fromCode(code);
        }
    }
}
