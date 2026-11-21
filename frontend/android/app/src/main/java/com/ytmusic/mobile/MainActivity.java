package com.ytmusic.mobile;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
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
}
