package spring.api.demo.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import spring.api.demo.dto.user.request.UserRequest;
import spring.api.demo.entity.User;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.UserRepository;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public UserRequest getMe(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return UserRequest.builder()
                .id(String.valueOf(user.getId()))
                .email(user.getEmail())
                .name(user.getFullName())
                .role(String.valueOf(user.getRole().getName()))
                .build();
    }
}
