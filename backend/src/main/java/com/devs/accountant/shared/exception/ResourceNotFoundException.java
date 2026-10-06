package com.devs.accountant.shared.exception;

import java.util.Map;

public class ResourceNotFoundException extends BusinessException {

    public ResourceNotFoundException(String resource, Object id) {
        super(
                ErrorCode.RESOURCE_NOT_FOUND,
                resource + " " + id + " not found",
                Map.of("resource", resource, "id", String.valueOf(id)));
    }
}
