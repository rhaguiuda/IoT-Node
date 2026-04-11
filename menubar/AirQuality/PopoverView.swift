import SwiftUI

struct PopoverView: View {
    @ObservedObject var mqtt: MQTTClient

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Text("Air Quality Node")
                    .font(.headline)
                Spacer()
                Circle()
                    .fill(mqtt.connected ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                Text(mqtt.connected ? "Online" : "Offline")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Divider()

            // Metrics
            MetricRow(
                icon: "aqi.medium",
                label: "CO₂",
                value: mqtt.co2.map { "\(Int($0)) ppm" } ?? "--",
                color: co2Color
            )

            MetricRow(
                icon: "thermometer.medium",
                label: "Temperatura",
                value: mqtt.temp.map { String(format: "%.1f °C", $0) } ?? "--",
                color: tempColor
            )

            MetricRow(
                icon: "humidity.fill",
                label: "Umidade",
                value: mqtt.umi.map { "\(Int($0))%" } ?? "--",
                color: umiColor
            )

            Divider()

            // Last update
            if let last = mqtt.lastMessage {
                Text("Atualizado \(last, style: .relative) atrás")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            // Dashboard link
            Button {
                if let url = URL(string: "http://192.168.100.224:3100") {
                    NSWorkspace.shared.open(url)
                }
            } label: {
                HStack {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                    Text("Abrir Dashboard")
                }
                .font(.caption)
            }
            .buttonStyle(.link)

            Divider()

            Button("Sair") {
                NSApplication.shared.terminate(nil)
            }
            .font(.caption)
        }
        .padding(16)
        .frame(width: 260)
    }

    private var co2Color: Color {
        guard let v = mqtt.co2 else { return .secondary }
        if v < 1000 { return .green }
        if v < 1200 { return .orange }
        return .red
    }

    private var tempColor: Color {
        guard let v = mqtt.temp else { return .secondary }
        if v >= 18 && v <= 26 { return .green }
        if v >= 15 && v <= 30 { return .orange }
        return .red
    }

    private var umiColor: Color {
        guard let v = mqtt.umi else { return .secondary }
        if v >= 40 && v <= 60 { return .green }
        if v >= 30 && v <= 70 { return .orange }
        return .red
    }
}

struct MetricRow: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 20)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 80, alignment: .leading)
            Spacer()
            Text(value)
                .font(.system(.body, design: .monospaced))
                .fontWeight(.semibold)
        }
    }
}
