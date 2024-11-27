using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;
using Microsoft.AspNetCore.Mvc;
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
        private readonly ILogger<SecretsController> _logger;
        public SecretsController(
            IConfiguration configuration,
            IAmazonSecretsManager amazonSecretsManager,
            ILogger<SecretsController> logger)
        {
            _configuration = configuration;
            _amazonSecretsManager = amazonSecretsManager;
            _logger = logger;   
        }

        [HttpGet(Name = "GetSecrets")]
        [Authorize(Roles = $"{RoleNames.Administrator}, {RoleNames.Moderator}")]
        public async Task<IActionResult> GetSecret()
        {
            try
            {
                _logger.LogDebug("Attempting to retrieve secrets from amazon configurations");
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
                _logger.LogError(ex.Message);
                return BadRequest(ex.Message);
            }
        }
    }
}