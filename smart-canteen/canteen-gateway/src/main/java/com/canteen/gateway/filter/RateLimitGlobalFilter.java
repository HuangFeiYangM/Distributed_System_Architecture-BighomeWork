package com.canteen.gateway.filter;

import com.canteen.common.result.Result;
import com.canteen.common.util.JwtUtil;
import com.canteen.gateway.config.RateLimitProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class RateLimitGlobalFilter implements GlobalFilter, Ordered {

    private static final AntPathMatcher MATCHER = new AntPathMatcher();
    private static final List<String> WHITELIST = List.of(
            "/api/user/register",
            "/api/user/login",
            "/api/user/refresh"
    );

    private final ReactiveStringRedisTemplate redisTemplate;
    private final RateLimitProperties properties;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        String ip = resolveClientIp(exchange);

        return isRateLimited("ip", ip, path, properties.getIpLimit())
                .flatMap(ipLimited -> {
                    if (ipLimited) {
                        return tooMany(exchange, "IP请求过于频繁");
                    }

                    if (path.startsWith("/ws/") || WHITELIST.stream().anyMatch(p -> MATCHER.match(p, path))) {
                        return chain.filter(exchange);
                    }

                    String auth = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
                    if (auth == null || !auth.startsWith("Bearer ")) {
                        return chain.filter(exchange);
                    }
                    String token = auth.substring(7).trim();
                    if (!JwtUtil.validateToken(jwtSecret, token)) {
                        return chain.filter(exchange);
                    }
                    String userId = String.valueOf(JwtUtil.getUserId(jwtSecret, token));
                    return isRateLimited("user", userId, path, properties.getUserLimit())
                            .flatMap(userLimited -> userLimited
                                    ? tooMany(exchange, "用户请求过于频繁")
                                    : chain.filter(exchange));
                });
    }

    private Mono<Boolean> isRateLimited(String type, String identifier, String path, int threshold) {
        long now = System.currentTimeMillis();
        long currentBucket = now / properties.getBucketSize();

        List<String> keys = new ArrayList<>(properties.getWindowBuckets());
        for (int i = 0; i < properties.getWindowBuckets(); i++) {
            long bucket = currentBucket - i;
            keys.add("rate:" + type + ":" + identifier + ":" + path + ":" + bucket);
        }

        String currentKey = keys.get(0);
        return redisTemplate.opsForValue().multiGet(keys)
                .defaultIfEmpty(List.of())
                .flatMap(values -> {
                    long total = values.stream()
                            .filter(v -> v != null && !v.isBlank())
                            .mapToLong(v -> {
                                try {
                                    return Long.parseLong(v);
                                } catch (NumberFormatException e) {
                                    return 0L;
                                }
                            })
                            .sum();

                    if (total >= threshold) {
                        return Mono.just(true);
                    }

                    long ttlSeconds = Math.max(70, properties.getWindowBuckets() * properties.getBucketSize() / 1000 + 10);
                    return redisTemplate.opsForValue().increment(currentKey)
                            .flatMap(v -> redisTemplate.expire(currentKey, Duration.ofSeconds(ttlSeconds)))
                            .thenReturn(false);
                });
    }

    private Mono<Void> tooMany(ServerWebExchange exchange, String msg) {
        exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        Result<Void> bodyObj = Result.error(429, msg);
        String body = "{\"code\":" + bodyObj.getCode()
                + ",\"msg\":\"" + bodyObj.getMsg()
                + "\",\"data\":null,\"timestamp\":" + bodyObj.getTimestamp() + "}";
        DataBuffer buf = exchange.getResponse().bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return exchange.getResponse().writeWith(Mono.just(buf));
    }

    private String resolveClientIp(ServerWebExchange exchange) {
        String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        if (exchange.getRequest().getRemoteAddress() != null
                && exchange.getRequest().getRemoteAddress().getAddress() != null) {
            return exchange.getRequest().getRemoteAddress().getAddress().getHostAddress();
        }
        return "unknown";
    }

    @Override
    public int getOrder() {
        return -200;
    }
}
