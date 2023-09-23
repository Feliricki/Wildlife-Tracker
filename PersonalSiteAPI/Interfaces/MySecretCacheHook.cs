using Amazon.Runtime;
using Amazon.SecretsManager.Extensions.Caching;
using Microsoft.AspNetCore.DataProtection;
using System.Text;
using System.Text.Json;
using Amazon.SecretsManager.Model;

namespace PersonalSiteAPI.Extensions
{
    public class KeyDTO<T>
    {
        public string KeyType { get; set; } = "";
        public T Data { get; set; } = default!;
    }

    public class MySecretCacheHook : ISecretCacheHook
    {
        private readonly ITimeLimitedDataProtector _dataProtector;
        private readonly uint _duration;        
        public MySecretCacheHook(
            ITimeLimitedDataProtector dataProtector, 
            uint duration=15)
        {
            _dataProtector = dataProtector;
            _duration = duration;
        }

        public object? Get(object cachedObject)
        {
            try
            {
                if (cachedObject is byte[] cachekey)
                {
                    //var x = new Amazon.SecretsManager.Model.DescribeSecretResponse();                
                    var stored = _dataProtector.Unprotect(cachekey);
                    var result = JsonSerializer.Deserialize<KeyDTO<object>>(stored);
                    Console.WriteLine("Retrieving result of type " + result!.KeyType);
                    switch (result!.KeyType)
                    {
                        case "Amazon.SecretsManager.Model.DescribeSecretRequest":
                            var requestData = JsonSerializer.Deserialize<KeyDTO<DescribeSecretRequest>>(stored);
                            return requestData!.Data;
                        case "Amazon.SecretsManager.Model.DescribeSecretResponse":
                            var Data = JsonSerializer.Deserialize<KeyDTO<DescribeSecretResponse>>(stored);
                            return Data!.Data;
                        case "Amazon.SecretsManager.Model.GetSecretValueResponse":
                            var responseData = JsonSerializer.Deserialize<KeyDTO<GetSecretValueResponse>>(stored);
                            return responseData!.Data;
                        default:
                            return null;
                    }
                }
                else
                {
                    throw new ArgumentNullException(nameof(cachedObject));
                }
            }catch (Exception ex)
            {
                Console.WriteLine(ex);
                return null;
            }
                   
        }
        public object? Put(object o)
        {
            Console.WriteLine("Placing object of type " + o.GetType().ToString() + " into cache.");
            try
            {
                var jsonString = o switch
                {
                    DescribeSecretRequest request => JsonSerializer.Serialize(new KeyDTO<DescribeSecretRequest>() { KeyType = typeof(DescribeSecretRequest).ToString(), Data = request }),
                    DescribeSecretResponse response => JsonSerializer.Serialize(new KeyDTO<DescribeSecretResponse>() { KeyType = typeof(DescribeSecretResponse).ToString(), Data = response }),
                    GetSecretValueResponse response => JsonSerializer.Serialize(new KeyDTO<GetSecretValueResponse>() { KeyType = typeof(GetSecretValueResponse).ToString(), Data = response }),
                    _ => throw new ArgumentException("Invalid Object Passed into Cache"),
                };
                var bytes = Encoding.UTF8.GetBytes(jsonString);
                return _dataProtector.Protect(bytes, TimeSpan.FromMinutes((double)_duration));
            }
            catch (Exception err)
            {
                Console.WriteLine(err);
                return null;
            }
        }
    }
}
