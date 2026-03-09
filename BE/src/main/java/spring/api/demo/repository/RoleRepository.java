package spring.api.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import spring.api.demo.entity.Role;

import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Integer> {
    Optional<Role> findByName(String name);
}
