using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Newtonsoft.Json;
using PersonalSiteAPI.Models;
using PersonalSiteAPI.Services;
using Xunit.Abstractions;

namespace PersonalSiteAPI.Tests;

public class TrieTests
{
    private readonly ITestOutputHelper _output;

    public class Startup
    {
        // TODO: Run this test and check for correct configuration
        public void ConfigureHost(IHostBuilder hostBuilder) =>
            hostBuilder
                .ConfigureHostConfiguration(builder => builder.AddUserSecrets(Assembly.GetExecutingAssembly()))
                .ConfigureServices((context, services) =>
                {
                    // var connectionString = context.Configuration["ConnectionStrings:DefaultConnection"];
                    // services.AddSqlServer<ApplicationDbContext>(connectionString);
                    //
                    // services.AddSingleton<IAutoCompleteService, AutoCompleteService>();
                });
    }
    public TrieTests(ITestOutputHelper output)
    {
        _output = output;
    }
    [Fact]
    public void BasicInsertionAndSearch()
    {
        Trie<char> trie = new Trie<char>();
        trie.Insert("apple");
        Assert.True(trie.Search("apple"));
        Assert.False(trie.Search("app"));
        Assert.True(trie.StartWith("app"));
    }

    [Fact]
    public void InsertingAndSearchingMultipleWords()
    {
        Trie<char> trie = new Trie<char>();
        trie.Insert("apple");
        trie.Insert("banana");
        trie.Insert("orange");
        Assert.True(trie.Search("banana"));
        Assert.False(trie.Search("grape"));
        Assert.True(trie.StartWith("or"));
    }

    [Fact]
    public void CaseSensitivity()
    {
        Trie<char> trie = new Trie<char>();
        trie.Insert("apple");
        Assert.False(trie.Search("Apple"));
    }

    [Fact]
    public void EmptyTrie()
    {
        Trie<char> trie = new Trie<char>();
        Assert.False(trie.Search("anyword"));
    }

    [Fact]
    public void DecrementingCount()
    {
        Trie<char> trie = new Trie<char>();
        trie.Insert("apple");
        trie.Insert("apple");
        trie.Insert("apple");
        trie.Insert("banana");
        trie.Insert("banana");
        trie.Insert("orange");
        trie.Insert("orange");
        trie.Insert("orange");

        Assert.True(trie.Search("apple"));
        Assert.True(trie.Search("banana"));
        Assert.True(trie.Search("orange"));
    }
    [Fact]
    public void CaseInsensitive_Search()
    {
        var trie = new Trie<char>(new CaseInsensitiveCharComparer());

        trie.Insert("Apple");
        var retval = trie.Traverse();
        _output.WriteLine(JsonConvert.SerializeObject(retval));
        Assert.True(trie.Search("apple"));
        Assert.True(trie.Search("APPLE"));
        Assert.True(trie.Search("ApPlE"));
    }

    [Fact]
    public void CaseInsensitive_StartWith()
    {
        var trie = new Trie<char>(new CaseInsensitiveCharComparer());

        trie.Insert("Apple");

        Assert.True(trie.StartWith("ap"));
        Assert.True(trie.StartWith("AP"));
        Assert.True(trie.StartWith("aP"));
    }

    [Fact]
    public void StartsWith_GetNode()
    {
        var trie = new Trie<char>(new CaseInsensitiveCharComparer());
        trie.Insert("App");
        trie.Insert("application");
        trie.Insert("apple");

        var node = trie.StartsWithGetNode("a");
        Assert.NotNull(node);
        Assert.Equal('A', node.Item2.Value);
        Assert.NotEmpty(node.Item1);
        // _output.WriteLine(JsonConvert.SerializeObject(node.Item1) + "\r");
        // _output.WriteLine(JsonConvert.SerializeObject (  node.Item2, Formatting.Indented,  new JsonConverter [] {new StringEnumConverter ()}));
    }
    [Fact]
    public void TraversalTest()
    {
        Trie<char> trie = new Trie<char>(new CaseInsensitiveCharComparer());
        // ITestOutputHelper output = new TestOutputHelper();
        trie.Insert("Apple");
        trie.Insert("aPple");
        trie.Insert("apPle");
        trie.Insert("banana");
        trie.Insert("banana");
        trie.Insert("word");
        trie.Insert("banner");
        trie.Insert("zebra");
        
        var outputs = trie.Traverse();
        _output.WriteLine(JsonConvert.SerializeObject(outputs));
        
        Assert.NotEmpty(outputs);
    }

    [Fact]
    public void GetWordsWithPrefix()
    {
        Trie<char> trie = new Trie<char>(new CaseInsensitiveCharComparer());
        trie.Insert("App");
        trie.Insert("application");
        trie.Insert("apple");
        trie.Insert("word");

        // TODO: Look up other implementations to see if this should be the case 
        var words = trie.GetWordsWithPrefix("\0");
        Assert.Empty(words);
        foreach (var word in words)
        {
            _output.WriteLine(JsonConvert.SerializeObject(word));
        }
    }

    [Fact]
    public void GetAllWords()
    {
        Trie<char> trie = new Trie<char>(new CaseInsensitiveCharComparer());
        trie.Insert("App");
        trie.Insert("application");
        trie.Insert("apple");
        trie.Insert("word");
        trie.Insert("abqwpek wogrnonfqodnfoeb mopehp ,pgn2 o9n213 h b ws cal i");
        trie.Insert("abqwpek wogrnOnfqodnfoeb MOPEHP ,pgn2 o9n213 h b ws caL I");
        // 5 words in totals 

        var words = trie.Traverse();
        var output = JsonConvert.SerializeObject(words.Select(val => string.Join("", val)));
        
        _output.WriteLine(output);
        Assert.NotEmpty(words);
    }
}
// using Microsoft;
