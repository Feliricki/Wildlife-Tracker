using CsvHelper;
using CsvHelper.Configuration;
using CsvHelper.TypeConversion;
using System.Globalization;

namespace WildlifeTrackerAPI.DTO.MoveBankAttributes
{
    public class DateTimeConverter: DefaultTypeConverter
    {
        /// <summary>
        /// This method converts the timestamps from the CSV file into a DateTime object
        /// </summary>
        /// <param name="text">The timestamp</param>
        /// <param name="row">unused</param>
        /// <param name="memberMapData">unused</param>
        /// <returns>A DateTime object if the parsing worked and null otherwise.</returns>
        public override object? ConvertFromString(string? text, IReaderRow row, MemberMapData memberMapData)
        {
            if (string.IsNullOrEmpty(text))
            {
                return null;
            }
            var formatString = "yyyy-MM-dd HH:mm:ss.fff";
            if (DateTime.TryParseExact(text, formatString, null, DateTimeStyles.None, out var result))
            {
                return result;
            }
            else
            {
                return null;
            }
        }
    }
}
