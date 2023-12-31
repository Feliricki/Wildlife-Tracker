﻿using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace PersonalSiteAPI.DTO.MoveBankAttributes;


// TODO: This class will need a custom validator.
public class EventRequest
{
    [Required]
    [JsonPropertyName(name: "studyId")]
    public long StudyId { get; set; }

    [Required]
    [JsonPropertyName(name: "localIdentifiers")]
    public List<string> LocalIdentifiers { get; set; } = new();
    [JsonPropertyName(name: "sensorType")] public string? SensorType { get; set; } = null;

    [JsonPropertyName(name: "geometryType")]
    public string? GeometryType { get; set; } = null;

    [JsonPropertyName(name: "options")] public EventOptions Options { get; set; } = default!;
}

public class EventOptions
{
    [JsonPropertyName(name: "maxEventsPerIndividual")]
    public int? MaxEventsPerIndividual { get; set;}
    
    [JsonPropertyName(name:"timestampStart")]
    public long? TimestampStart { get; set; }
    
    [JsonPropertyName(name: "timestampEnd")]
    public long? TimestampEnd { get; set; }
    
    [JsonPropertyName(name: "attributes")]
    public string? Attributes { get; set; }

    [JsonPropertyName(name: "eventProfile")]
    public string? EventProfile { get; set; } = null;
}