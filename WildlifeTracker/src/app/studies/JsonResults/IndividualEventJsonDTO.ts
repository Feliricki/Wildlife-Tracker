import { LocationJsonDTO } from "./LocationJsonDTO";

export interface IndividualEventJsonDTO {
  studyId: bigint;
  individualLocalIdentifier: string;
  individualTaxonCanonicalName: string;
  sensorTypeId: bigint;
  sensorId: bigint;
  individualId: bigint;
  locations: LocationJsonDTO[];
}

// [Required]
// [JsonPropertyName("study_id")]
// public long StudyId { get; set; }
// [Required]
// [JsonPropertyName("individual_local_identifier")]
// public string IndividualLocalIdentifier { get; set; } = string.Empty;
//
// [JsonPropertyName("individual_taxon_canonical_name")]
// public string IndividualTaxonCanonicalName { get; set; } = string.Empty;
//
// [JsonPropertyName("sensor_type_id")]
// public long SensorTypeId { get; set; }
//
// [JsonPropertyName("sensor_id")]
// public long SensorId { get; set; }
//
// [JsonPropertyName("individual_id")]
// public long IndividualId { get; set; }
//
// [JsonPropertyName("locations")]
// public List<LocationJsonDTO> Locations { get; set; } = new List<LocationJsonDTO>();
