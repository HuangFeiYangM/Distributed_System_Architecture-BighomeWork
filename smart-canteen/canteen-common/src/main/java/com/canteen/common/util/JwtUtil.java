package com.canteen.common.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

public final class JwtUtil {

    private JwtUtil() {}

    private static SecretKey key(String secret) {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public static String generateToken(String secret, long expirationMillis, Long userId, String username, String role) {
        Instant now = Instant.now();
        Instant exp = now.plusMillis(expirationMillis);
        return Jwts.builder()
                .claim("userId", userId)
                .claim("username", username == null ? "" : username)
                .claim("role", role == null ? "USER" : role)
                .subject(String.valueOf(userId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key(secret))
                .compact();
    }

    public static Claims parseToken(String secret, String token) throws ExpiredJwtException, JwtException {
        return Jwts.parser()
                .verifyWith(key(secret))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * 刷新用：过期 Token 仍可取 Claims（签名须正确）。
     */
    public static Claims parseTokenAllowExpired(String secret, String token) throws JwtException {
        try {
            return parseToken(secret, token);
        } catch (ExpiredJwtException e) {
            return e.getClaims();
        }
    }

    public static boolean validateToken(String secret, String token) {
        try {
            parseToken(secret, token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public static Long getUserId(String secret, String token) {
        Claims c = parseToken(secret, token);
        Object uid = c.get("userId");
        if (uid instanceof Number n) {
            return n.longValue();
        }
        if (uid instanceof String s) {
            return Long.parseLong(s);
        }
        return Long.parseLong(c.getSubject());
    }

    public static String getUsername(String secret, String token) {
        Claims c = parseToken(secret, token);
        Object u = c.get("username");
        return u != null ? u.toString() : "";
    }

    public static String getRole(String secret, String token) {
        Claims c = parseToken(secret, token);
        Object r = c.get("role");
        return r != null ? r.toString() : "USER";
    }
}
