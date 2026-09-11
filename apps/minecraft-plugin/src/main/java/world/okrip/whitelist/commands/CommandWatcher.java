package world.okrip.whitelist.commands;

import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import world.okrip.whitelist.api.OkripApiClient;

public final class CommandWatcher implements WebSocket.Listener, AutoCloseable {
    private final OkripApiClient api;
    private final CommandPoller poller;
    private final ScheduledExecutorService worker;
    private final Consumer<Throwable> warning;
    private final AtomicReference<WebSocket> socket = new AtomicReference<>();
    private final AtomicBoolean running = new AtomicBoolean();
    private final AtomicBoolean reconnectScheduled = new AtomicBoolean();
    private final AtomicBoolean draining = new AtomicBoolean();
    private final AtomicBoolean requested = new AtomicBoolean();
    private final StringBuilder message = new StringBuilder();
    private int reconnectAttempt;

    public CommandWatcher(OkripApiClient api, CommandPoller poller, ScheduledExecutorService worker, Consumer<Throwable> warning) {
        this.api = api;
        this.poller = poller;
        this.worker = worker;
        this.warning = warning;
    }

    public void start() {
        if (!running.compareAndSet(false, true)) return;
        worker.execute(this::connect);
        worker.scheduleAtFixedRate(this::heartbeat, 45, 45, TimeUnit.SECONDS);
        // Rare safety reconciliation for a missed signal or an API restart during retry backoff.
        worker.scheduleWithFixedDelay(this::signal, 5, 5, TimeUnit.MINUTES);
    }

    public void signal() {
        if (!running.get()) return;
        requested.set(true);
        if (draining.compareAndSet(false, true)) worker.execute(this::drain);
    }

    private void drain() {
        try {
            do {
                requested.set(false);
                while (poller.tick()) {
                    // The API leases one command at a time; drain until the queue is empty.
                }
            } while (requested.get());
        } catch (Exception error) {
            warning.accept(error);
            worker.schedule(this::signal, 5, TimeUnit.SECONDS);
        } finally {
            draining.set(false);
            if (requested.get()) signal();
        }
    }

    private void connect() {
        if (!running.get() || socket.get() != null) return;
        api.watch(this).whenComplete((connected, error) -> {
            if (error != null) {
                warning.accept(error);
                scheduleReconnect();
            }
        });
    }

    private void scheduleReconnect() {
        if (!running.get() || !reconnectScheduled.compareAndSet(false, true)) return;
        long delay = Math.min(30, 1L << Math.min(reconnectAttempt++, 5));
        worker.schedule(() -> {
            reconnectScheduled.set(false);
            connect();
        }, delay, TimeUnit.SECONDS);
    }

    private void heartbeat() {
        WebSocket connected = socket.get();
        if (connected == null) {
            scheduleReconnect();
            return;
        }
        connected.sendPing(ByteBuffer.wrap(new byte[] { 1 })).whenComplete((ignored, error) -> {
            if (error != null) {
                connected.abort();
                socket.compareAndSet(connected, null);
                scheduleReconnect();
            }
        });
    }

    @Override public void onOpen(WebSocket webSocket) {
        socket.set(webSocket);
        reconnectAttempt = 0;
        reconnectScheduled.set(false);
        webSocket.request(1);
    }

    @Override public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        synchronized (message) {
            message.append(data);
            if (last) {
                if (message.indexOf("commands_available") >= 0) signal();
                message.setLength(0);
            }
        }
        webSocket.request(1);
        return null;
    }

    @Override public CompletionStage<?> onPing(WebSocket webSocket, ByteBuffer data) {
        webSocket.request(1);
        return webSocket.sendPong(data);
    }

    @Override public CompletionStage<?> onPong(WebSocket webSocket, ByteBuffer data) {
        webSocket.request(1);
        return null;
    }

    @Override public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
        socket.compareAndSet(webSocket, null);
        scheduleReconnect();
        return null;
    }

    @Override public void onError(WebSocket webSocket, Throwable error) {
        socket.compareAndSet(webSocket, null);
        warning.accept(error);
        scheduleReconnect();
    }

    @Override public void close() {
        running.set(false);
        WebSocket connected = socket.getAndSet(null);
        if (connected != null) connected.sendClose(WebSocket.NORMAL_CLOSURE, "Plugin disabled");
    }
}
