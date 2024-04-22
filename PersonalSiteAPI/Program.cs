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
using PersonalSiteAPI.Hubs;
using PersonalSiteAPI.Models.Email;
using MailKit;
using Microsoft.AspNetCore.Diagnostics;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddLogging(option =>
{
    option.AddApplicationInsights(                     
        telemetry => telemetry.ConnectionString =
        builder
            .Configuration["Azure:ApplicationInsights:ConnectionString"],loggerOptions => { });
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

builder.Services.Configure<MailSettings>(builder.Configuration.GetSection("MailSettings"));
builder.Services.Configure<MailRecipient>(builder.Configuration.GetSection("MailRecipient"));
builder.Services.AddTransient<IEmailService, EmailService>();

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
var options = builder.Configuration.GetAWSOptions();
// Console.WriteLine(options.Credentials);
builder.Services.AddDefaultAWSOptions(builder.Configuration.GetAWSOptions());

builder.Services.AddAWSService<IAmazonSecretsManager>();

// TODO: Use MessagePack protocol.
// When serializing data, use indexed key as opposed to string keys.
// Consider a custom formatter resolver for datetime objects.


builder.Services.AddSignalR(options =>
{
    options.DisableImplicitFromServicesParameters = true;
    //options.StatefulReconnectBufferSize = 4096;
    // Set up the client to send pings every second.
    options.KeepAliveInterval = TimeSpan.FromSeconds(10);
    options.MaximumParallelInvocationsPerClient = 1;
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);

}).AddMessagePackProtocol(options =>
{
    options.SerializerOptions = MessagePack.MessagePackSerializerOptions.Standard
        //.WithResolver(new CustomResolver)
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
    // NOTE:Production settings.
    app.UseExceptionHandler("/Error ");
    app.MapGet("/Error", (HttpContext context) => {
        var exceptionHandler =
            context.Features.Get<IExceptionHandlerPathFeature>();

        var details = new ProblemDetails();
        details.Detail = exceptionHandler?.Error.Message;
        details.Extensions["traceId"] =
            System.Diagnostics.Activity.Current?.Id
              ?? context.TraceIdentifier;
        details.Type =
            "https://tools.ietf.org/html/rfc7231#section-6.6.1";
        details.Status = StatusCodes.Status500InternalServerError;

        app.Logger.LogError(
            exceptionHandler?.Error,
            "An unhandled exception occurred.");

        return Results.Problem(details);
    }
    );
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
app.UseRouting();

//app.UseCors("AnyOrigin");
app.UseCors("Angular");

//var websocketOptions = new WebSocketOptions();
app.UseWebSockets();

app.UseAuthentication();
app.UseAuthorization();

app.UseRateLimiter();

//app.UseEndpoints(endpoints =>
//{
//    endpoints.MapControllers().RequireCors("SpecificOrigins");
//    endpoints.MapHub<MoveBankHub>("/api/MoveBank-Hub");
//});

app.MapControllers().RequireCors("Angular");
app.MapHub<MoveBankHub>("/api/MoveBank-Hub", options =>
{
    options.AllowStatefulReconnects = true;
    options.TransportMaxBufferSize = 1024 * 1024;
}).RequireCors("Angular");

////app.UseHealthChecks(new PathString("/api/health"));
////app.MapControllers().RequireCors("AnyOrigin");
//app.MapControllers().RequireCors("SpecificOrigins");

app.Run();