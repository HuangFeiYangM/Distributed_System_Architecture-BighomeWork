package com.canteen.pickup.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class WebSocketBroadcaster {

    private final CopyOnWriteArraySet<WebSocketSession> sessions = new CopyOnWriteArraySet<>();

    public void register(WebSocketSession session) {
        sessions.add(session);
    }

    public void unregister(WebSocketSession session) {
        sessions.remove(session);
    }

    public void broadcast(String json) throws IOException {
        TextMessage msg = new TextMessage(json.getBytes(StandardCharsets.UTF_8));
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                synchronized (s) {
                    s.sendMessage(msg);
                }
            }
        }
    }
}
