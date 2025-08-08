namespace WildlifeTrackerAPI.Services
{
    public interface IApiCachingService
    {
        Task<T> GetOrCreateAsync<T>(string cacheKey, Func<Task<T>> factory, TimeSpan? absoluteExpirationRelativeToNow = null, TimeSpan? slidingExpiration = null);
    }
}
