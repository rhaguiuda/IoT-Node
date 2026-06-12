import XCTest
@testable import AirQualityCore

final class TopicParserTests: XCTestCase {
    func testValidTopic() {
        let result = parseTopic("teras/iotnode/e8069066185c/telemetry/co2")
        XCTAssertEqual(result?.deviceID, "e8069066185c")
        XCTAssertEqual(result?.measurement, "co2")
    }

    func testValidTopicTempAndUmi() {
        XCTAssertEqual(parseTopic("teras/iotnode/abc/telemetry/temp")?.measurement, "temp")
        XCTAssertEqual(parseTopic("teras/iotnode/abc/telemetry/umi")?.deviceID, "abc")
    }

    func testRejectsWrongPrefix() {
        XCTAssertNil(parseTopic("foo/iotnode/abc/telemetry/co2"))
        XCTAssertNil(parseTopic("teras/other/abc/telemetry/co2"))
    }

    func testRejectsWrongSegment() {
        XCTAssertNil(parseTopic("teras/iotnode/abc/status/co2"))
    }

    func testRejectsTooFewSegments() {
        XCTAssertNil(parseTopic("teras/iotnode/abc/telemetry"))
        XCTAssertNil(parseTopic("teras/iotnode/telemetry/co2"))
    }

    func testRejectsTooManySegments() {
        XCTAssertNil(parseTopic("teras/iotnode/abc/telemetry/co2/extra"))
    }

    func testRejectsEmptyDeviceID() {
        XCTAssertNil(parseTopic("teras/iotnode//telemetry/co2"))
    }
}
