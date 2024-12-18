﻿using CsvHelper;
using MessagePack;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
//using NetTopologySuite.Features;
using Newtonsoft.Json;
using PersonalSiteAPI.DTO.GeoJSON;
using PersonalSiteAPI.DTO.MoveBankAttributes;
using PersonalSiteAPI.DTO.MoveBankAttributes.DirectReadRecords;
using PersonalSiteAPI.Services;
using System.Globalization;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json.Serialization;
using SystemJson = System.Text.Json;

namespace PersonalSiteAPI.Hubs
{
    [MessagePackObject]
    public class LineStringFeatures
    {
        [Key(0)]
        [JsonPropertyName(name: "features")]
        public List<Feature<LineStringPropertiesV2, LineStringGeometry>> Feature { get; set; } = [];
        [Key(1)]
        [JsonPropertyName(name: "individualLocalIdentifier")]
        public string IndividualLocalIdentifier { get; set; } = default!;
        [Key(2)]
        [JsonPropertyName(name: "count")]
        public int Count { get; set; }
        [Key(3)]
        [JsonPropertyName(name: "index")]
        public int Index { get; set; } 
    }
    public interface IMoveBankHub
    {
        IAsyncEnumerable<byte[]> StreamEvents(
            EventRequest request, 
            CancellationToken cancellationToken);        
    }

    public class MoveBankHub : Hub<IMoveBankHub>
    {

        public override Task OnConnectedAsync()
        {
            Console.WriteLine("Established connection to Hub.");
            return base.OnConnectedAsync();
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            Console.WriteLine("Disconnected from stream. Message: " + exception?.Message ?? "No Message.");
            return base.OnDisconnectedAsync(exception);
        }

        
        // TODO: This method needs validation.
        public async IAsyncEnumerable<byte[]> StreamEvents(
            EventRequest request,
            [FromServices] IMoveBankService moveBankService,
            [FromServices] ICachingService cachingService,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            Console.WriteLine("Starting streaming events for request: " + JsonConvert.SerializeObject(request));

            // TODO: Adjust the request to only ask for data for which there is no cache.
            // Now test the caching service.
            List<string> localIdentifiers = request.LocalIdentifiers?.ToList() ?? [];
            if (localIdentifiers.Count == 0)
            {
                yield break;
            }

            // TODO: Decide if this http call still needs to be made if all requested individuals are cached.
            HttpResponseMessage? response = await moveBankService.DirectRequestEvents(request);
            if (response is null)
            {
                Console.WriteLine("Response was null.");
                yield break;
            }
            using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var streamReader = new StreamReader(stream, Encoding.UTF8);
            using var csvReader = new CsvReader(streamReader, CultureInfo.InvariantCulture);

            // Use this as the main loop to improve memory usage.
            long studyId = request.StudyId;
            var FeaturesByIndividuals =
                 csvReader
                .GetRecords<EventRecord>()
                .Where(record => record?.Timestamp is not null && record.LocationLat is not null && record.LocationLong is not null)                       
                .GroupBy(record => record.IndividualLocalIdentifier, (localIdentifier, recordGroup) => new EventRecordGroup
                {
                    IndividualLocalIdentifier = localIdentifier,
                    Records = recordGroup
                })
                .Select(LineStringFeatureCollection<LineStringPropertiesV2>.ToLineStringGroup);           
            
            foreach (var featureCollection in FeaturesByIndividuals)
            {
                //Console.WriteLine("Looping through collection.");
                cancellationToken.ThrowIfCancellationRequested();

                // For MessagePack serialization, consider using a custom formatter resolver to utilize flat buffers 
                // A example of the above procedure should already be present in the SignalR github repo.
                string curAnimal = featureCollection.IndividualLocalIdentifier;

                List<Feature<LineStringPropertiesV2, LineStringGeometry>> curFeatures = [];
                List<LineStringFeatures> lineStringFeatures = [];

                var index = 0;
                var j = 0;
                foreach (var feature in featureCollection.Features)
                {           
                    cancellationToken.ThrowIfCancellationRequested();                    
                    curFeatures.Add(feature);
                    if (curFeatures.Count >= 1000)
                    {
                        //Console.WriteLine("Returning 10000 features.");
                        var features =  new LineStringFeatures
                        {
                            Feature = curFeatures,
                            IndividualLocalIdentifier = curAnimal,
                            Count = curFeatures.Count,
                            Index = index
                        };
                        lineStringFeatures.Add(features);
                        byte[] serialized = MessagePackSerializer.Serialize(features, cancellationToken: cancellationToken);
                        
                        yield return serialized;
                        curFeatures = [];                        
                        index++;
                        j++;
                    }
                }
                
                if (curFeatures.Count >= 0)
                {
                    //Console.WriteLine($"Returning {curFeatures.Count} features.");
                    var features =  new LineStringFeatures 
                    {
                        Feature = curFeatures,
                        IndividualLocalIdentifier = curAnimal,
                        Count = curFeatures.Count,
                        Index = index
                    };
                    lineStringFeatures.Add(features);
                    byte[] serialized = MessagePackSerializer.Serialize(features, cancellationToken: cancellationToken);
                    yield return serialized;
                    index++;
                }                
                cachingService.AddIndividual(studyId, curAnimal, request.Options.EventProfile, lineStringFeatures);
            }        
        }
    }
}
