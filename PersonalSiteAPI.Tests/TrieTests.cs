// using Xunit;
using PersonalSiteAPI.Services;
// using Microsoft;

namespace PersonalSiteAPI.Tests;

public class TrieTests
{
    [Fact]
    public void TestInsert()
    {
        Trie<char> trie = new Trie<char>();
        string testWord = "Test";
        
        trie.Insert(testWord);
        trie.BfsTraversal();
        // Console.WriteLine(trie.BfsTraversal());
        
        Assert.True(trie.Search(testWord));
        Assert.True(trie.StartWith("T"));
        Assert.False(trie.StartWith("A"));
        // ITestC
        Console.WriteLine(trie.TotalCount);
    }
}