import SwiftUI
import AppKit

@main
struct AirQualityApp: App {
    @StateObject private var mqtt = MQTTClient()

    var body: some Scene {
        MenuBarExtra {
            PopoverView(mqtt: mqtt)
        } label: {
            MenuBarLabel(co2: mqtt.co2, temp: mqtt.temp, umi: mqtt.umi)
        }
        .menuBarExtraStyle(.window)

        Window("Configurações", id: "config") {
            ConfigView(mqtt: mqtt)
        }
        .windowResizability(.contentSize)
    }
}

struct MenuBarLabel: View {
    let co2: Double?
    let temp: Double?
    let umi: Double?

    var body: some View {
        Image(nsImage: buildMenuBarImage())
    }

    private func buildMenuBarImage() -> NSImage {
        let co2Text = co2.map { "\(Int($0))ppm" } ?? "--"
        let tempText = temp.map { String(format: "%.1f°", $0) } ?? "--"
        let umiText = umi.map { "\(Int($0))%" } ?? "--"
        let full = "\(co2Text)  \(tempText)  \(umiText)"

        let font = NSFont.menuBarFont(ofSize: 0)

        // CO2 warning color (nil = normal state, no warning).
        let warningColor = co2.flatMap { co2WarningColor($0) }
        let isWarning = warningColor != nil

        // Hybrid contrast strategy:
        // - Normal state: draw opaque black and mark the image as a TEMPLATE.
        //   macOS uses only the alpha mask and recolors it with the correct
        //   adaptive menu bar text color, so it stays readable on any bar
        //   (light/dark/translucent-over-wallpaper/blue highlight) for free.
        // - Warning state: the image must stay non-template to keep the red/
        //   orange CO2 color, so resolve labelColor against the effective
        //   appearance and draw the CO2 part in the warning color. Red/orange
        //   read well on both light and dark bars, unlike plain white.
        let baseColor: NSColor = isWarning ? NSColor.labelColor : NSColor.black

        let attributed = NSMutableAttributedString(string: full, attributes: [
            .font: font,
            .foregroundColor: baseColor,
        ])

        if let warningColor {
            let co2Range = (full as NSString).range(of: co2Text)
            attributed.addAttribute(.foregroundColor, value: warningColor, range: co2Range)
        }

        let size = attributed.size()
        let image = NSImage(size: NSSize(width: ceil(size.width), height: ceil(size.height)))
        image.lockFocus()
        if isWarning {
            // Resolve dynamic colors (labelColor) against the app appearance.
            NSApp.effectiveAppearance.performAsCurrentDrawingAppearance {
                attributed.draw(at: NSPoint(x: 0, y: 0))
            }
        } else {
            attributed.draw(at: NSPoint(x: 0, y: 0))
        }
        image.unlockFocus()
        image.isTemplate = !isWarning
        return image
    }

    private func co2WarningColor(_ value: Double) -> NSColor? {
        if value >= 1500 { return NSColor.systemRed }
        if value >= 1000 { return NSColor.systemOrange }
        return nil
    }
}
