package spring.api.demo.entity.converter;
import spring.api.demo.entity.User;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class MembershipLevelConverter implements AttributeConverter<User.MembershipLevel, String> {

    @Override
    public String convertToDatabaseColumn(User.MembershipLevel attribute) {
        if (attribute == null) {
            return null;
        }
        return attribute.getValue();
    }

    @Override
    public User.MembershipLevel convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.trim().isEmpty()) {
            return User.MembershipLevel.BASIC;
        }
        
        // Handle case-insensitive conversion
        String normalizedData = dbData.toLowerCase().trim();
        
        switch (normalizedData) {
            case "basic":
                return User.MembershipLevel.BASIC;
            case "silver":
                return User.MembershipLevel.SILVER;
            case "gold":
                return User.MembershipLevel.GOLD;
            default:
                return User.MembershipLevel.BASIC;
        }
    }
    
}
