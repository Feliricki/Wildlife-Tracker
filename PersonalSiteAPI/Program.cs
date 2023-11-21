using Amazon.SecretsManager;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Services;
using Mapster;
using PersonalSiteAPI.Mappings;


var builder = WebApplication.CreateBuilder(args);
// Add services to the container.

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(cfg =>
    {
        cfg.WithOrigins(builder.Configuration["AllowedOrigins"]!);
        cfg.AllowAnyHeader();
        cfg.AllowAnyMethod();
    });
    options.AddPolicy(name: "AnyOrigin",
        cfg =>
        {
            cfg.AllowAnyOrigin();
            cfg.AllowAnyHeader();
            cfg.AllowAnyMethod();
        });
});

builder.Services.AddControllers(options =>
{
    options.CacheProfiles.Add("NoCache",
        new CacheProfile() { NoStore = true });
    options.CacheProfiles.Add("Any-60",
        new CacheProfile() { Location = ResponseCacheLocation.Any, Duration = 60 });
    options.CacheProfiles.Add("5-Minutes",
        new CacheProfile() { Location = ResponseCacheLocation.Any, Duration = 60 * 5 });
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddHealthChecks();
// Custom Services 
builder.Services.AddTransient<IMoveBankService, MoveBankService>();
builder.Services.AddHttpClient<IMoveBankService, MoveBankService>(client =>
{
    client.BaseAddress = new Uri("https://www.movebank.org/movebank/service/");    
});

builder.Services.AddHttpContextAccessor();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    // NOTE: Switch this to the other connection string to make changes to production database
    //options.UseSqlServer(builder.Configuration["TestConnectionStrings:DefaultConnection"]);
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"), options =>
    {
        options.CommandTimeout(60);
    }); 
});

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 12;
})
    .AddEntityFrameworkStores<ApplicationDbContext>();


// AUTHENTICATION
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme =
    options.DefaultChallengeScheme =
    options.DefaultForbidScheme =
    options.DefaultScheme =
    options.DefaultSignInScheme =
    options.DefaultSignOutScheme =
        JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        RequireExpirationTime = true,
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
        ValidAudience = builder.Configuration["JwtSettings:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            System.Text.Encoding.UTF8.GetBytes(
                builder.Configuration["JwtSettings:SecurityKey"]!))
    };
});

builder.Services.AddMapster();
builder.Services.RegisterMapsterConfiguration();

builder.Services.AddSingleton<IAutoCompleteService, AutoCompleteService>();

builder.Services.AddDataProtection();
builder.Services.AddScoped<JwtHandler>();

// Amazon Key Vault Services
var options = builder.Configuration.GetAWSOptions();
builder.Services.AddDefaultAWSOptions(builder.Configuration.GetAWSOptions());

builder.Services.AddAWSService<IAmazonSecretsManager>();

builder.Services.AddResponseCaching(options =>
{
    options.MaximumBodySize = 64 * 1024 * 1024; // 64 MB
    options.SizeLimit = 100 * 1024 * 1024; // 100 MB
});

builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = 1024 * 1024 * 1024; // 1 GB
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseExceptionHandler("/Error");
    app.MapGet("/Error", () => Results.Problem());
    app.UseHsts();
    app.Use(async (context, next) =>
    {
        // Prevent click hijacking
        context.Response.Headers.Add("X-Frame-Options", "sameorigin");
        context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");
        context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
        // Prevents XSS attacks
        context.Response.Headers.Add("Content-Security-Policy", "default-src 'self' ;");
        context.Response.Headers.Add("Referrer-Policy", "strict-origin");


        await next();
    });
}

app.UseHttpsRedirection();

app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

// When it comes to mapping controllers its first come first serve  
//app.UseHealthChecks(new PathString("/api/health"));
app.MapControllers().RequireCors("AnyOrigin");

app.Run();
