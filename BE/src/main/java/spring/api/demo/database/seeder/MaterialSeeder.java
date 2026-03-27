package spring.api.demo.database.seeder;

import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import spring.api.demo.entity.MaterialDictionary;
import spring.api.demo.repository.MaterialDictionaryRepository;

import java.util.List;

@Component
@Order(2)
public class MaterialSeeder implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(MaterialSeeder.class);

    private final MaterialDictionaryRepository materialDictionaryRepository;

    public MaterialSeeder(MaterialDictionaryRepository materialDictionaryRepository) {
        this.materialDictionaryRepository = materialDictionaryRepository;
    }

    @Transactional
    @Override
    public void run(String... args) {
        if (materialDictionaryRepository.count() > 0) {
            logger.info("Material dictionary already seeded. Skipping.");
            return;
        }

        List<MaterialDictionary> materials = List.of(
            // code, name, quality, breathability, durability, softness, warmth
            material("cotton",        "Cotton (Bông)",           75, 85, 60, 80, 40),
            material("organic_cotton","Cotton hữu cơ",          85, 88, 60, 85, 42),
            material("polyester",     "Polyester",               55, 30, 85, 40, 50),
            material("silk",          "Lụa (Silk)",              95, 70, 40, 95, 30),
            material("leather",       "Da thật (Leather)",       90, 25, 90, 30, 70),
            material("pu_leather",    "Da tổng hợp (PU)",        45, 20, 50, 35, 55),
            material("linen",         "Vải lanh (Linen)",        80, 90, 65, 60, 25),
            material("denim",         "Denim (Vải bò)",          70, 50, 90, 45, 55),
            material("fleece",        "Nỉ (Fleece)",             60, 35, 70, 75, 85),
            material("wool",          "Len (Wool)",              85, 55, 75, 65, 90),
            material("khaki",         "Kaki (Khaki)",            65, 55, 75, 50, 45),
            material("chiffon",       "Voan (Chiffon)",          70, 80, 30, 70, 10),
            material("lace",          "Ren (Lace)",              75, 75, 35, 60, 15),
            material("satin",         "Satin",                   80, 40, 50, 90, 25),
            material("velvet",        "Nhung (Velvet)",          85, 30, 55, 90, 70),
            material("canvas",        "Canvas",                  55, 45, 90, 30, 45),
            material("spandex",       "Spandex/Elastane",        50, 50, 60, 55, 35),
            material("rayon",         "Rayon",                   60, 70, 40, 75, 30),
            material("bamboo",        "Sợi tre (Bamboo)",        80, 90, 55, 80, 35),
            material("cashmere",      "Cashmere",                98, 60, 45, 98, 88),
            material("suede",         "Da lộn (Suede)",          80, 30, 50, 85, 60),
            material("nylon",         "Nylon",                   50, 25, 85, 35, 40),
            material("modal",         "Modal",                   75, 80, 55, 90, 30),
            material("tweed",         "Tweed",                   80, 40, 85, 40, 85),
            material("organza",       "Organza",                 70, 65, 35, 30, 10),
            material("taffeta",       "Taffeta",                 65, 30, 60, 35, 30),
            material("jersey",        "Jersey",                  65, 70, 55, 75, 40),
            material("corduroy",      "Nhung kẻ (Corduroy)",     70, 45, 75, 65, 70),
            material("lycra",         "Lycra",                   55, 50, 65, 55, 35)
        );

        materialDictionaryRepository.saveAll(materials);
        logger.info("Seeded {} materials into material_dictionary.", materials.size());
    }

    private MaterialDictionary material(String code, String name,
                                         int quality, int breathability,
                                         int durability, int softness, int warmth) {
        return MaterialDictionary.builder()
                .code(code)
                .name(name)
                .qualityScore(quality)
                .breathabilityScore(breathability)
                .durabilityScore(durability)
                .softnessScore(softness)
                .warmthScore(warmth)
                .build();
    }
}
