using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.MoveBankAttributes.JsonDTOs
{
    public class LocationJsonDTO
    {
        [JsonPropertyName("timestamp")]
        public long Timestamp { get; set; }
        // Save space by using a float
        [JsonPropertyName("location_long")]
        public float LocationLong { get; set; }

        [JsonPropertyName("location_lat")]
        public float LocationLat { get; set; }

        // Optional fields
        [JsonPropertyName("eobs_speed_accuracy_estimate")]
        public float EobsSpeedAccuracyEstimate { get; set; }

        [JsonPropertyName("eobs_temperature")]
        public float EobsTemperature { get; set; }

        [JsonPropertyName("ground_speed")]
        public float GroundSpeed { get; set; }

        [JsonPropertyName("eobs_key_bin_checksum")]
        public long EobsKeyBinChecksum { set; get; }

        [JsonPropertyName("eobs_battery_voltage")]
        public int EobsBatteryVoltage { get; set; }

        [JsonPropertyName("eobs_voltage")]
        public string? EobsStatus { get; set; }

        [JsonPropertyName("eobs_used_time_to_get_fix")]
        public int EobsUsedTimeToGetFix { get; set; }

        [JsonPropertyName("eobs_horizontal_accuracy_estimate")]
        public float EbosHorizontalAccuracyEstimate { get; set; }

        [JsonPropertyName("eobs_fix_battery_voltage")]
        public int EobsFixBatteryVoltage {  get; set; }

        [JsonPropertyName("height_above_ellipsoid")]
        public float HeightAboveEllopsoid { get; set; }

        [JsonPropertyName("eobs_type_of_fix")]
        public int EobsTypeOfFix { get; set; }

        public float Heading { get; set; }                
        public bool Visible { get; set; } = true;
        public string? Comments { get; set; } = null;

        [JsonPropertyName("eobs_start_timestamp")]
        public long EobsStartTimestamp { get; set; }
    }
}
