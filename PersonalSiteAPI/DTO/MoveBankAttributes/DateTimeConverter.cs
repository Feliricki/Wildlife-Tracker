using CsvHelper;
using CsvHelper.Configuration;
using CsvHelper.TypeConversion;
using System.Globalization;

namespace PersonalSiteAPI.DTO.MoveBankAttributes
{
    public class DateTimeConverter: DefaultTypeConverter
    {
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
