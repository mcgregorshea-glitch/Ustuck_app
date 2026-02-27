#import <Capacitor/Capacitor.h>

// Register the plugin with Capacitor
CAP_PLUGIN(ScreenTimePlugin, "ScreenTimePlugin",
    CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
)
