package com.devs.accountant.goal;

import com.devs.accountant.goal.dto.GoalRequest;
import com.devs.accountant.goal.dto.GoalResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/goals")
@RequiredArgsConstructor
public class GoalController {

    private final GoalService goalService;

    @GetMapping
    public List<GoalResponse> findAll() {
        return goalService.findAll();
    }

    @PutMapping("/{year}")
    public GoalResponse save(@PathVariable int year, @Valid @RequestBody GoalRequest request) {
        return goalService.save(year, request);
    }

    @DeleteMapping("/{year}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable int year) {
        goalService.delete(year);
    }
}
