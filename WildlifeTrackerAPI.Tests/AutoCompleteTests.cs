// using Microsoft.EntityFrameworkCore;

using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WildlifeTrackerAPI.Models;
using WildlifeTrackerAPI.Services;
using Xunit.Abstractions;

namespace WildlifeTrackerAPI.Tests;
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
        var words = _autoCompleteService.GetAllWordsWithPrefix("ya");
        foreach (var word in words)
        {
            _output.WriteLine(string.Join("", word));
        }
    }

    [Fact]
    public void GetsWordsWithLimit()
    {
        var words = _autoCompleteService.GetAllWordsWithPrefix("", 2);
        foreach (var word in words)
        {
            _output.WriteLine(string.Join("", word));
        }
    }

    [Fact]
    public void ContainsAllWords()
    {
        var words = _autoCompleteService.GetAllWordsWithPrefix("");
        _output.WriteLine($"Total Count: {words.Count}");
        foreach (var word in words.Take(50))
        {
            _output.WriteLine(string.Join("", word));
        }
    }
}
