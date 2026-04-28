package com.canteen.order.service;

import com.canteen.order.entity.CanteenOrder;
import com.canteen.order.entity.OrderItem;
import com.canteen.order.mapper.OrderItemMapper;
import com.canteen.order.mapper.OrderMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderPersistenceFacade {

    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;

    @Transactional
    public CanteenOrder persistOrderAndItems(CanteenOrder order, List<OrderItem> items) {
        orderMapper.insert(order);
        for (OrderItem oi : items) {
            oi.setOrderId(order.getId());
            orderItemMapper.insert(oi);
        }
        return orderMapper.selectById(order.getId());
    }
}
