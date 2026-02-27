import Foundation
import Capacitor
import FamilyControls
import ManagedSettings

@objc(ScreenTimePlugin)
public class ScreenTimePlugin: CAPPlugin {
    
    // The Apple permission request
    @objc func requestAuthorization(_ call: CAPPluginCall) {
        if #available(iOS 15.0, *) {
            Task {
                do {
                    // Ask Apple to let this app manage Screen Time
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                    call.resolve([ "status": "granted" ])
                } catch {
                    call.reject("Family Controls authorization failed: \(error.localizedDescription)")
                }
            }
        } else {
            call.reject("Screen Time API requires iOS 15.0 or newer.")
        }
    }
}
