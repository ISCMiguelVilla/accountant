package com.devs.accountant.user;

import com.devs.accountant.user.dto.UserResponse;
import org.mapstruct.Mapper;

@Mapper
public interface UserMapper {

    UserResponse toResponse(User user);
}
