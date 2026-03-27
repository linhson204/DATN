package spring.api.demo.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import spring.api.demo.dto.material.request.MaterialDictionaryCreateRequest;
import spring.api.demo.dto.material.response.MaterialDictionaryResponse;
import spring.api.demo.service.MaterialDictionaryService;

import java.util.List;

@RestController
@RequestMapping("/v1/materials")
public class MaterialDictionaryController {

    private final MaterialDictionaryService materialDictionaryService;

    public MaterialDictionaryController(MaterialDictionaryService materialDictionaryService) {
        this.materialDictionaryService = materialDictionaryService;
    }

    @GetMapping
    public ResponseEntity<List<MaterialDictionaryResponse>> getAll() {
        return ResponseEntity.ok(materialDictionaryService.getAll());
    }

    @GetMapping("/{code}")
    public ResponseEntity<MaterialDictionaryResponse> getByCode(@PathVariable String code) {
        return ResponseEntity.ok(materialDictionaryService.getByCode(code));
    }

    @PostMapping
    public ResponseEntity<MaterialDictionaryResponse> create(
            @Valid @RequestBody MaterialDictionaryCreateRequest request
    ) {
        MaterialDictionaryResponse response = materialDictionaryService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{code}")
    public ResponseEntity<MaterialDictionaryResponse> update(
            @PathVariable String code,
            @Valid @RequestBody MaterialDictionaryCreateRequest request
    ) {
        return ResponseEntity.ok(materialDictionaryService.update(code, request));
    }

    @DeleteMapping("/{code}")
    public ResponseEntity<Void> delete(@PathVariable String code) {
        materialDictionaryService.delete(code);
        return ResponseEntity.noContent().build();
    }
}
