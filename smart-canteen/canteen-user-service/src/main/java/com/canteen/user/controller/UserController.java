package com.canteen.user.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.result.Result;
import com.canteen.user.dto.LoginDTO;
import com.canteen.user.dto.RegisterDTO;
import com.canteen.user.dto.UserUpdateDTO;
import com.canteen.user.service.UserService;
import com.canteen.user.vo.UserVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/register")
    public Result<Void> register(@Valid @RequestBody RegisterDTO dto) {
        userService.register(dto);
        return Result.success();
    }

    @PostMapping("/login")
    public Result<Map<String, Object>> login(@Valid @RequestBody LoginDTO dto) {
        return Result.success(userService.login(dto));
    }

    @PostMapping("/refresh")
    public Result<Map<String, Object>> refresh(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return Result.success(userService.refresh(authorization));
    }

    @GetMapping("/me")
    public Result<UserVO> me(HttpServletRequest request) {
        return Result.success(userService.me(request));
    }

    @PutMapping("/me")
    public Result<Void> updateMe(HttpServletRequest request, @RequestBody UserUpdateDTO dto) {
        userService.updateMe(request, dto);
        return Result.success();
    }

    @GetMapping("/list")
    public Result<Page<UserVO>> list(
            HttpServletRequest request,
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size) {
        return Result.success(userService.list(request, page, size));
    }
}
