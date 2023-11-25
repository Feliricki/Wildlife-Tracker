// Sensor type ids
export enum LocationSensors {
    BirdRing = 397,
    GPS = 653,
    RadioTransmitter = 673,
    ArgosDopplerShift = 82798,
    NaturalMark = 2365682,
    SolarGeolocator = 2365683,
    AccessoryMeasurements = 7842954,
    SolarGeolocatorRaw = 9301403,
    Barometer = 77740391,
    Magnetometer = 77740402,
    Orientation = 819073350,
    SolarGeolocatorTwilight = 914097241,
    AcousticTelemetry = 1239574236,
    Gyroscope = 1297673380,
    HeartRate = 2206221896,
    SigfoxGeolocation = 2299894820,
    Proximity = 2645090675
}

export function isLocationSensor(sensor: string): boolean {
    const sensors = ["gps", "bird ring", "radio transmitter", "argos doppler shift",
        "natural mark", "solar geolocator", "acoustic telemetry", "sigfox geolocation"];
    return sensors.some(value => sensor.toLowerCase() === value);
}
