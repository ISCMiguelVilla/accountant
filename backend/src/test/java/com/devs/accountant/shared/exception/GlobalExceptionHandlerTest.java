package com.devs.accountant.shared.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-06T18:00:00Z"), ZoneId.of("America/Mexico_City"));
        mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
                .setControllerAdvice(new GlobalExceptionHandler(new ProblemDetails(clock)))
                .build();
    }

    @Test
    void businessExceptionIsRenderedAsProblemDetailWithCodeAndParams() throws Exception {
        mockMvc.perform(get("/business"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("INSUFFICIENT_FUNDS"))
                .andExpect(jsonPath("$.title").value("INSUFFICIENT_FUNDS"))
                .andExpect(jsonPath("$.params.available").value("10.00"))
                .andExpect(jsonPath("$.transactionUuid").value("tx-1"))
                .andExpect(jsonPath("$.timestamp").value("2026-10-06T12:00-06:00"));
    }

    @Test
    void notFoundUsesResourceNotFoundCode() throws Exception {
        mockMvc.perform(get("/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.params.resource").value("Account"));
    }

    @Test
    void beanValidationErrorsAreReportedPerField() throws Exception {
        mockMvc.perform(post("/validated")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.name").exists());
    }

    @Test
    void unreadableBodyIsMalformedRequest() throws Exception {
        mockMvc.perform(post("/validated")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not-json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }

    @Test
    void unexpectedErrorsHideInternalDetails() throws Exception {
        mockMvc.perform(get("/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.detail").value("Unexpected error"));
    }

    @RestController
    static class TestController {

        @GetMapping("/business")
        void business() {
            throw new BusinessException(
                    ErrorCode.INSUFFICIENT_FUNDS, "Not enough funds", Map.of("available", "10.00"), "tx-1");
        }

        @GetMapping("/missing")
        void missing() {
            throw new ResourceNotFoundException("Account", 7);
        }

        @GetMapping("/boom")
        void boom() {
            throw new IllegalStateException("secret internal detail");
        }

        @PostMapping("/validated")
        void validated(@Valid @RequestBody NamedRequest request) {}
    }

    record NamedRequest(@NotBlank String name) {}
}
