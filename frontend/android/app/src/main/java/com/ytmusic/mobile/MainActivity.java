package com.ytmusic.mobile;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleAuthPlugin.class);
        registerPlugin(MediaControlsPlugin.class);
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        // Android 13+: allow the "now playing" notification
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 4711);
        }

        try {
            WebView.setWebContentsDebuggingEnabled(true);
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        } catch (Exception e) {
            // Safe fallback if bridge is loading
        }

        // shared text (YouTube link) on a cold start: hand it over once the page has loaded
        final String shared = sharedText(getIntent());
        if (shared != null) new Handler(Looper.getMainLooper()).postDelayed(() -> deliverShared(shared), 3000);

        // Back button: the web app closes its open screen (player, search, ...) if there is one.
        // On the start screen the app goes to the background instead of closing, so music keeps playing.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv == null) {
                    moveTaskToBack(true);
                    return;
                }
                wv.evaluateJavascript(
                    "(window.__handleBack && window.__handleBack()) ? '1' : '0'",
                    result -> {
                        if (result == null || !result.contains("1")) moveTaskToBack(true);
                    });
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String shared = sharedText(intent);
        if (shared != null) deliverShared(shared);
    }

    private static String sharedText(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return null;
        CharSequence t = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        return t == null ? null : t.toString();
    }

    private void deliverShared(String text) {
        try {
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv == null) return;
            String js = "window.__sharedText=" + JSONObject.quote(text) + ";window.dispatchEvent(new Event('ytm:shared'));";
            wv.post(() -> wv.evaluateJavascript(js, null));
        } catch (Exception ignored) {
        }
    }
}
