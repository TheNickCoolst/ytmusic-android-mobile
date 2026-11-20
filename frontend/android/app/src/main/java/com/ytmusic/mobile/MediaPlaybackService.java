package com.ytmusic.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/**
 * Foreground service that shows the "now playing" media notification (status bar, Samsung quick panel,
 * lock screen) and owns the MediaSession (headset / Bluetooth / lock-screen controls).
 * Audio itself plays in the WebView; this service mirrors its state and forwards control actions to JS.
 * Running as a mediaPlayback foreground service also keeps the app alive in the background.
 */
public class MediaPlaybackService extends Service {

    static final String CHANNEL_ID = "ytm_playback";
    static final int NOTIF_ID = 1201;
    static final String A_PLAY = "com.ytmusic.mobile.media.PLAY";
    static final String A_PAUSE = "com.ytmusic.mobile.media.PAUSE";
    static final String A_NEXT = "com.ytmusic.mobile.media.NEXT";
    static final String A_PREV = "com.ytmusic.mobile.media.PREV";
    static final String A_DISMISS = "com.ytmusic.mobile.media.DISMISS";

    interface Listener {
        void onAction(String action, long positionMs);
    }

    static volatile Listener listener;
    static MediaPlaybackService instance;
    private static MediaSessionCompat session;
    private boolean isForeground = false;

    static final class State {
        String title = "";
        String artist = "";
        String album = "";
        String artUrl;
        Bitmap art;
        boolean playing;
        long posMs;
        long durMs;
        float rate = 1f;
    }

    static final State state = new State();

    static void emit(String action, long posMs) {
        Listener l = listener;
        if (l != null) l.onAction(action, posMs);
    }

    static synchronized MediaSessionCompat session(Context ctx) {
        if (session == null) {
            Context app = ctx.getApplicationContext();
            session = new MediaSessionCompat(app, "YTMusicMobile");
            session.setCallback(new MediaSessionCompat.Callback() {
                @Override public void onPlay() { emit("play", -1); }
                @Override public void onPause() { emit("pause", -1); }
                @Override public void onSkipToNext() { emit("next", -1); }
                @Override public void onSkipToPrevious() { emit("previous", -1); }
                @Override public void onSeekTo(long pos) { emit("seekto", pos); }
                @Override public void onStop() { emit("pause", -1); }
            });
            session.setSessionActivity(launchIntent(app));
            session.setActive(true);
        }
        return session;
    }

    private static PendingIntent launchIntent(Context ctx) {
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch == null) launch = new Intent(ctx, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent actionIntent(Context ctx, String action, int req) {
        Intent i = new Intent(ctx, MediaActionReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(ctx, req, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Wiedergabe", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Zeigt den aktuell laufenden Song mit Steuerung");
                ch.setShowBadge(false);
                ch.setSound(null, null);
                nm.createNotificationChannel(ch);
            }
        }
    }

    static Notification buildNotification(Context ctx) {
        ensureChannel(ctx);
        MediaSessionCompat s = session(ctx);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_music)
                .setContentTitle(state.title)
                .setContentText(state.artist)
                .setLargeIcon(state.art)
                .setContentIntent(launchIntent(ctx))
                .setDeleteIntent(actionIntent(ctx, A_DISMISS, 5))
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setSilent(true)
                .setOngoing(state.playing)
                .addAction(android.R.drawable.ic_media_previous, "Zurück", actionIntent(ctx, A_PREV, 1))
                .addAction(state.playing
                                ? new NotificationCompat.Action(android.R.drawable.ic_media_pause, "Pause", actionIntent(ctx, A_PAUSE, 2))
                                : new NotificationCompat.Action(android.R.drawable.ic_media_play, "Abspielen", actionIntent(ctx, A_PLAY, 3)))
                .addAction(android.R.drawable.ic_media_next, "Weiter", actionIntent(ctx, A_NEXT, 4))
                .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(s.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2));
        return b.build();
    }

    /** Push the current state to the session + notification (main thread). */
    static void publish(Context ctx) {
        MediaSessionCompat s = session(ctx);
        MediaMetadataCompat.Builder mb = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, state.title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, state.artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, state.album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, state.durMs > 0 ? state.durMs : -1);
        if (state.art != null) {
            mb.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, state.art);
            mb.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, state.art);
        }
        s.setMetadata(mb.build());
        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_SEEK_TO
                | PlaybackStateCompat.ACTION_STOP;
        s.setPlaybackState(new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(state.playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                        state.posMs, state.playing ? state.rate : 0f, SystemClock.elapsedRealtime())
                .build());
        if (!s.isActive()) s.setActive(true);

        if (instance != null) {
            instance.refresh(false);
            return;
        }
        if (state.playing) {
            try {
                ContextCompat.startForegroundService(ctx, new Intent(ctx, MediaPlaybackService.class));
                return;
            } catch (Exception e) {
                // background start not allowed right now -> plain notification
            }
        }
        notifyPlain(ctx, buildNotification(ctx));
    }

    static void notifyPlain(Context ctx, Notification n) {
        try {
            NotificationManagerCompat.from(ctx).notify(NOTIF_ID, n);
        } catch (SecurityException e) {
            // notifications not permitted
        }
    }

    static void clear(Context ctx) {
        if (instance != null) instance.shutdown();
        NotificationManagerCompat.from(ctx).cancel(NOTIF_ID);
        if (session != null) session.setActive(false);
    }

    void refresh(boolean promote) {
        Notification n = buildNotification(this);
        if (state.playing || promote) {
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } else {
                    startForeground(NOTIF_ID, n);
                }
                isForeground = true;
            } catch (Exception e) {
                notifyPlain(this, n);
            }
        }
        if (!state.playing) {
            // paused: notification stays but can be swiped away
            if (isForeground) {
                stopForeground(Service.STOP_FOREGROUND_DETACH);
                isForeground = false;
            }
            notifyPlain(this, n);
        }
    }

    void shutdown() {
        if (isForeground) stopForeground(Service.STOP_FOREGROUND_REMOVE);
        isForeground = false;
        stopSelf();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        ensureChannel(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // started via startForegroundService -> must call startForeground right away
        refresh(true);
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // app swiped away from recents -> stop playback notification
        shutdown();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
