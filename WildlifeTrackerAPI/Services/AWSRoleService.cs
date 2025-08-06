using Amazon.SecurityToken;
using Amazon.SecurityToken.Model;

namespace WildlifeTrackerAPI.Services
{
    public interface IAWSRoleService
    {
        Task<Credentials?> AssumeIAMRoleAsync(string roleArn, int duration=1600, string sessionName="RoleServiceSessions");
    }
    public class AWSRoleService : IAWSRoleService
    {
        //var RoleArnToAssume =
        private readonly IConfiguration _configuration;
        public AWSRoleService(
            IConfiguration configuration)
        {
            _configuration = configuration;
        }
        

        public async Task<Credentials?> AssumeIAMRoleAsync(string roleArn, int duration=1600, string sessionName="RoleServiceSession")
        {
            var client = new AmazonSecurityTokenServiceClient();
            var callerIdRequest = new GetCallerIdentityRequest();
            var caller = await client.GetCallerIdentityAsync(callerIdRequest);
            Console.WriteLine($"Original Caller: {caller.Arn}");

            var assumeRoleReq = new AssumeRoleRequest()
            {
                DurationSeconds = duration,
                RoleSessionName = sessionName,
                RoleArn = roleArn
            };
            var response = await client.AssumeRoleAsync(assumeRoleReq);
            return response.Credentials;
        }
    }
}
