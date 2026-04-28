package com.canteen.order.constant;

public final class OrderStatus {
    public static final int PLACED = 0;
    public static final int ACCEPTED = 1;
    public static final int COOKING = 2;
    public static final int READY = 3;
    public static final int PICKED = 4;
    public static final int CANCELLED = 5;

    private OrderStatus() {}
}
