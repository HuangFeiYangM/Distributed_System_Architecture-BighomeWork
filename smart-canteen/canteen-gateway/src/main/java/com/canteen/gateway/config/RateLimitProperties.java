package com.canteen.gateway.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "rate-limit")
public class RateLimitProperties {
    private int ipLimit = 100;
    private int userLimit = 30;
    private long bucketSize = 10000;
    private int windowBuckets = 6;
}
