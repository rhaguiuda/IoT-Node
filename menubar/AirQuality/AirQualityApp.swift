import SwiftUI

@main
struct AirQualityApp: App {
    @StateObject private var mqtt = MQTTClient()

    var body: some Scene {
        MenuBarExtra {
            PopoverView(mqtt: mqtt)
        } label: {
            let co2Text = mqtt.co2.map { "\(Int($0))ppm" } ?? "--"
            let tempText = mqtt.temp.map { String(format: "%.1f°", $0) } ?? "--"
            let umiText = mqtt.umi.map { "\(Int($0))%" } ?? "--"
            Text("\(co2Text)  \(tempText)  \(umiText)")
                .font(.system(.caption, design: .monospaced))
        }
        .menuBarExtraStyle(.window)
    }
}
