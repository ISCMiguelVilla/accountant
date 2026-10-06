package com.devs.accountant.shared.security;

import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.shared.exception.ProblemDetails;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/** Writes the 401/403 responses raised by the security filter chain as {@link ProblemDetail}. */
@Component
@RequiredArgsConstructor
public class ProblemDetailAuthenticationHandlers {

    private final ProblemDetails problems;
    private final JsonMapper jsonMapper;

    public AuthenticationEntryPoint entryPoint() {
        return (request, response, ex) -> write(response, ErrorCode.BAD_CREDENTIALS, "Authentication required");
    }

    public AccessDeniedHandler accessDeniedHandler() {
        return (request, response, ex) -> write(response, ErrorCode.FORBIDDEN, "Access denied");
    }

    private void write(HttpServletResponse response, ErrorCode code, String detail) throws IOException {
        ProblemDetail problem = problems.of(code, detail);
        response.setStatus(code.status().value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        jsonMapper.writeValue(response.getOutputStream(), problem);
    }
}
