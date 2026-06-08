package spring.api.demo.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import spring.api.demo.dto.user.response.UserResponse;
import spring.api.demo.entity.User;
import spring.api.demo.exception.AppException;
import spring.api.demo.exception.ErrorCode;
import spring.api.demo.repository.UserRepository;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public UserResponse getMe(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return UserResponse.builder()
                .id(String.valueOf(user.getId()))
                .username(user.getUsername())
                .email(user.getEmail())
                .name(user.getFullName())
                .role(user.getRole() != null ? user.getRole().getName() : null)
                .phone(user.getPhoneNumber())
                .address(user.getAddress())
                .gender(user.getGender())
                .birthYear(user.getBirthYear())
                .point(user.getPoints())
                .balance(user.getBalance())
                .totalSpent(user.getTotalPurchase())
                .membershipLevel(user.getMembershipLevel() != null ? user.getMembershipLevel().getValue() : null)
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .isActive(user.getStatus())
                .build();
    }
}
