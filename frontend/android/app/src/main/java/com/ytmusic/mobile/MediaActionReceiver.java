package com.ytmusic.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Receives taps on the notification buttons and forwards them to the web player. */
public class MediaActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent.getAction();
        if (a == null) return;
        switch (a) {
            case MediaPlaybackService.A_PLAY: MediaPlaybackService.emit("play", -1); break;
            case MediaPlaybackService.A_PAUSE: MediaPlaybackService.emit("pause", -1); break;
            case MediaPlaybackService.A_NEXT: MediaPlaybackService.emit("next", -1); break;
            case MediaPlaybackService.A_PREV: MediaPlaybackService.emit("previous", -1); break;
            case MediaPlaybackService.A_DISMISS:
                // notification swiped away while paused
                MediaPlaybackService.emit("pause", -1);
                MediaPlaybackService.clear(context);
                break;
            default: break;
        }
    }
}
