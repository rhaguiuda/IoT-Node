import Foundation

/// Parses a telemetry topic of the form
/// `teras/iotnode/<device_id>/telemetry/<measurement>` into its parts.
/// Returns `nil` for any topic that does not match that exact shape.
public func parseTopic(_ topic: String) -> (deviceID: String, measurement: String)? {
    let parts = topic.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
    guard parts.count == 5,
          parts[0] == "teras",
          parts[1] == "iotnode",
          parts[3] == "telemetry",
          !parts[2].isEmpty,
          !parts[4].isEmpty
    else { return nil }
    return (parts[2], parts[4])
}
