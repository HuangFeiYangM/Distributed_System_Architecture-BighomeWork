package com.canteen.user.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.canteen.common.constant.RoleNames;
import com.canteen.common.exception.BusinessException;
import com.canteen.common.result.StatusCode;
import com.canteen.common.util.JwtUtil;
import com.canteen.user.dto.ChangePasswordDTO;
import com.canteen.user.dto.LoginDTO;
import com.canteen.user.dto.RegisterDTO;
import com.canteen.user.dto.UserUpdateDTO;
import com.canteen.user.entity.User;
import com.canteen.user.mapper.UserMapper;
import com.canteen.user.vo.UserVO;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

import static com.canteen.common.constant.UserHeaders.ROLE;
import static com.canteen.common.constant.UserHeaders.USER_ID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration}")
    private long jwtExpirationMs;

    @Transactional
    public void register(RegisterDTO dto) {
        Long c = userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getPhone, dto.getPhone()));
        if (c != null && c > 0) {
            throw new BusinessException(StatusCode.USER_EXISTS);
        }
        if (StringUtils.hasText(dto.getStudentNo())) {
            Long s = userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getStudentNo, dto.getStudentNo()));
            if (s != null && s > 0) {
                throw new BusinessException(StatusCode.USER_EXISTS);
            }
        }

        User user = new User();
        user.setPhone(dto.getPhone());
        user.setStudentNo(dto.getStudentNo());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setNickname(StringUtils.hasText(dto.getNickname()) ? dto.getNickname() : dto.getPhone());
        user.setRole(0);
        user.setStatus(1);
        userMapper.insert(user);
    }

    public Map<String, Object> login(LoginDTO dto) {
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getPhone, dto.getPhone()));
        if (user == null) {
            throw new BusinessException(StatusCode.USER_NOT_FOUND);
        }
        if (user.getStatus() != null && user.getStatus() == 0) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        if (!passwordEncoder.matches(dto.getPassword(), user.getPassword())) {
            throw new BusinessException(StatusCode.PASSWORD_ERROR);
        }

        String displayName = StringUtils.hasText(user.getNickname()) ? user.getNickname() : user.getPhone();
        String token = JwtUtil.generateToken(
                jwtSecret,
                jwtExpirationMs,
                user.getId(),
                displayName,
                RoleNames.fromDbRole(user.getRole()));

        Map<String, Object> body = new HashMap<>();
        body.put("accessToken", token);
        body.put("tokenType", "Bearer");
        body.put("expiresIn", jwtExpirationMs / 1000);
        body.put("userId", user.getId());
        body.put("role", user.getRole());
        return body;
    }

    public Map<String, Object> refresh(String bearerToken) {
        if (!StringUtils.hasText(bearerToken) || !bearerToken.startsWith("Bearer ")) {
            throw new BusinessException(StatusCode.UNAUTHORIZED);
        }
        String token = bearerToken.substring(7).trim();
        Claims claims;
        try {
            claims = JwtUtil.parseTokenAllowExpired(jwtSecret, token);
        } catch (Exception e) {
            throw new BusinessException(StatusCode.TOKEN_EXPIRED);
        }

        Instant expInstant = claims.getExpiration().toInstant();
        if (expInstant.plus(7, ChronoUnit.DAYS).isBefore(Instant.now())) {
            throw new BusinessException(StatusCode.TOKEN_EXPIRED);
        }

        Object uidObj = claims.get("userId");
        Long userId = uidObj instanceof Number ? ((Number) uidObj).longValue() : Long.parseLong(uidObj.toString());
        User user = userMapper.selectById(userId);
        if (user == null || (user.getStatus() != null && user.getStatus() == 0)) {
            throw new BusinessException(StatusCode.USER_NOT_FOUND);
        }

        String displayName = StringUtils.hasText(user.getNickname()) ? user.getNickname() : user.getPhone();
        String newToken = JwtUtil.generateToken(
                jwtSecret,
                jwtExpirationMs,
                user.getId(),
                displayName,
                RoleNames.fromDbRole(user.getRole()));

        Map<String, Object> body = new HashMap<>();
        body.put("accessToken", newToken);
        body.put("tokenType", "Bearer");
        body.put("expiresIn", jwtExpirationMs / 1000);
        body.put("userId", user.getId());
        body.put("role", user.getRole());
        return body;
    }

    public UserVO me(HttpServletRequest request) {
        Long userId = resolveUserId(request);
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(StatusCode.USER_NOT_FOUND);
        }
        return toVo(user);
    }

    @Transactional
    public void updateMe(HttpServletRequest request, UserUpdateDTO dto) {
        Long userId = resolveUserId(request);
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(StatusCode.USER_NOT_FOUND);
        }
        if (StringUtils.hasText(dto.getNickname())) {
            user.setNickname(dto.getNickname());
        }
        if (dto.getAvatar() != null) {
            user.setAvatar(dto.getAvatar());
        }
        userMapper.updateById(user);
    }

    public Page<UserVO> list(HttpServletRequest request, long page, long size, Integer role, Integer status,
                             String phone, String nickname, String studentNo) {
        requireAdmin(request);
        Page<User> p = new Page<>(page, size);
        LambdaQueryWrapper<User> q = new LambdaQueryWrapper<User>().orderByDesc(User::getId);
        if (role != null) {
            q.eq(User::getRole, role);
        }
        if (status != null) {
            q.eq(User::getStatus, status);
        }
        if (phone != null && !phone.isBlank()) {
            q.like(User::getPhone, phone.trim());
        }
        if (nickname != null && !nickname.isBlank()) {
            q.like(User::getNickname, nickname.trim());
        }
        if (studentNo != null && !studentNo.isBlank()) {
            q.like(User::getStudentNo, studentNo.trim());
        }
        userMapper.selectPage(p, q);
        Page<UserVO> out = new Page<>(p.getCurrent(), p.getSize(), p.getTotal());
        out.setRecords(p.getRecords().stream().map(this::toVo).toList());
        return out;
    }

    @Transactional
    public void updateStatus(HttpServletRequest request, Long id, Integer value) {
        requireAdmin(request);
        if (value == null || (value != 0 && value != 1)) {
            throw new BusinessException(StatusCode.PARAM_ERROR);
        }
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(StatusCode.USER_NOT_FOUND);
        }
        user.setStatus(value);
        userMapper.updateById(user);
    }

    @Transactional
    public void deleteUser(HttpServletRequest request, Long id) {
        requireAdmin(request);
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(StatusCode.USER_NOT_FOUND);
        }
        if (Integer.valueOf(2).equals(user.getRole())) {
            throw new BusinessException(StatusCode.FORBIDDEN, "管理员账号不可删除");
        }
        userMapper.deleteById(id);
    }

    @Transactional
    public void resetPassword(HttpServletRequest request, Long id, String newPlainPassword) {
        requireAdmin(request);
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(StatusCode.USER_NOT_FOUND);
        }
        user.setPassword(passwordEncoder.encode(newPlainPassword));
        userMapper.updateById(user);
    }

    @Transactional
    public void changePassword(HttpServletRequest request, ChangePasswordDTO dto) {
        Long userId = resolveUserId(request);
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(StatusCode.USER_NOT_FOUND);
        }
        if (user.getStatus() != null && user.getStatus() == 0) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        if (!passwordEncoder.matches(dto.getOldPassword(), user.getPassword())) {
            throw new BusinessException(StatusCode.PASSWORD_ERROR);
        }
        if (dto.getOldPassword().equals(dto.getNewPassword())) {
            throw new BusinessException(StatusCode.PARAM_ERROR);
        }
        user.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        userMapper.updateById(user);
    }

    private void requireAdmin(HttpServletRequest request) {
        String role = request.getHeader(ROLE);
        if (!RoleNames.ADMIN.equals(role)) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
    }

    private Long resolveUserId(HttpServletRequest request) {
        String header = request.getHeader(USER_ID);
        if (StringUtils.hasText(header)) {
            return Long.parseLong(header.trim());
        }
        String auth = request.getHeader("Authorization");
        if (StringUtils.hasText(auth) && auth.startsWith("Bearer ")) {
            String token = auth.substring(7).trim();
            return JwtUtil.getUserId(jwtSecret, token);
        }
        throw new BusinessException(StatusCode.UNAUTHORIZED);
    }

    private UserVO toVo(User u) {
        return UserVO.builder()
                .id(u.getId())
                .studentNo(u.getStudentNo())
                .phone(u.getPhone())
                .nickname(u.getNickname())
                .avatar(u.getAvatar())
                .role(u.getRole())
                .status(u.getStatus())
                .build();
    }
}
