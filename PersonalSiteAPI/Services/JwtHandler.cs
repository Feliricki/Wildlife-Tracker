using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using PersonalSiteAPI.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace PersonalSiteAPI.Services
{

    public class JwtHandler(
        IConfiguration configuration,
        UserManager<ApplicationUser> userManager)
    {
        private readonly IConfiguration _configuration = configuration;
        private readonly UserManager<ApplicationUser> _userManager = userManager;

        public async Task<JwtSecurityToken> GetTokenAsync(ApplicationUser user)
        {
            var jwtOptions = new JwtSecurityToken(
                issuer: _configuration["JwtSettings:Issuer"],
                audience: _configuration["JwtSettings:Audience"],
                claims: await GetClaimsAsync(user),
                expires: DateTime.Now.AddMinutes(Convert.ToDouble(
                    _configuration["JwtSettings:ExpirationTimeInMinutes"])),
                signingCredentials: GetSigningCredentials());
            return jwtOptions;
        }

        private SigningCredentials GetSigningCredentials()
        {
            var secret = GetSymmetricSecurityKey();
            return new SigningCredentials(secret, SecurityAlgorithms.HmacSha256);
        }

        private SymmetricSecurityKey GetSymmetricSecurityKey()
        {
            var key = Encoding.UTF8.GetBytes(_configuration["JwtSettings:SecurityKey"]!);
            var secret = new SymmetricSecurityKey(key);
            return secret;
        }

        private async Task<List<Claim>> GetClaimsAsync(ApplicationUser user)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.Name, user.Email!)
            };

            foreach (var role in await _userManager.GetRolesAsync(user))
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }
            return claims;
        }

        private async Task<bool> ValidateToken(string token)
        {
            // TODO: The token includes the 'Bearer ' part
            string[] split = token.Split(" ");
            if (split.Length != 2)
            {
                return false;
            }

            token = split[1];
            var handler = new JwtSecurityTokenHandler();
            var validationParameters = new TokenValidationParameters()
            {
                IssuerSigningKey = GetSymmetricSecurityKey(),
                ValidAudience = _configuration["JwtSettings:Audience"],
                ValidIssuer = _configuration["JwtSettings:Issuer"]
            };
            var result = await handler.ValidateTokenAsync(token, validationParameters);
            return result.IsValid;
        }

        public async Task<List<string>> GetRolesFromUserAsync(ApplicationUser user)
        {
            var claims = await GetClaimsAsync(user);
            return claims
                .Where(c => c.Type == "role" || c.Type == "roles" || c.Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/role")
                .Select(c => c.Value)
                .ToList();
        }

        public async Task<List<string>> GetRolesFromToken(string token)
        {
            if (!await ValidateToken(token))
            {
                Console.WriteLine("Failed to validate token");
                return [];
            }

            token = token.Split(" ")[1];
            var handler = new JwtSecurityTokenHandler();
            var claims = handler.ReadJwtToken(token);
            return handler.ReadJwtToken(token)
                .Claims
                .Where(c => c.Type == "role" || c.Type == "roles" || c.Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/role")
                .Select(c => c.Value)
                .ToList();
        }
    }
}
