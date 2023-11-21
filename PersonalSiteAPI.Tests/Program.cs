global using Xunit;
// global using Xunit.DependencyInjection;
// using Microsoft.EntityFrameworkCore;
// using Microsoft.Extensions.Configuration;
// using Microsoft.Extensions.DependencyInjection;
// using PersonalSiteAPI.Models;
// using PersonalSiteAPI.Services;
//
// [assembly: CollectionBehavior(DisableTestParallelization = true)]
//
// namespace PersonalSiteAPI.Tests;
//
// [Startup(startupType:typeof(AutoCompleteTests))]
// public class Startup
// {
//     public void ConfigureServices(IServiceCollection services, IConfiguration configuration)
//     {
//         Console.WriteLine("Configuring services.");
//         // services.AddTransient<IDependency, DependencyClass>();
//         var connectionString = configuration["ConnectionStrings:DefaultConnection"];
//         Console.WriteLine(connectionString);
//         
//         services.AddDbContext<ApplicationDbContext>(options =>
//         { 
//             // IConfigurationRoot configuration = GetConfiguration("ConnectionString");
//             // NOTE: Switch this to the other connection string to make changes to production database
//             Console.WriteLine("Initializing database service.");
//             options.UseSqlServer(connectionString, options =>
//             {
//                 options.CommandTimeout(60);
//             });
//         });
//         services.AddSingleton<IAutoCompleteService, AutoCompleteService>();
//     }
// }
