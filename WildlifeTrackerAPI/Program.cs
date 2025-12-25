using Amazon.SecretsManager;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WildlifeTrackerAPI.Models;
using WildlifeTrackerAPI.Services;
using Mapster;
using WildlifeTrackerAPI.Mappings;
using WildlifeTrackerAPI.Hubs;
using Amazon.Runtime;
using WildlifeTrackerAPI.Repositories;
using ExceptionHandlerMiddleware = WildlifeTrackerAPI.Middleware.ExceptionHandlerMiddleware;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddLogging(option =>
{
    option.AddApplicationInsights(                     
        telemetry => telemetry.ConnectionString =
        builder
            .Configuration["Azure:ApplicationInsights:ConnectionString"],_ => { });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy(name: "Angular", cfg =>
    {
        cfg.WithOrigins(builder.Configuration["AllowedCORS"]!);
        cfg.AllowAnyHeader();
        cfg.AllowAnyMethod();
        cfg.AllowCredentials();
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
//builder.Services.AddTransient<IMoveBankService, MoveBankService>();
builder.Services.AddHttpClient<IMoveBankService, MoveBankService>(client =>
{
    client.BaseAddress = new Uri("https://www.movebank.org/movebank/service/");
    client.Timeout = TimeSpan.FromSeconds(20);
});

builder.Services.AddHttpContextAccessor();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString = builder.Environment.IsDevelopment()
        ? builder.Configuration["TestConnectionStrings:DefaultConnection"]
        : builder.Configuration["ConnectionStrings:DefaultConnection"];
    
    if (string.IsNullOrEmpty(connectionString))
    {
        throw new InvalidOperationException("Database connection string is not configured.");
    }
    
    options.UseSqlServer(connectionString, optionsBuilder => 
    {
        optionsBuilder.CommandTimeout(60);
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

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
});


builder.Services.AddMapster();
builder.Services.RegisterMapsterConfiguration();

builder.Services.AddSingleton<IAutoCompleteService, AutoCompleteService>();

builder.Services.AddDataProtection();
builder.Services.AddScoped<JwtHandler>();

// Amazon Key Vault Services
var awsOptions = builder.Configuration.GetAWSOptions();

var accessKey = builder.Configuration["AWS:AccessKey"];
var secretKey = builder.Configuration["AWS:SecretKey"];

if (string.IsNullOrEmpty(accessKey) || string.IsNullOrEmpty(secretKey))
{
    throw new InvalidOperationException("AWS credentials are not properly configured. Check AWS:AccessKey and AWS:SecretKey settings.");
}

awsOptions.Credentials = new BasicAWSCredentials(accessKey, secretKey);
builder.Services.AddDefaultAWSOptions(awsOptions);
builder.Services.AddAWSService<IAmazonSecretsManager>();

builder.Services.AddSignalR(options =>
{
    options.DisableImplicitFromServicesParameters = true;
    // Set up the client to send pings every second.
    options.KeepAliveInterval = TimeSpan.FromSeconds(10);
    options.MaximumParallelInvocationsPerClient = 1;
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);

}).AddMessagePackProtocol(options =>
{
    options.SerializerOptions = MessagePack.MessagePackSerializerOptions.Standard
        .WithSecurity(MessagePack.MessagePackSecurity.UntrustedData);
});

builder.Services.AddResponseCaching(options =>
{
    options.MaximumBodySize = 64 * 1024 * 1024; // 64 MB
    options.SizeLimit = 100 * 1024 * 1024; // 100 MB
});

builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = (1024 * 1024); // 1 MB
    options.TrackStatistics = true;
});

builder.Services.AddScoped<IStudyRepository, StudyRepository>();
builder.Services.AddScoped<ICachingService, CachingService>();

var app = builder.Build();


// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
    app.Use(async (context, next) =>
    {
        // Prevent click hijacking
        context.Response.Headers.Append("X-Frame-Options", "sameorigin");
        context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
        context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
        // Prevents XSS attacks
        context.Response.Headers.Append("Content-Security-Policy", "default-src 'self' ;");
        context.Response.Headers.Append("Referrer-Policy", "strict-origin");
        // 
        await next();
    });
}

app.UseHttpsRedirection();

app.UseMiddleware<ExceptionHandlerMiddleware>();

app.UseRouting();

//app.UseCors("AnyOrigin");
app.UseCors("Angular");

//var websocketOptions = new WebSocketOptions();
app.UseWebSockets();

app.UseAuthentication();
app.UseAuthorization();

app.UseRateLimiter();

//});

app.MapControllers().RequireCors("Angular");
app.MapHub<MoveBankHub>("/api/MoveBank-Hub", options =>
{
    options.AllowStatefulReconnects = true;
    options.TransportMaxBufferSize = 1024 * 1024;
}).RequireCors("Angular");


app.Run();
