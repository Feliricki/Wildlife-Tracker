using System.Text.Json.Serialization;
using WildlifeTrackerAPI.DTO.MoveBankAttributes.JsonDTOs;
using WildlifeTrackerAPI.Constants;
using WildlifeTrackerAPI.DTO.MoveBankAttributes;
using WildlifeTrackerAPI.DTO.MoveBankAttributes.DirectReadRecords;
using WildlifeTrackerAPI.Models;

namespace WildlifeTrackerAPI.DTO.GeoJSON;

public record EventRecordGroup
{
    public string? IndividualLocalIdentifier { get; set; }

    public IEnumerable<EventRecord>? Records { get; set; }
}

public record LineStringGroup<TProp>
{
    public string IndividualLocalIdentifier { get; set; } = default!;
    public IEnumerable<Feature<TProp, LineStringGeometry>> Features { get; set; } = [];
}

public record MetadataRecord
    {
        [JsonPropertyName(name: "count")]
        public int Count { get; set; }
        public List<int> BufferSizes { get; set; } = [];
        public List<double> TotalDistanceTravelled { get; set; } = [];
        public int? Pairs { get; set; } // To be used for LineStrings

        // public List<string>? LocalIdentifiers  { get; set; }
        [JsonPropertyName(name: "localIdentifier")]
        public string? LocalIdentifier { get; set; }

        [JsonPropertyName(name: "sensorUsed")]
        public HashSet<string>? SensorsUsed { get; set; }
        [JsonPropertyName(name: "taxon")]
        public HashSet<string>? Taxon { get; set; }
    }

    // MetaData for a lineStringFeatureCollection.
    public record LineStringMetadata
    {
        [JsonPropertyName(name: "count")]
        public int Count { get; set; }
        [JsonPropertyName(name: "totalDistanceTravelled")]
        public double TotalDistanceTravelled { get; set; }
        [JsonPropertyName(name: "localIdentifier")]
        public string LocalIdentifier { get; set; } = default!;
        [JsonPropertyName(name: "sensorUsed")]
        public string SensorUsed { get; set; } = default!;
        [JsonPropertyName(name: "taxa")]
        public string Taxa { get; set; } = default!;

    }

    public class PointFeatureCollection<TProp>
        where TProp : class
    {
        [JsonInclude]
        [JsonPropertyName(name: "type")]
        public readonly string Type = "FeatureCollection";

        [JsonPropertyName(name: "metadata")]
        public MetadataRecord? Metadata { get; set; }

        [JsonPropertyName(name: "features")]
        public List<Feature<TProp, Point>> Features { get; set; } = [];

        [JsonPropertyName(name: "id")]
        public long? Id { get; set; }

        public static PointFeatureCollection<TProp> CreateFromEvents(IndividualEventDTO? events, Func<LocationJsonDTO, TProp> propertyFunc)
        {
            var collection = new PointFeatureCollection<TProp>();
            if (events is null)
            {
                collection.Features = [];
                return collection;
            }

            foreach (var location in events.Locations)
            {
                var point = new Point([location.LocationLong, location.LocationLat]);
                var feature = new Feature<TProp, Point>
                {
                    Geometry = point,
                    Properties = propertyFunc(location)
                };
                collection.Features.Add(feature);
            }

            collection.Metadata = new MetadataRecord()
            {
                Count = events.Locations.Count,
            };

            return collection;
        }

        //public static PointFeatureCollection<TProp> CreatePoint

        public static PointFeatureCollection<TProp> Create(IndividualEventDTO events, Func<LocationJsonDTO, TProp> propertyFunc)
        {
            return CreateFromEvents(events, propertyFunc);
        }

        public static PointFeatureCollection<TProp> CombinePointFeatures(EventJsonDTO events, Func<LocationJsonDTO, TProp> propertyFunc)
        {
            var pointCollection = CreateFromEvents(null, propertyFunc);
            pointCollection.Metadata = new MetadataRecord
            {
                Count = 0,
                BufferSizes = [],
                SensorsUsed = [],
                Taxon = []
            };

            foreach (var individuals in events.IndividualEvents)
            {
                //var collection = new PointFeatureCollection<TProp>(individuals, propertyFunc);
                var collection = CreateFromEvents(individuals, propertyFunc);
                var newCount = collection.Features.Count;

                pointCollection.Features.AddRange(collection.Features);
                pointCollection.Metadata.Count += newCount;
                pointCollection.Metadata.BufferSizes.Add(newCount);
                pointCollection.Metadata.Taxon.Add(individuals.IndividualTaxonCanonicalName);

                if (TagTypes.SensorIdToName(individuals.SensorTypeId) is not null)
                {
                    pointCollection.Metadata.SensorsUsed.Add(TagTypes.SensorIdToName(individuals.SensorTypeId)!);
                }

            }

            return pointCollection;
        }

        public static PointFeatureCollection<TProp> CreateFromStudies(IEnumerable<StudyDTO> studies, Func<StudyDTO, TProp> propertyFunc)
        {
            var collection = new PointFeatureCollection<TProp>();
            foreach (var study in studies)
            {
                if (study.MainLocationLat is null || study.MainLocationLon is null)
                {
                    continue;
                }

                var point = new Point([study.MainLocationLon ?? 0, study.MainLocationLat ?? 0]);
                var feature = new Feature<TProp, Point>
                {
                    Geometry = point,
                    Properties = propertyFunc(study)
                };
                collection.Features.Add(feature);
            }

            return collection;
        } 
    }

    // TODO: This entire class is in need of a refactors.
    public class LineStringFeatureCollection<TProp>
    {
        [JsonPropertyName(name: "type")]
        public string Type { get; set; } = "FeatureCollection";

        [JsonPropertyName(name: "metadata")]
        public LineStringMetadata? Metadata { get; set; }

        [JsonPropertyName(name: "features")]
        public List<Feature<LineStringPropertiesV1, LineStringGeometry>> Features { get; set; } = default!;

        [JsonPropertyName(name: "id")]
        public long? Id { get; set; }

        public static Feature<LineStringPropertiesV2, LineStringGeometry> CreateLineStringFeature(
            LocationJsonDTO prevLocation,
            LocationJsonDTO location,
            LineStringPropertiesV2 properties)
        {
            var geometry = new LineStringGeometry(
                "LineString",
                [[prevLocation.LocationLong, prevLocation.LocationLat],
                [location.LocationLong, location.LocationLat]
            ]);
            var feature = new Feature<LineStringPropertiesV2, LineStringGeometry> 
            {
                Type = "Feature",
                Geometry = geometry,
                Properties = properties,
            };
            return feature;
        }

        public static LineStringFeatureCollection<LineStringPropertiesV1> CreateCollection(IndividualEventDTO events)
        {
            var collection = new LineStringFeatureCollection<LineStringPropertiesV1>();
            var totalCount = events.Locations.Count;

            var totalDistance = HelperFunctions.GetTotalDistanceHelper(events);

            collection.Metadata = CreateLineStringMetadataHelper(events, totalDistance);

            collection.Features = [];
            double runningDistance = 0;
            double runningDistanceKilometers = 0;
            double initialTimestamp = events.Locations.First().Timestamp;
            var i = 0;
            foreach (var location in events.Locations.TakeWhile(location => i < totalCount - 1))
            {
                if (i == totalCount - 1)
                {
                    i++;
                    continue;
                }

                var nextLocation = events.Locations[i + 1];
                // Format: [Longitude, Latitude, Altitude]
                var from = new List<float> { location.LocationLong, location.LocationLat, 1 };
                var to = new List<float> { nextLocation.LocationLong, nextLocation.LocationLat, 1 };

                var distanceKilometers = HelperFunctions.Haversine(location.LocationLong, location.LocationLat, nextLocation.LocationLong, nextLocation.LocationLat);
                var distanceDelta = HelperFunctions.EuclideanDistance(location, nextLocation);

                runningDistance += distanceDelta;
                runningDistanceKilometers += distanceKilometers;

                var lineString = new Feature<LineStringPropertiesV1, LineStringGeometry>
                {
                    Geometry = new LineStringGeometry("LineString", [from, to]),
                    Properties = new LineStringPropertiesV1
                    {
                        From = HelperFunctions.TimestampToDateTime(location.Timestamp),
                        To = HelperFunctions.TimestampToDateTime(nextLocation.Timestamp),
                        Content = HelperFunctions.CreateContentHelper(events.IndividualLocalIdentifier, location, nextLocation, distanceKilometers, runningDistanceKilometers),
                        Distance = distanceDelta,
                        DistanceTravelled = runningDistance,
                        Timestamp = location.Timestamp,
                    }
                };

                collection.Features.Add(lineString);
                i++;
            }

            collection.Metadata.Count = collection.Features.Count;
            ColorGradientGenerator.ColorGradientForLineString(totalDistance: totalDistance, collection.Features);
            
            return collection;
        }


        public static LineStringMetadata CreateLineStringMetadataHelper(IndividualEventDTO events, double distanceTravelled)
        {
            return new LineStringMetadata
            {
                LocalIdentifier = events.IndividualLocalIdentifier,
                SensorUsed = TagTypes.SensorIdToName(events.SensorTypeId) ?? "N/A",
                Taxa = events.IndividualTaxonCanonicalName,
                TotalDistanceTravelled = distanceTravelled,
            };
        }

        public static IEnumerable<EventRecordGroup> GroupRecordsByIndividual(IEnumerable<EventRecord> records)
        {
            var eventDto = new EventJsonDTO();
            var groups = records.GroupBy(record => record.IndividualLocalIdentifier,
                (localIdentifier, groupedRecords) => new EventRecordGroup
                {
                    IndividualLocalIdentifier = localIdentifier,
                    Records = groupedRecords
                });
            return groups;
        }

        public static EventJsonDTO RecordToEventJsonDto(IEnumerable<EventRecord> records, long studyId)
        {
            var eventDto = new EventJsonDTO();
            var groups = GroupRecordsByIndividual(records);

            foreach (var group in groups)
            {
                var events = ToIndividualJsonDTO(group, studyId);
                if (events is null)
                {
                    continue;
                }
                eventDto.IndividualEvents.Add(events);
            }

            return eventDto;
        }

        public static IndividualEventDTO? ToIndividualJsonDTO(EventRecordGroup? recordGroup, long studyId)
        {
            var events = new IndividualEventDTO();
            if (recordGroup?.Records is null || recordGroup.IndividualLocalIdentifier is null)
            {
                return null;
            }

            events.IndividualLocalIdentifier = recordGroup.IndividualLocalIdentifier;
            events.StudyId = studyId;

            foreach (var record in recordGroup.Records)
            {
                if (record.IndividualTaxonCanonicalName is not null && events.IndividualTaxonCanonicalName is null)
                {
                    events.IndividualTaxonCanonicalName = record.IndividualTaxonCanonicalName;
                }

                var unixTimestamp = new DateTimeOffset(record.Timestamp ?? DateTime.UtcNow).ToUnixTimeMilliseconds();
                float locationLat = record.LocationLat ?? 0;
                float locationLong = record.LocationLong ?? 0;

                var location = new LocationJsonDTO
                {
                    LocationLat = locationLat,
                    LocationLong = locationLong,
                    Timestamp = unixTimestamp
                };
                events.Locations.Add(location);
            }
            return events;
        }

        public static LineStringGroup<LineStringPropertiesV2> ToLineStringGroup(EventRecordGroup recordGroups)
        {
            IEnumerable<Feature<LineStringPropertiesV2, LineStringGeometry>> featureEnumerable = ToLineStringFeature(recordGroups);
            return new LineStringGroup<LineStringPropertiesV2>
            {
                Features = featureEnumerable,
                IndividualLocalIdentifier = recordGroups.IndividualLocalIdentifier ?? "N/A"
            };
        }

        public static IEnumerable<Feature<LineStringPropertiesV2, LineStringGeometry>> ToLineStringFeature(
            EventRecordGroup recordGroups)
        {
            if (recordGroups.IndividualLocalIdentifier is null || recordGroups.Records is null)
            {
                yield break;
            }

            var localIdentifier = recordGroups.IndividualLocalIdentifier;
            var enumerator = recordGroups.Records.OrderBy(r => r.Timestamp).GetEnumerator();

            var i = 0;
            LocationJsonDTO? prevLocation = null;
            double runningDistanceKm = 0;
            while (enumerator.MoveNext())
            {
                var record = enumerator.Current;
                if (record.LocationLat is null || record.LocationLong is null
                        || record.Timestamp is null || record.IndividualLocalIdentifier is null) throw new InvalidOperationException("Record had null fields");

                if (prevLocation is null)
                {
                    prevLocation = ToLocationJson((DateTime)record.Timestamp, (float)record.LocationLat, (float)record.LocationLong);
                    i++;
                    continue;
                }

                LocationJsonDTO curLocation = ToLocationJson((DateTime)record.Timestamp, (float)record.LocationLat, (float)record.LocationLong);

                double curDistanceKm = HelperFunctions.Haversine(prevLocation.LocationLong, prevLocation.LocationLat, (float)record.LocationLong, (float)record.LocationLat);
                runningDistanceKm += curDistanceKm;

                LineStringPropertiesV2 props = LineStringPropertiesV2.Create(prevLocation, curLocation, localIdentifier, curDistanceKm, runningDistanceKm);
                var lineStringFeature = CreateLineStringFeature(prevLocation, curLocation, props);

                yield return lineStringFeature;
                i++;
                prevLocation = curLocation;
            }
        }

        // Combine a eventJsonDTO into a list of events.
        public static List<LineStringFeatureCollection<LineStringPropertiesV1>> CombineLineStringFeatures(EventJsonDTO events)
        {
            return events.IndividualEvents.Select(CreateCollection).ToList();
        }
        public static LocationJsonDTO ToLocationJson(DateTime timestamp, float locationLat, float locationLong)
        {
            return new LocationJsonDTO
            {
                LocationLat = locationLat,
                LocationLong = locationLong,
                Timestamp = new DateTimeOffset(timestamp).ToUnixTimeMilliseconds(),
            };
        }
    
}
