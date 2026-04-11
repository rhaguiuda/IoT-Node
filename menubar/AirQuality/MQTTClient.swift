import Foundation
import Combine
import CocoaMQTT

class MQTTClient: ObservableObject {
    @Published var co2: Double?
    @Published var temp: Double?
    @Published var umi: Double?
    @Published var connected = false
    @Published var lastMessage: Date?

    private var mqtt: CocoaMQTT5?
    private let broker = "192.168.100.224"
    private let port: UInt16 = 1883
    private let topicPrefix = "teras/iotnode/1/telemetry"

    init() {
        connect()
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

    private func handleMessage(topic: String, payload: String) {
        guard let value = Double(payload) else { return }
        let measurement = topic.split(separator: "/").last.map(String.init) ?? ""

        DispatchQueue.main.async {
            self.lastMessage = Date()
            switch measurement {
            case "co2": self.co2 = value
            case "temp": self.temp = value
            case "umi": self.umi = value
            default: break
            }
        }
    }
}

extension MQTTClient: CocoaMQTT5Delegate {
    func mqtt5(_ mqtt5: CocoaMQTT5, didConnectAck ack: CocoaMQTTCONNACKReasonCode, connAckData: MqttDecodeConnAck?) {
        DispatchQueue.main.async { self.connected = true }
        mqtt5.subscribe(topicPrefix + "/#")
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
