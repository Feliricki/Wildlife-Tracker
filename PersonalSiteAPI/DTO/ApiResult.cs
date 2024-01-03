using System.Collections;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Linq.Dynamic.Core;
using System.Reflection;
using System.Linq.Expressions;

//using System.Linq.
//using EFCore.BulkExtensions;

// TODO: Test functionality
// Performance data validation in the controller methods
namespace PersonalSiteAPI.DTO
{
    public class ApiResult<T>
    {
        // Properties
        public List<T> Data { get; private set; }
        public int PageIndex { get; private set; }
        public int PageSize { get; private set; }
        public int TotalCount { get; private set; }
        public int TotalPages { get; private set; }
        public string? SortColumn { get; private set; }
        public string? SortOrder { get; private set; }
        public string? FilterColumn { get; private set; }
        public string? FilterQuery { get; private set; }

        private readonly string _cacheKey = "GetStudies";


        private ApiResult(
            List<T> data,
            int count,
            int pageIndex,
            int pageSize,
            string? sortColumn,
            string? sortOrder,
            string? filterColumn,
            string? filterQuery)
        {
            Data = data;
            PageIndex = pageIndex;
            PageSize = pageSize;
            TotalCount = count;
            TotalPages = (int)Math.Ceiling(count / (double)pageSize);
            SortColumn = sortColumn;
            SortOrder = sortOrder;
            FilterColumn = filterColumn;
            FilterQuery = filterQuery;
        }

        public static ApiResult<T> Create(
            IEnumerable<T> source,
            int pageIndex,
            int pageSize,
            string? sortColumn = null,
            string? sortOrder = null,
            string? filterColumn = null,
            string? filterQuery = null)
        {
            var list = source.ToList();
            var queryable = list.AsQueryable();
            Console.WriteLine("Creating apiResult synchronously");
            // var filters = new List<Func<T, bool>>();

            if (!string.IsNullOrEmpty(filterColumn) && !string.IsNullOrEmpty(filterQuery) && IsValidProperty(filterColumn))
            {
                queryable = queryable.Where(
                    string.Format("{0}.StartsWith(@0, @1)", filterColumn), filterQuery, StringComparison.InvariantCultureIgnoreCase);
            }

            // NOTE: This change is untested.
            var count = queryable.Count();

            if (!string.IsNullOrEmpty(sortColumn) && !string.IsNullOrEmpty(sortOrder) && IsValidProperty(sortColumn))
            {
                Console.WriteLine($"Sorting: Column={sortColumn} Order={sortOrder}");
                sortOrder = !string.IsNullOrEmpty(sortOrder)
                    && sortOrder.ToUpper() == "ASC"
                    ? "ASC"
                    : "DESC";
                queryable = queryable.OrderBy(
                    string.Format(
                        "{0} {1}",
                        sortColumn,
                        sortOrder)
                );
            }

            queryable = queryable
                .Skip(pageIndex * pageSize)
                .Take(pageSize);

            var data = queryable.ToList();
            return new ApiResult<T>(
                data,
                // list.Count,
                count,
                pageIndex,
                pageSize,
                sortColumn,
                sortOrder,
                filterColumn,
                filterQuery
                );
        }

        // TODO: Move caching strategy to this class. 
        // Check cache for other endpoints aswell
        private List<T>? CheckCache(IMemoryCache memoryCache, string key)
        {
            if (!memoryCache.TryGetValue<List<T>>(key, out var result))
            {
                return null;
            }
            if (!memoryCache.TryGetValue<List<T>>(_cacheKey, out var result2))
            {
                return null;
            }
            return result ?? result2;
        }

        public static async Task<ApiResult<T>> CreateAsync(
            IQueryable<T> source,
            int pageIndex,
            int pageSize,
            string? sortColumn = null,
            string? sortOrder = null,
            string? filterColumn = null,
            string? filterQuery = null
            )
        {
            Console.WriteLine("Creating apiResult asynchronously.");
            // TODO - Upgrade this method to search for case-insensitive substrings
            Console.WriteLine($"filtercolumn = {filterColumn} filterquery = {filterQuery} isValidProperty({filterColumn ?? "N/A"}) = {IsValidProperty(filterColumn ?? "")}");
            if (!string.IsNullOrEmpty(filterColumn) && !string.IsNullOrEmpty(filterQuery)
                && IsValidProperty(filterColumn))
            {
                Console.WriteLine($"Async Prefix search: Checking if {filterColumn} start with {filterQuery} (Case insensitive)");
                Console.WriteLine(source.GetType().ToString());
                Expression<Func<string, bool>> stringExpression = (a) => a.StartsWith(filterQuery, StringComparison.InvariantCultureIgnoreCase);
                source = source.Where(stringExpression);
                // if (typeof(IQueryable<string>) == source.GetType())
                // {
                //     // Console.WriteLine("Source is of type string in ApiResult");
                //     // Expression<Func<string, bool>> stringExpression = (a) => a.StartsWith(filterQuery, StringComparison.InvariantCultureIgnoreCase);
                //     // source = source.Where(stringExpression);
                //     // source = source.Where(
                //     //     string.Format("{0}.StartsWith(@0, @1)", filterColumn), filterQuery, StringComparison.InvariantCultureIgnoreCase);
                // }
            }

            var count = await source.CountAsync();
            Console.WriteLine($"The number of records is {count}");

            if (!string.IsNullOrEmpty(sortColumn) && !string.IsNullOrEmpty(sortOrder)
                                                  && IsValidProperty(sortColumn))
            {
                Console.WriteLine($"Sorting: Column={sortColumn} Order={sortOrder}");
                sortOrder = !string.IsNullOrEmpty(sortOrder)
                    && sortOrder.ToUpper() == "ASC"
                    ? "ASC"
                    : "DESC";
                source = source.OrderBy(
                    string.Format(
                        "{0} {1}",
                        sortColumn,
                        sortOrder)
                    );
            }

            source = source
                .Skip(pageIndex * pageSize)
                .Take(pageSize);

            Console.WriteLine("Creating the final list");
            List<T> data = await source.ToListAsync();
            return new ApiResult<T>(
                data,
                count,
                pageIndex,
                pageSize,
                sortColumn,
                sortOrder,
                filterColumn,
                filterQuery
                );
        }

        /// <summary>
        /// Checks if the given property name exists
        /// to protect against SQL injection attacks
        /// </summary>
        public static bool IsValidProperty(
            string propertyName,
            bool throwExceptionIfNotFound = false)
        {
            var prop = typeof(T).GetProperty(
                propertyName,
                BindingFlags.IgnoreCase |
                BindingFlags.Public |
                BindingFlags.Static |
                BindingFlags.Instance);
            if (prop == null && throwExceptionIfNotFound)
                throw new NotSupportedException($"ERROR: Property '{propertyName}' does not exist.");
            return prop != null;
        }

        ///<summary>
        /// TRUE if the current page has a previous page,
        /// FALSE otherwise.
        /// </summary>
        public bool HasPreviousPage
        {
            get
            {
                return (PageIndex > 0);
            }
        }

        /// <summary>
        /// TRUE if the current page has a next page, FALSE otherwise.
        /// </summary>
        public bool HasNextPage
        {
            get
            {
                return ((PageIndex + 1) < TotalPages);
            }
        }

    }
}