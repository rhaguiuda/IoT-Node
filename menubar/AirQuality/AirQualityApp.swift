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
        let defaultColor = NSColor.labelColor

        let attributed = NSMutableAttributedString(string: full, attributes: [
            .font: font,
            .foregroundColor: defaultColor,
        ])

        // Color just the CO2 part
        if let co2 = co2 {
            let color = co2Color(co2)
            if color != defaultColor {
                let co2Range = (full as NSString).range(of: co2Text)
                attributed.addAttribute(.foregroundColor, value: color, range: co2Range)
            }
        }

        let size = attributed.size()
        let image = NSImage(size: NSSize(width: ceil(size.width), height: ceil(size.height)))
        image.lockFocus()
        attributed.draw(at: NSPoint(x: 0, y: 0))
        image.unlockFocus()
        image.isTemplate = false
        return image
    }

    private func co2Color(_ value: Double) -> NSColor {
        if value >= 1500 { return NSColor.systemRed }
        if value >= 1000 { return NSColor.systemYellow }
        return NSColor.labelColor
    }
}
