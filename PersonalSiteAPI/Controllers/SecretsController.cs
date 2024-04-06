using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;
using Amazon.SecurityToken;
using Amazon.SecurityToken.Model;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Amazon.S3;
using PersonalSiteAPI.Services;
using Amazon;
using Microsoft.AspNetCore.Authorization;
using PersonalSiteAPI.Constants;

namespace PersonalSiteAPI.Controllers
{
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class SecretsController: ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IAmazonSecretsManager _amazonSecretsManager;
        public SecretsController(
            IConfiguration configuration,
            IAmazonSecretsManager amazonSecretsManager)
        {
            _configuration = configuration;
            _amazonSecretsManager = amazonSecretsManager;
        }

        [HttpGet(Name = "GetSecrets")]
        [Authorize(Roles = $"{RoleNames.Administrator}, {RoleNames.Moderator}")]
        public async Task<IActionResult> GetSecret()
        {
            try
            {
                GetSecretValueRequest request = new GetSecretValueRequest
                {
                    SecretId = "WebSiteKeys",
                    VersionStage = "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified.
                };
                var response = await _amazonSecretsManager.GetSecretValueAsync(request);
                return Ok(response.SecretString);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}