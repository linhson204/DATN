package spring.api.demo.database.seeder;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.boot.CommandLineRunner;
import spring.api.demo.entity.Role;
import spring.api.demo.entity.User;
import spring.api.demo.repository.RoleRepository;
import spring.api.demo.repository.UserRepository;

@Component
public class DatabaseSeeder implements CommandLineRunner {
    private static final Logger logger = LoggerFactory.getLogger(DatabaseSeeder.class);

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Transactional
    @Override
    public void run(String... args) throws Exception {
        boolean shouldSeed = true; // Set to false to skip seeding
        if (shouldSeed) {
            // Role adminRole = roleRepository.findByName("admin")
            //         .orElseGet(() -> roleRepository.save(Role.builder().name("admin").build()));

            // String passwordEncoded = passwordEncoder.encode("123456");

            // User user = User.builder()
            //         .username("admin")
            //         .fullName("Nguyen Linh Son")
            //         .email("admin@example.com")
            //         .passwordHash(passwordEncoded)
            //         .phoneNumber("0123456789")
            //         .address("123 Admin St, City, Country")
            //         .role(adminRole)
            //         .status(true)
            //         .build();
            // shouldSeed = false; // Prevent re-seeding on next run

            // userRepository.save(user);
            logger.info("Database has been seeded.");
        } else {
            logger.info("Database already has data. Skipping seeding.");
        }
    }

    private boolean isTableEmpty() {
        Long count = (Long) entityManager.createQuery("SELECT COUNT(u.id) FROM User u").getSingleResult();
        return count == 0;
    }
}