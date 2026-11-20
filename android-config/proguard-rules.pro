# ProGuard / R8 Production Hardening Rules for Mizan Android Release
# Keeps Capacitor WebView bridge intact while stripping verbose debug logs.

-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve WebView & AndroidX annotations
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class androidx.webkit.** { *; }

# Strip debug/verbose/info Log calls in release builds to avoid leaking runtime data
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
