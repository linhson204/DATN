package spring.api.demo.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;
import spring.api.demo.dto.user.request.UserRequest;
import spring.api.demo.resource.SuccessResource;
import spring.api.demo.service.UserService;

@RestController
@RequestMapping("/v1")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/users/me")
    public ResponseEntity<SuccessResource<UserRequest>> getMe() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        System.out.println("Authenticated user's email: " + email);
        UserRequest userRequest = userService.getMe(email);
        return ResponseEntity.ok(new SuccessResource<>("Lấy thông tin người dùng thành công", userRequest));
    }

}
