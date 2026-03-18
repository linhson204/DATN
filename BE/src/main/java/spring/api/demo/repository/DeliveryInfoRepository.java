package spring.api.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import spring.api.demo.entity.DeliveryInfo;

import java.util.UUID;

@Repository
public interface DeliveryInfoRepository extends JpaRepository<DeliveryInfo, UUID> {
}
