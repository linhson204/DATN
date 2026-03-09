package spring.api.demo.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import spring.api.demo.dto.user.request.UserRequest;
import spring.api.demo.entity.User;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.UserRepository;
import spring.api.demo.resource.SuccessResource;

@RestController
@RequestMapping("v1")
public class UserController {


    @Autowired
    private UserRepository userRepository;

    @GetMapping("/users/me")
    public ResponseEntity<?> getMe() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException(ErrorCode.USER_NOT_FOUND.getMessage()));

        UserRequest userRequest = UserRequest.builder()
                .id(String.valueOf(user.getId()))
                .email(user.getEmail())
                .name(user.getFullName())
                .role(String.valueOf(user.getRole().getName()))
                .build();

        return ResponseEntity.ok(new SuccessResource<>("Lấy thông tin thành công", userRequest));
    }
}
