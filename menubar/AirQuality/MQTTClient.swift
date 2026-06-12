import Foundation
import Combine
import Network
import CocoaMQTT
import AirQualityCore

/// Latest values reported by a single device.
struct DeviceReadings {
    var co2: Double?
    var temp: Double?
    var umi: Double?
    var lastMessage: Date?
}

class MQTTClient: ObservableObject {
    // Per-device latest readings, keyed by device id (the WiFi MAC).
    @Published private(set) var readingsByDevice: [String: DeviceReadings] = [:]
    // Device ids discovered live on the bus, sorted for stable display.
    @Published private(set) var deviceIDs: [String] = []
    // Friendly names from the dashboard API; falls back to the id when missing.
    @Published private(set) var deviceNames: [String: String] = [:]
    @Published var connected = false

    // The device whose values are shown in the menu bar / popover.
    // Persisted so the choice survives relaunches.
    @Published var selectedDeviceID: String? {
        didSet {
            guard selectedDeviceID != oldValue else { return }
            UserDefaults.standard.set(selectedDeviceID, forKey: Self.selectedKey)
        }
    }

    // Values for the currently selected device (drive the existing views).
    var co2: Double? { selectedReadings?.co2 }
    var temp: Double? { selectedReadings?.temp }
    var umi: Double? { selectedReadings?.umi }
    var lastMessage: Date? { selectedReadings?.lastMessage }

    /// Friendly name of the selected device, or nil when none is selected.
    var selectedName: String? {
        guard let id = selectedDeviceID else { return nil }
        return name(for: id)
    }

    private var selectedReadings: DeviceReadings? {
        guard let id = selectedDeviceID else { return nil }
        return readingsByDevice[id]
    }

    private var mqtt: CocoaMQTT5?
    private var localNetworkProbe: NWConnection?
    private let broker = "192.168.100.224"
    private let port: UInt16 = 1883
    private let wildcardTopic = "teras/iotnode/+/telemetry/#"
    private let apiBase = "http://192.168.100.224:3100"
    private static let selectedKey = "selectedDeviceID"

    init() {
        selectedDeviceID = UserDefaults.standard.string(forKey: Self.selectedKey)
        triggerLocalNetworkPermission()
        connect()
    }

    /// CocoaMQTT connects via a raw BSD socket (GCDAsyncSocket), which macOS
    /// blocks silently under Local Network privacy without ever prompting or
    /// listing the app. A short NWConnection to the broker goes through
    /// Network.framework, which *does* trigger the Local Network prompt and
    /// registers the app. Once the user grants access (app-wide, not per-API),
    /// the MQTT socket connects. The probe's success/failure is irrelevant —
    /// its only job is to surface the permission prompt.
    private func triggerLocalNetworkPermission() {
        guard let portValue = NWEndpoint.Port(rawValue: port) else { return }
        let conn = NWConnection(host: NWEndpoint.Host(broker), port: portValue, using: .tcp)
        conn.stateUpdateHandler = { state in
            switch state {
            case .ready, .failed, .cancelled:
                conn.cancel()
            default:
                break
            }
        }
        localNetworkProbe = conn
        conn.start(queue: .global(qos: .utility))
    }

    func connect() {
        let clientID = "AirQualityMac-\(ProcessInfo.processInfo.processIdentifier)"
        let mqtt5 = CocoaMQTT5(clientID: clientID, host: broker, port: port)
        mqtt5.autoReconnect = true
        mqtt5.autoReconnectTimeInterval = 5
        mqtt5.delegate = self
        _ = mqtt5.connect()
        self.mqtt = mqtt5
    }

    /// Display name for a device id (friendly name if known, else the raw id).
    func name(for deviceID: String) -> String {
        deviceNames[deviceID] ?? deviceID
    }

    /// Fetch friendly device names from the dashboard API. Best-effort: any
    /// failure (web down, no network) leaves the existing names untouched, so
    /// the app keeps working with raw MACs.
    func refreshDeviceNames() {
        guard let url = URL(string: "\(apiBase)/api/devices") else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data else { return }
            struct DeviceDTO: Decodable { let device_id: String; let name: String }
            guard let devices = try? JSONDecoder().decode([DeviceDTO].self, from: data) else { return }
            let names = Dictionary(uniqueKeysWithValues: devices.map { ($0.device_id, $0.name) })
            DispatchQueue.main.async { self.deviceNames = names }
        }.resume()
    }

    private func handleMessage(topic: String, payload: String) {
        guard let parsed = parseTopic(topic), let value = Double(payload) else { return }

        DispatchQueue.main.async {
            var readings = self.readingsByDevice[parsed.deviceID] ?? DeviceReadings()
            readings.lastMessage = Date()
            switch parsed.measurement {
            case "co2": readings.co2 = value
            case "temp": readings.temp = value
            case "umi": readings.umi = value
            default: return
            }
            self.readingsByDevice[parsed.deviceID] = readings

            if !self.deviceIDs.contains(parsed.deviceID) {
                self.deviceIDs = (self.deviceIDs + [parsed.deviceID]).sorted()
            }
            // First device to report becomes the selection until the user picks.
            if self.selectedDeviceID == nil {
                self.selectedDeviceID = parsed.deviceID
            }
        }
    }
}

extension MQTTClient: CocoaMQTT5Delegate {
    func mqtt5(_ mqtt5: CocoaMQTT5, didConnectAck ack: CocoaMQTTCONNACKReasonCode, connAckData: MqttDecodeConnAck?) {
        DispatchQueue.main.async { self.connected = true }
        mqtt5.subscribe(wildcardTopic)
        refreshDeviceNames()
    }

    func mqtt5(_ mqtt5: CocoaMQTT5, didPublishMessage message: CocoaMQTT5Message, id: UInt16) {}
    func mqtt5(_ mqtt5: CocoaMQTT5, didPublishAck id: UInt16, pubAckData: MqttDecodePubAck?) {}
    func mqtt5(_ mqtt5: CocoaMQTT5, didPublishRec id: UInt16, pubRecData: MqttDecodePubRec?) {}

    func mqtt5(_ mqtt5: CocoaMQTT5, didReceiveMessage message: CocoaMQTT5Message, id: UInt16, publishData: MqttDecodePublish?) {
        handleMessage(topic: message.topic, payload: message.string ?? "")
    }

    func mqtt5(_ mqtt5: CocoaMQTT5, didSubscribeTopics success: NSDictionary, failed: [String], subAckData: MqttDecodeSubAck?) {}
    func mqtt5(_ mqtt5: CocoaMQTT5, didUnsubscribeTopics topics: [String], unsubAckData: MqttDecodeUnsubAck?) {}
    func mqtt5(_ mqtt5: CocoaMQTT5, didReceiveDisconnectReasonCode reasonCode: CocoaMQTTDISCONNECTReasonCode) {}
    func mqtt5(_ mqtt5: CocoaMQTT5, didReceiveAuthReasonCode reasonCode: CocoaMQTTAUTHReasonCode) {}
    func mqtt5DidPing(_ mqtt5: CocoaMQTT5) {}
    func mqtt5DidReceivePong(_ mqtt5: CocoaMQTT5) {}

    func mqtt5DidDisconnect(_ mqtt5: CocoaMQTT5, withError err: (any Error)?) {
        DispatchQueue.main.async { self.connected = false }
    }
}
