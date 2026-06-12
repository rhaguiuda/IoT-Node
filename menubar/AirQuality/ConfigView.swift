import SwiftUI

struct ConfigView: View {
    @ObservedObject var mqtt: MQTTClient

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sensor exibido na barra")
                .font(.headline)

            Text("Escolha qual device aparece no menu bar.")
                .font(.caption)
                .foregroundColor(.secondary)

            Divider()

            if mqtt.deviceIDs.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 6) {
                        Image(systemName: "sensor.tag.radiowaves.forward")
                            .font(.title2)
                            .foregroundColor(.secondary)
                        Text("Nenhum sensor detectado")
                            .font(.callout)
                            .foregroundColor(.secondary)
                        Text("Aguardando dados no broker MQTT…")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
                .padding(.vertical, 24)
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(mqtt.deviceIDs, id: \.self) { id in
                            DeviceRow(
                                name: mqtt.name(for: id),
                                deviceID: id,
                                isSelected: id == mqtt.selectedDeviceID
                            ) {
                                mqtt.selectedDeviceID = id
                            }
                        }
                    }
                }
                .frame(maxHeight: 220)
            }
        }
        .padding(20)
        .frame(width: 340)
        .onAppear { mqtt.refreshDeviceNames() }
    }
}

private struct DeviceRow: View {
    let name: String
    let deviceID: String
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 10) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .accentColor : .secondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text(name)
                        .font(.body)
                        .foregroundColor(.primary)
                    // Show the MAC when the friendly name differs from it.
                    if name != deviceID {
                        Text(deviceID)
                            .font(.caption2.monospaced())
                            .foregroundColor(.secondary)
                    }
                }
                Spacer()
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 8)
            .contentShape(Rectangle())
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(isSelected ? Color.accentColor.opacity(0.12) : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
}
