package com.canteen.gateway.filter;

import com.canteen.common.constant.UserHeaders;
import com.canteen.common.result.Result;
import com.canteen.common.result.StatusCode;
import com.canteen.common.util.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class JwtAuthGlobalFilter implements GlobalFilter, Ordered {

    private static final AntPathMatcher MATCHER = new AntPathMatcher();
    private static final List<String> WHITELIST = List.of(
            "/api/user/register",
            "/api/user/login",
            "/api/user/refresh"
    );

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (WHITELIST.stream().anyMatch(p -> MATCHER.match(p, path)) || path.startsWith("/ws/")) {
            return chain.filter(exchange);
        }

        String auth = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth == null || !auth.startsWith("Bearer ")) {
            return unauthorized(exchange, "缺少Token");
        }
        String token = auth.substring(7).trim();
        if (!JwtUtil.validateToken(jwtSecret, token)) {
            return unauthorized(exchange, "Token无效或已过期");
        }

        Long userId = JwtUtil.getUserId(jwtSecret, token);
        String username = JwtUtil.getUsername(jwtSecret, token);
        String role = JwtUtil.getRole(jwtSecret, token);

        ServerHttpRequest mutated = exchange.getRequest().mutate()
                .header(UserHeaders.USER_ID, String.valueOf(userId))
                .header(UserHeaders.USERNAME, username)
                .header(UserHeaders.ROLE, role)
                .build();

        return chain.filter(exchange.mutate().request(mutated).build());
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String msg) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        Result<Void> bodyObj = Result.error(StatusCode.UNAUTHORIZED.getCode(), msg);
        String body = "{\"code\":" + bodyObj.getCode()
                + ",\"msg\":\"" + bodyObj.getMsg()
                + "\",\"data\":null,\"timestamp\":" + bodyObj.getTimestamp() + "}";
        DataBuffer buf = exchange.getResponse().bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return exchange.getResponse().writeWith(Mono.just(buf));
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
