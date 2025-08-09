using Microsoft.Extensions.Caching.Memory;

namespace WildlifeTrackerAPI.Services
{
    public class ApiCachingService : IApiCachingService
    {
        private readonly IMemoryCache _memoryCache;
        private readonly MemoryCacheEntryOptions _defaultCacheOptions;

        public ApiCachingService(IMemoryCache memoryCache)
        {
            _memoryCache = memoryCache;
            _defaultCacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                SlidingExpiration = TimeSpan.FromMinutes(2),
                Size = 1
            };
        }

        public async Task<T> GetOrCreateAsync<T>(string cacheKey, Func<Task<T>> factory, TimeSpan? absoluteExpirationRelativeToNow = null, TimeSpan? slidingExpiration = null)
        {
            if (_memoryCache.TryGetValue(cacheKey, out T? value)) return value!;
            value = await factory();
            if (value == null) return value!;
            var options = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = absoluteExpirationRelativeToNow ?? _defaultCacheOptions.AbsoluteExpirationRelativeToNow,
                SlidingExpiration = slidingExpiration ?? _defaultCacheOptions.SlidingExpiration,
                Size = _defaultCacheOptions.Size
            };
            _memoryCache.Set(cacheKey, value, options);
            return value!;
        }
    }
}
