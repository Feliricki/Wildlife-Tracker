using PersonalSiteAPI.Services;

namespace PersonalSiteAPI.Tests;


public class AutoCompleteTests
{
    [Fact]
    public void InsertWord_IncrementsCount()
    {
        AutoCompleteService autoCompleteService = new AutoCompleteService();
        autoCompleteService.InsertWord("apple");
        autoCompleteService.InsertWord("banana");
        autoCompleteService.InsertWord("some word");

        Assert.Equal(3, autoCompleteService.Count());
    }

    [Fact]
    public void SearchWord_ReturnsTrueForInsertedWord()
    {
        AutoCompleteService autoCompleteService = new AutoCompleteService();
        autoCompleteService.InsertWord("apple");

        Assert.True(autoCompleteService.SearchWord("apple"));
    }

    [Fact]
    public void SearchWord_ReturnsFalseForNonexistentWord()
    {
        AutoCompleteService autoCompleteService = new AutoCompleteService();
        autoCompleteService.InsertWord("apple");

        Assert.False(autoCompleteService.SearchWord("orange"));
    }

    [Fact]
    public void StartsWith_ReturnsTrueForPrefix()
    {
        AutoCompleteService autoCompleteService = new AutoCompleteService();
        autoCompleteService.InsertWord("apple");

        Assert.True(autoCompleteService.StartsWith("app"));
    }

    [Fact]
    public void StartsWith_ReturnsFalseForNonexistentPrefix()
    {
        AutoCompleteService autoCompleteService = new AutoCompleteService();
        autoCompleteService.InsertWord("apple");

        Assert.False(autoCompleteService.StartsWith("ora"));
    }
}