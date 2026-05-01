package com.canteen.user.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.result.Result;
import com.canteen.user.dto.AdminResetPasswordDTO;
import com.canteen.user.dto.ChangePasswordDTO;
import com.canteen.user.dto.LoginDTO;
import com.canteen.user.dto.RegisterDTO;
import com.canteen.user.dto.UserUpdateDTO;
import com.canteen.user.service.UserService;
import com.canteen.user.vo.UserVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    @PutMapping("/me/password")
    public Result<Void> changePassword(HttpServletRequest request, @Valid @RequestBody ChangePasswordDTO dto) {
        userService.changePassword(request, dto);
        return Result.success();
    }

    @GetMapping("/list")
    public Result<Page<UserVO>> list(
            HttpServletRequest request,
            @RequestParam(value = "page", defaultValue = "1") long page,
            @RequestParam(value = "size", defaultValue = "10") long size,
            @RequestParam(value = "role", required = false) Integer role,
            @RequestParam(value = "status", required = false) Integer status,
            @RequestParam(value = "phone", required = false) String phone,
            @RequestParam(value = "nickname", required = false) String nickname,
            @RequestParam(value = "studentNo", required = false) String studentNo) {
        return Result.success(userService.list(request, page, size, role, status, phone, nickname, studentNo));
    }

    @PutMapping("/{id}/status")
    public Result<Void> updateStatus(HttpServletRequest request, @PathVariable("id") Long id, @RequestParam("value") Integer value) {
        userService.updateStatus(request, id, value);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(HttpServletRequest request, @PathVariable("id") Long id) {
        userService.deleteUser(request, id);
        return Result.success();
    }

    @PostMapping("/{id}/reset-password")
    public Result<Void> resetPassword(HttpServletRequest request, @PathVariable("id") Long id,
                                     @Valid @RequestBody AdminResetPasswordDTO dto) {
        userService.resetPassword(request, id, dto.getPassword());
        return Result.success();
    }
}
