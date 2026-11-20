package com.ytmusic.mobile;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** JS bridge for the system media notification / media session. */
@CapacitorPlugin(name = "MediaControls")
public class MediaControlsPlugin extends Plugin {

    @Override
    public void load() {
        MediaPlaybackService.listener = (action, posMs) -> {
            JSObject d = new JSObject();
            d.put("action", action);
            if (posMs >= 0) d.put("position", posMs / 1000.0);
            notifyListeners("action", d);
        };
    }

    @PluginMethod
    public void update(PluginCall call) {
        final String title = call.getString("title", "");
        final String artist = call.getString("artist", "");
        final String album = call.getString("album", "");
        final String artwork = call.getString("artwork", null);
        final boolean playing = Boolean.TRUE.equals(call.getBoolean("isPlaying", false));
        final double position = call.getDouble("position", 0.0);
        final double duration = call.getDouble("duration", 0.0);
        final double rate = call.getDouble("rate", 1.0);

        getActivity().runOnUiThread(() -> {
            MediaPlaybackService.State s = MediaPlaybackService.state;
            s.title = title;
            s.artist = artist;
            s.album = album;
            s.playing = playing;
            s.posMs = (long) (position * 1000);
            s.durMs = (long) (duration * 1000);
            s.rate = (float) rate;
            boolean newArt = artwork != null && !artwork.equals(s.artUrl);
            if (newArt) {
                s.artUrl = artwork;
                s.art = null;
            }
            MediaPlaybackService.publish(getContext());
            if (newArt) loadArtwork(artwork);
            call.resolve();
        });
    }

    @PluginMethod
    public void clear(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            MediaPlaybackService.clear(getContext());
            call.resolve();
        });
    }

    private void loadArtwork(final String url) {
        new Thread(() -> {
            Bitmap bmp = null;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                try (InputStream in = c.getInputStream()) {
                    bmp = BitmapFactory.decodeStream(in);
                }
                if (bmp != null && (bmp.getWidth() > 512 || bmp.getHeight() > 512)) {
                    float k = 512f / Math.max(bmp.getWidth(), bmp.getHeight());
                    bmp = Bitmap.createScaledBitmap(bmp, Math.round(bmp.getWidth() * k), Math.round(bmp.getHeight() * k), true);
                }
            } catch (Exception e) {
                // keep notification without artwork
            }
            final Bitmap result = bmp;
            if (result == null || getActivity() == null) return;
            getActivity().runOnUiThread(() -> {
                if (url.equals(MediaPlaybackService.state.artUrl)) {
                    MediaPlaybackService.state.art = result;
                    MediaPlaybackService.publish(getContext());
                }
            });
        }).start();
    }
}
