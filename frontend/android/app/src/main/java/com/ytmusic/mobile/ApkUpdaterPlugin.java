package com.ytmusic.mobile;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Native app self-update: downloads a newer APK from GitHub Releases and opens the system
 * installer ("Update installieren?" – Android always asks the user once per update).
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private static final String APK_NAME = "update.apk";
    private volatile boolean downloading = false;

    private File apkFile() {
        File dir = new File(getContext().getCacheDir(), "updates");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, APK_NAME);
    }

    private PackageInfo selfInfo() throws PackageManager.NameNotFoundException {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
    }

    private static long code(PackageInfo p) {
        return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageInfo p = selfInfo();
            JSObject ret = new JSObject();
            ret.put("versionName", p.versionName);
            ret.put("versionCode", code(p));
            ret.put("canInstall", canInstall());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /** Downloads the APK (if not already downloaded for this URL), checks it, then opens the installer. */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Ungültige URL");
            return;
        }
        if (downloading) {
            call.reject("Download läuft schon");
            return;
        }
        downloading = true;
        new Thread(() -> {
            File out = apkFile();
            File tmp = new File(out.getParentFile(), APK_NAME + ".part");
            try {
                HttpURLConnection c = null;
                String target = url;
                // follow GitHub's redirect to its download host manually (keeps https only)
                for (int i = 0; i < 5; i++) {
                    c = (HttpURLConnection) new URL(target).openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(30000);
                    int s = c.getResponseCode();
                    if (s >= 300 && s < 400) {
                        target = c.getHeaderField("Location");
                        c.disconnect();
                        if (target == null || !target.startsWith("https://")) throw new Exception("Ungültige Weiterleitung");
                        continue;
                    }
                    if (s != 200) throw new Exception("HTTP " + s);
                    break;
                }
                long total = c.getContentLengthLong();
                long done = 0;
                int lastPct = -1;
                try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        done += n;
                        int pct = total > 0 ? (int) (done * 100 / total) : -1;
                        if (pct != lastPct) {
                            lastPct = pct;
                            JSObject ev = new JSObject();
                            ev.put("percent", pct);
                            notifyListeners("progress", ev);
                        }
                    }
                }
                c.disconnect();

                // must be our app and newer than what is installed
                PackageInfo apk = getContext().getPackageManager().getPackageArchiveInfo(tmp.getAbsolutePath(), 0);
                if (apk == null || !getContext().getPackageName().equals(apk.packageName)) throw new Exception("Datei ist keine gültige App-Version");
                if (code(apk) <= code(selfInfo())) throw new Exception("Version ist nicht neuer");
                if (out.exists()) //noinspection ResultOfMethodCallIgnored
                    out.delete();
                if (!tmp.renameTo(out)) throw new Exception("Speichern fehlgeschlagen");

                downloading = false;
                getActivity().runOnUiThread(() -> openInstaller(call));
            } catch (Exception e) {
                downloading = false;
                //noinspection ResultOfMethodCallIgnored
                tmp.delete();
                call.reject("Update-Download fehlgeschlagen: " + e.getMessage());
            }
        }).start();
    }

    /** Opens the installer for the already downloaded APK (e.g. after granting the permission). */
    @PluginMethod
    public void install(PluginCall call) {
        if (!apkFile().exists()) {
            call.reject("Kein Update heruntergeladen");
            return;
        }
        openInstaller(call);
    }

    private void openInstaller(PluginCall call) {
        try {
            if (!canInstall()) {
                // one-time: "Allow installing apps from this source"
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(s);
                JSObject ret = new JSObject();
                ret.put("status", "needs_permission");
                call.resolve(ret);
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apkFile());
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            JSObject ret = new JSObject();
            ret.put("status", "installer_opened");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Installer konnte nicht geöffnet werden: " + e.getMessage());
        }
    }
}
