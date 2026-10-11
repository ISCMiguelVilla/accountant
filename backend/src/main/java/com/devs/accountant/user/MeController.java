package com.devs.accountant.user;

import com.devs.accountant.user.dto.LanguageRequest;
import com.devs.accountant.user.dto.UserResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Operations of the authenticated user over their own profile. */
@RestController
@RequestMapping("/me")
@RequiredArgsConstructor
public class MeController {

    private final UserService userService;

    @GetMapping
    public UserResponse me() {
        return userService.me();
    }

    @PatchMapping("/language")
    public UserResponse updateLanguage(@Valid @RequestBody LanguageRequest request) {
        return userService.updateLanguage(request.language());
    }
}
