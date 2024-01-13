using CsvHelper;    
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

    public record LineStringFeatures
    {
        [JsonPropertyName(name: "features")]
        public List<Feature<object, LineStringGeometry>> Feature { get; set; } = [];
        [JsonPropertyName(name: "individualLocalIdentifier")]
        public string IndividualLocalIdentifier { get; set; } = default!;
        [JsonPropertyName(name: "count")] 
        public int Count { get; set; }
        [JsonPropertyName(name: "index")]
        public int Index { get; set; } 
    }
    public interface IMoveBankHub
    {
        IAsyncEnumerable<LineStringFeatures> StreamEvents(
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

        
        // TODO:
        // 1) This request needs to be validated.
        // 2) Caching of certain results should be considered (the size of the event being stored should be calculated)
        // 3) Switch to MessagePack protocol once testing is complete.
        public async IAsyncEnumerable<LineStringFeatures> StreamEvents(
            EventRequest request,
            [FromServices] IMoveBankService moveBankService,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {

            Console.WriteLine("Starting streaming events for request: " + JsonConvert.SerializeObject(request));
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
                Console.WriteLine("Looping through collection.");
                cancellationToken.ThrowIfCancellationRequested();

                // For MessagePack serialization, consider using a custom formatter resolver to utilize flat buffers 
                // A example of the above procedure should already be present in the SignalR github repo.
                string curAnimal = featureCollection.IndividualLocalIdentifier;
                List<Feature<object, LineStringGeometry>> curFeatures = [];
                var index = 0;
                foreach (var feature in featureCollection.Features)
                {                    
                    cancellationToken.ThrowIfCancellationRequested();
                    curFeatures.Add(feature);
                    if (curFeatures.Count >= 500)
                    {
                        Console.WriteLine("Returning 500 features.");
                        yield return new LineStringFeatures
                        {
                            Feature = curFeatures,
                            IndividualLocalIdentifier = curAnimal,
                            Count = curFeatures.Count,
                            Index = index
                        };
                        //if (index == 0)
                        //{
                        //    var jsonString = SystemJson.JsonSerializer.Serialize(curFeatures);
                        //    Console.WriteLine($"Feature has size {jsonString.Length} in bytes.");
                        //}
                        curFeatures = [];
                        
                        index++;
                    }                    
                }
                
                if (curFeatures.Count >= 0)
                {
                    Console.WriteLine($"Returning {curFeatures.Count} features.");
                    yield return new LineStringFeatures 
                    {
                        Feature = curFeatures,
                        IndividualLocalIdentifier = curAnimal,
                        Count = curFeatures.Count,
                        Index = index
                    };
                    index++;
                }
            }        
        }
    }
}
