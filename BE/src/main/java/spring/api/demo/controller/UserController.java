package spring.api.demo.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;
import spring.api.demo.dto.user.request.UpdateUserRequest;
import spring.api.demo.dto.user.response.UserResponse;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.UserService;

@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/users/me")
    public ResponseEntity<SuccessResource<UserResponse>> getMe() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        UserResponse userResponse = userService.getMe(email);
        return ResponseEntity.ok(new SuccessResource<>("Lấy thông tin người dùng thành công", userResponse));
    }

    @PutMapping("/users/me")
    public ResponseEntity<SuccessResource<UserResponse>> updateMe(
            @Valid @RequestBody UpdateUserRequest request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        UserResponse userResponse = userService.updateMe(email, request);
        return ResponseEntity.ok(new SuccessResource<>("Cập nhật thông tin thành công", userResponse));
    }

}

