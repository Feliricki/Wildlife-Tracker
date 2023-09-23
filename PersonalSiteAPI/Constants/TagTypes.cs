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
    }
}
