package com.devs.accountant.auth;

import com.devs.accountant.auth.dto.AuthResponse;
import com.devs.accountant.auth.dto.SignInRequest;
import com.devs.accountant.auth.dto.SignUpRequest;

public interface AuthService {

    AuthResponse signIn(SignInRequest request);

    /** Registers a user and signs them in. The very first user becomes the only ADMIN. */
    AuthResponse signUp(SignUpRequest request);
}
