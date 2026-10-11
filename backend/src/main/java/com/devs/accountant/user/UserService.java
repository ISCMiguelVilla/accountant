package com.devs.accountant.user;

import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import com.devs.accountant.user.dto.UserFilter;
import com.devs.accountant.user.dto.UserResponse;
import com.devs.accountant.user.dto.UserUpdateRequest;

public interface UserService {

    /** Profile of the authenticated user. */
    UserResponse me();

    UserResponse updateLanguage(PreferredLanguage language);

    PageResponse<UserResponse> findAll(UserFilter filter, PageParams params);

    UserResponse findById(Long id);

    UserResponse update(Long id, UserUpdateRequest request);
}
