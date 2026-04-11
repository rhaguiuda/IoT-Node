// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AirQuality",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/emqx/CocoaMQTT.git", from: "2.1.6"),
    ],
    targets: [
        .executableTarget(
            name: "AirQuality",
            dependencies: ["CocoaMQTT"],
            path: "AirQuality"
        ),
    ]
)
