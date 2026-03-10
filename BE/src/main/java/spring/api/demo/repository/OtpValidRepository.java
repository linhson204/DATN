package spring.api.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import spring.api.demo.entity.OtpValid;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OtpValidRepository extends JpaRepository<OtpValid, UUID> {

    Optional<OtpValid> findTopByEmailAndTypeAndIsUsedFalseOrderByCreatedAtDesc(String email, String type);

    @Modifying
    @Query("UPDATE OtpValid p SET p.isUsed = true WHERE p.email = :email AND p.type = :type AND p.isUsed = false")
    void invalidateAllByEmailAndType(String email, String type);
}
