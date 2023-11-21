// using Microsoft.EntityFrameworkCore;

using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Configuration.UserSecrets;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Newtonsoft.Json;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Services;
using Xunit.Abstractions;

namespace PersonalSiteAPI.Tests;
public class AutoCompleteTests
{
    public class Startup
    {
        // TODO: Run this test and check for correct configuration
        public void ConfigureHost(IHostBuilder hostBuilder) =>
            hostBuilder
                .ConfigureHostConfiguration(builder => builder.AddUserSecrets(Assembly.GetExecutingAssembly()))
                .ConfigureServices((context, services) =>
                {
                    var connectionString = context.Configuration["ConnectionStrings:DefaultConnection"];
                    services.AddSqlServer<ApplicationDbContext>(connectionString);

                    services.AddSingleton<IAutoCompleteService, AutoCompleteService>();
                });
    }
    
    private readonly ITestOutputHelper _output;
    private readonly ApplicationDbContext _context;
    private readonly IAutoCompleteService _autoCompleteService;
    public AutoCompleteTests(
        ITestOutputHelper output,
        ApplicationDbContext context,
        IAutoCompleteService autoCompleteService)
    {
        _output = output;
        _context = context;
        _autoCompleteService = autoCompleteService;
    }

    [Fact]
    public void NonEmptyTrie()
    {
        Assert.NotEqual(0, _autoCompleteService.Count());
    }

    [Fact]
    public void ContainsWordsWithPrefix()
    {
        var words = _autoCompleteService.GetAllWordsWithPrefix("y");
        _output.WriteLine(JsonConvert.SerializeObject(words.Select(word => string.Join("", word))));
    }

    [Fact]
    public void ContainsAllWords()
    {
        // var words = _autoCompleteService.
    }
}