using Microsoft.EntityFrameworkCore;
using System.Linq.Dynamic.Core;
using System.Reflection;

namespace WildlifeTrackerAPI.DTO
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

        //private readonly string _cacheKey = "GetStudies";


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


        // This method is used in case of a cache hit
        public static ApiResult<T> Create(
            IEnumerable<T> source,
            int pageIndex,
            int pageSize,
            string? sortColumn = null,
            string? sortOrder = null,
            string? filterColumn = null,
            string? filterQuery = null)
        {
            Console.WriteLine("Calling apiCreate Create (cache hit)");
            var list = source.ToList();
            var queryable = list.AsQueryable();

            if (!string.IsNullOrEmpty(filterColumn) && !string.IsNullOrEmpty(filterQuery) && IsValidProperty(filterColumn))
            {
                queryable = queryable.Where(
                    string.Format("{0}.Contains(@0, @1)", filterColumn), filterQuery, StringComparison.InvariantCultureIgnoreCase);
            }

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
                count,
                pageIndex,
                pageSize,
                sortColumn,
                sortOrder,
                filterColumn,
                filterQuery
                );
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
            Console.WriteLine("Calling ApiResult CreateAsync");

            // If the filterColumn and the filterQuery has been set then filter using said query
            // Tentatively, filterColumn will always be the 'name' column
            if (!string.IsNullOrEmpty(filterColumn) && !string.IsNullOrEmpty(filterQuery)
                && IsValidProperty(filterColumn))
            {                
                // Checking if filterColumn starts with filterQuery (case insensitive)
                source = source.Where(
                    string.Format("{0}.Contains(@0)", filterColumn), filterQuery);

            }

            var count = await source.CountAsync();

            if (!string.IsNullOrEmpty(sortColumn) && !string.IsNullOrEmpty(sortOrder)
                                                  && IsValidProperty(sortColumn))
            {
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
