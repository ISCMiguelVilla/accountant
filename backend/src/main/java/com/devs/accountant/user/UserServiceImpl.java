package com.devs.accountant.user;

import com.devs.accountant.shared.exception.BusinessException;
import com.devs.accountant.shared.exception.ErrorCode;
import com.devs.accountant.shared.exception.ResourceNotFoundException;
import com.devs.accountant.shared.paging.PageParams;
import com.devs.accountant.shared.paging.PageResponse;
import com.devs.accountant.shared.paging.QueryDefinition;
import com.devs.accountant.shared.paging.Specs;
import com.devs.accountant.shared.security.CurrentUser;
import com.devs.accountant.user.dto.UserFilter;
import com.devs.accountant.user.dto.UserResponse;
import com.devs.accountant.user.dto.UserUpdateRequest;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    static final QueryDefinition QUERY = QueryDefinition.builder()
            .sortable("name", "username", "createdAt")
            .filterable("name", "status", "role")
            .defaultSort(Sort.by("name"))
            .build();

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final CurrentUser currentUser;

    @Override
    @Transactional(readOnly = true)
    public UserResponse me() {
        return userMapper.toResponse(load(currentUser.id()));
    }

    @Override
    @Transactional
    public UserResponse updateLanguage(PreferredLanguage language) {
        User user = load(currentUser.id());
        user.setPreferredLanguage(language);
        return userMapper.toResponse(user);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UserResponse> findAll(UserFilter filter, PageParams params) {
        var spec = Specs.<User>all(
                Specs.contains(filter.name(), "name", "username"),
                Specs.in("status", filter.status()),
                Specs.in("role", filter.role()));
        return PageResponse.of(userRepository.findAll(spec, QUERY.toPageable(params)), userMapper::toResponse, QUERY);
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse findById(Long id) {
        return userMapper.toResponse(load(id));
    }

    @Override
    @Transactional
    public UserResponse update(Long id, UserUpdateRequest request) {
        User user = load(id);
        if (user.isAdmin() && request.status() != UserStatus.ACTIVE) {
            throw new BusinessException(
                    ErrorCode.FORBIDDEN, "The administrator cannot be disabled", Map.of("reason", "ADMIN_IMMUTABLE"));
        }
        user.setName(request.name().trim());
        user.setStatus(request.status());
        log.info("User {} updated by admin {}", id, currentUser.id());
        return userMapper.toResponse(user);
    }

    private User load(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("User", id));
    }
}
