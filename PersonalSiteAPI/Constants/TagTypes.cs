namespace PersonalSiteAPI.Constants
{
    
    public class TagInfo
    {
        public string? Description { get; set; }
        public string? ExternalId { get; set; }
        public long? Id { get; set; }
        public bool? IsLocationSensor { get; set; }
        public string? Name { get; set; }
    }
    public class TagTypes
    {
        
        public List<TagInfo> SensorInformation = new List<TagInfo>()
        {
            new TagInfo()
            {
                Description = null,
                ExternalId = "bird-ring",
                Id = 397,
                IsLocationSensor = true,
                Name = "Bird Ring"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "gps",
                Id = 653,
                IsLocationSensor = true,
                Name = "GPS"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "radio-transmitter",
                Id = 673,
                IsLocationSensor = true,
                Name = "Radio Transmitter"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "argos-doppler-shift",
                Id = 82798,
                IsLocationSensor = true,
                Name = "Argos Doppler Shift"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "natural-mark",
                Id = 2365682,
                IsLocationSensor = true,
                Name = "Natural Mark"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "acceleration",
                Id = 2365683,
                IsLocationSensor = false,
                Name = "Acceleration"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "solar-geolocator",
                Id = 3886361,
                IsLocationSensor = true,
                Name = "Solar Geolocator"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "accessory-measurements",
                Id = 7842954,
                IsLocationSensor = false,
                Name = "Accessory Measurements"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "solar-geolocator-raw",
                Id = 9301403,
                IsLocationSensor = false,
                Name = "Solar Geolocator Raw"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "barometer",
                Id = 77740391,
                IsLocationSensor = false,
                Name = "Barometer"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "magnetometer",
                Id = 77740402,
                IsLocationSensor = false,
                Name = "Magnetometer"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "orientation",
                Id = 819073350,
                IsLocationSensor = false,
                Name = "Orientation"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "solar-geolocator-twilight",
                Id = 914097241,
                IsLocationSensor = false,
                Name = "Solar Geolocator Twilight"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "acoustic-telemetry",
                Id = 1239574236,
                IsLocationSensor = true,
                Name = "Acoustic Telemetry"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "gyroscope",
                Id = 1297673380,
                IsLocationSensor = false,
                Name = "Gyroscope"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "heart-rate",
                Id = 2365683,
                IsLocationSensor = false,
                Name = "Heart Rate"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "sigfox-geolocation",
                Id = 2299894820,
                IsLocationSensor = true,
                Name = "Sigfox Geolocation"
            },
            new TagInfo()
            {
                Description = null,
                ExternalId = "proximity",
                Id = 2645090675,
                IsLocationSensor = false,
                Name = "Proximity"
            },
        };
        public HashSet<string> locationSensors = new HashSet<string>()
        {
            "GPS",
            "Bird Ring",
            "Radio Transmitter",
            "Argos Doppler Shift",
            "Natural Mark",
            "Solar Geolocator",
            "Acoustic Telemetry",
            "Sigfox Geolocation",
            "Natural Mark",
        };

        public Dictionary<long, string> idToSensor = new Dictionary<long, string>()
        {
            [397] = "bird-ring",
            [653] = "gps",
            [673] = "radio-transmitter",
            [82798] = "argos-doppler-shift",
            [2365682] = "natural-mark",
            [2365683] = "solar-geolocator",
            [7842954] = "accessory-measurements",
            [9301403] = "solar-geolocator-raw",
            [77740391] = "barometer",
            [77740402] = "magnetometer",
            [819073350] = "orientation",
            [914097241] = "solar-geolocator-twilight",
            [1239574236] = "acoustic-telemetry",
            [1297673380] = "gyroscope",
            [2206221896] = "heart-rate",
            [2299894820] = "sigfox-geolocation",
            [2645090675] = "proximity"
        };
        public enum SensorType : long
        {
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
        };
        

        public bool IsLocationSensor(string? location_sensor_ids)
        {
            if (location_sensor_ids == null)
            {
                return false;
            }
            var splitList = location_sensor_ids.Split(new string[] { "," }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var sensor in  splitList)
            {
                if (!string.IsNullOrEmpty(sensor) && locationSensors.Contains(sensor.Trim()))
                {
                    Console.WriteLine("Found sensor: " + sensor.Trim());
                    return true;
                }
            }
            return false;
        }

        
    }
}
