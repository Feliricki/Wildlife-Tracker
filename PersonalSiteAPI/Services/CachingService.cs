using Microsoft.Extensions.Caching.Memory;
using PersonalSiteAPI.Hubs;

namespace PersonalSiteAPI.Services
{
    public interface ICachingService
    {
        void AddIndividual(long studyId, string localIdentifier, string? eventProfile, IEnumerable<LineStringFeatures> feature);
        void AddAll(long studyId, string? eventProfile, IEnumerable<KeyValuePair<string, List<LineStringFeatures>>> individualsAndEvents);
        bool TryGetIndividualEvents(long studyId, string localIdentifier, string? eventProfile, out List<LineStringFeatures> foundEvents);
    }

    // TODO: Decide on caching options.
    public class CachingService : ICachingService
    {
        readonly IMemoryCache _memoryCache;
        readonly MemoryCacheEntryOptions memoryCacheOptions = new()
        {
            Size = 1,
            SlidingExpiration = TimeSpan.FromMinutes(1),
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2)
        };
        public CachingService(
            IMemoryCache memoryCache)
        {
            _memoryCache = memoryCache;
        }

        public void AddIndividual(long studyId, string localIdentifier, string? eventProfile, IEnumerable<LineStringFeatures> features)
        {
            if ((features.TryGetNonEnumeratedCount(out var count) && count == 0) || !features.Any())
            {
                return;
            }
            var cacheKey = $"{studyId}-{localIdentifier}-{eventProfile ?? "None"}";
            _memoryCache.Set<List<LineStringFeatures>>(cacheKey, features.ToList(), memoryCacheOptions);
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
            if (!_memoryCache.TryGetValue<List<LineStringFeatures>>(cacheKey, out var foundFeatures))
            {
                foundEvents = foundFeatures ?? [];
                return foundEvents.Count > 0;
            }
            return false;
        }
    }
}