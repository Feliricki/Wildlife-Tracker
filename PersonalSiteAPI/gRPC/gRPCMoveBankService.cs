using Grpc.Core;
using GeoJSON = PersonalSiteAPI.DTO.GeoJSON;
using PersonalSiteAPI.Services;
using CsvHelper;
using System.Globalization;
using PersonalSiteAPI.DTO.MoveBankAttributes.DirectReadRecords;
using Newtonsoft.Json;

namespace PersonalSiteAPI.gRPC
{
    public class GRPCMoveBankService : MoveBankService.MoveBankServiceBase
    {

        private readonly IMoveBankService _moveBankService;
        public GRPCMoveBankService(IMoveBankService moveBankService) 
        {
            _moveBankService = moveBankService;
        }

        public override async Task GetEvents(
            EventRequest request, 
            IServerStreamWriter<LineStringFeatureCollection> responseStream,
            ServerCallContext context)
        {
            Console.WriteLine("Calling gRPC streaming service");

            var response = await _moveBankService.DirectRequestEvents(request);
            if (response is null || context.CancellationToken.IsCancellationRequested)
            {
                return;
            }

            var resStream = await response.Content.ReadAsStreamAsync();
            using var streamReader = new StreamReader(resStream);
            using var csvReader = new CsvReader(streamReader, CultureInfo.InvariantCulture);

            var records = new List<EventRecord>();
            while (await csvReader.ReadAsync())
            {
                var record = csvReader.GetRecord<EventRecord>();
                if (record?.Timestamp is null || record.LocationLat is null || record.LocationLong is null)
                {
                    continue;
                }
                records.Add(record);
            }

            if (context.CancellationToken.IsCancellationRequested)
            {
                return;
            }

            var data = GeoJSON.LineStringFeatureCollection<GeoJSON.LineStringProperties, GeoJSON.LineStringGeometry>.RecordToEventJsonDTO(records, request.StudyId);
            if (data is null)
            {
                return;
            }

            data.IndividualEvents.ForEach(l => l.Locations.Sort((x, y) => x.Timestamp.CompareTo(y.Timestamp)));
            var lineCollection = GeoJSON.LineStringFeatureCollection<GeoJSON.LineStringProperties, GeoJSON.LineStringGeometry>.StreamLineStringFeatureCollection(data);
            var numEvents = 0;

            foreach (var collection in lineCollection)
            {
                //Console.WriteLine(JsonConvert.SerializeObject(collection));
                Console.WriteLine($"Current collection has byte size {collection.CalculateSize()}");

                await responseStream.WriteAsync(collection);
                numEvents += collection.Features.Count;
                if (context.CancellationToken.IsCancellationRequested)
                {
                    return;
                }
            }

            Console.WriteLine($"Sent over {numEvents}.");
        }
    }  
}
