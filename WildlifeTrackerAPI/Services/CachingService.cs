using Microsoft.Extensions.Caching.Memory;
using WildlifeTrackerAPI.Hubs;

namespace WildlifeTrackerAPI.Services
{
    public interface ICachingService
    {
        void AddIndividual(long studyId, string localIdentifier, string? eventProfile, IEnumerable<LineStringFeatures> feature);
        void AddAll(long studyId, string? eventProfile, IEnumerable<KeyValuePair<string, List<LineStringFeatures>>> individualsAndEvents);
        bool TryGetIndividualEvents(long studyId, string localIdentifier, string? eventProfile, out List<LineStringFeatures> foundEvents);
    }

    public class CachingService(
        IMemoryCache memoryCache) : ICachingService
    {
        readonly IMemoryCache _memoryCache = memoryCache;
        private readonly MemoryCacheEntryOptions _memoryCacheOptions = new()
        {
            Size = 1,
            SlidingExpiration = TimeSpan.FromMinutes(1),
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2)
        };

        public void AddIndividual(long studyId, string localIdentifier, string? eventProfile, IEnumerable<LineStringFeatures> features)
        {
            var lineStringFeaturesEnumerable = features as LineStringFeatures[] ?? features.ToArray();
            if ((features.TryGetNonEnumeratedCount(out var count) && count == 0) || !lineStringFeaturesEnumerable.Any())
            {
                return;
            }
            var cacheKey = $"{studyId}-{localIdentifier}-{eventProfile ?? "None"}";
            _memoryCache.Set(cacheKey, lineStringFeaturesEnumerable.ToList(), _memoryCacheOptions);
        }

        public void AddAll(long studyId, string? eventProfile, IEnumerable<KeyValuePair<string, List<LineStringFeatures>>> individualsAndEvents)
        {
            foreach (var keyValue in individualsAndEvents)
            {
                AddIndividual(studyId, keyValue.Key, eventProfile, keyValue.Value);
            }
        }

        public bool TryGetIndividualEvents(long studyId, string localIdentifier, string? eventProfile, out List<LineStringFeatures> foundEvents)
        {
            foundEvents = [];
            var cacheKey = $"{studyId}-{localIdentifier}-{eventProfile ?? "None"}";
            if (_memoryCache.TryGetValue<List<LineStringFeatures>>(cacheKey, out var foundFeatures))
            {
                foundEvents = foundFeatures ?? [];
                return foundEvents.Count > 0;
            }
            return false;
        }
    }
}
