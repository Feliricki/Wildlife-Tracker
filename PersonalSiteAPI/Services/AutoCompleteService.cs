using System.Collections.Concurrent;
using System.Collections.ObjectModel;
using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using PersonalSiteAPI.Models;


namespace PersonalSiteAPI.Services;

public class Node<T> where T : IEquatable<T>
{
    public T Value { get; set; }
    public int Count;
    public readonly ConcurrentDictionary<T, Node<T>> Children;
    public Node(T value=default!, IEqualityComparer<T>? equalityComparer=null)
    {
        Value = value;
        Children = new ConcurrentDictionary<T, Node<T>>(equalityComparer);
    }
    public int IncrementCount()
    {
        Interlocked.Increment(ref Count);
        return Count;
    }

    public int DecrementCount()
    {
        if (Count > 0)
        {
            Interlocked.Decrement(ref Count);
        }

        return Count;
    }
    
}
// Invariants to maintain
// 1) There is always at least one root node.
// 2) T type parameters is non-nullable
// 3) T type is an enumerable type
public class Trie<T> 
    where T : IEquatable<T>
{
    private readonly Node<T> _root;
    private readonly IEqualityComparer<T>? _equalityComparer;
    private readonly ConcurrentDictionary<T, Node<T>>  _firstLayer;

    // These are node with an 'count' s.t they signify the end of a word.
    private ConcurrentBag<Node<T>> _Collection;
    private ConcurrentBag<Node<T>> _RestrictedCollection;
    // private List<Expression<Func<T, bool>>> _Filters;
    
    // TODO: Store the equality comparer here and reuse it every time a new node is created 
    public long TotalCount;
    public Trie(IEqualityComparer<T>? equalityComparer=null)
    {
        _equalityComparer = equalityComparer ?? EqualityComparer<T>.Default;
        _root = new Node<T>(default(T)!, _equalityComparer);
        TotalCount = 1;

        _Collection = new ConcurrentBag<Node<T>>();
        _RestrictedCollection = new ConcurrentBag<Node<T>>();

        _firstLayer = new ConcurrentDictionary<T, Node<T>>(_equalityComparer)
        {
            [_root.Value] = _root
        };
    }

    private bool IsRestricted(Node<T> node)
    {
        return _RestrictedCollection.Contains(node);
    }

    public long Count()
    {
        return Interlocked.Read(ref TotalCount) - 1;
    }

    public void Insert(IEnumerable<T> word, bool restrictedWord=true)
    {
        var searchSpace = _root.Children;
        using var enumerator = word.GetEnumerator();
        Node<T>? latest = null;
        // int index = 0;
        // NOTE: The enumerator begins before the start of the list
        while (enumerator.MoveNext())
        {
            var current = enumerator.Current;
            if (!searchSpace.TryGetValue(current, out var result))
            {
                result = new Node<T>(current, _equalityComparer);
                if (!searchSpace.TryAdd(current, result))
                {
                    throw new SynchronizationLockException("Unable to insert node into trie.");
                }
                _Collection.Add(result);
                if (restrictedWord)
                {
                    _RestrictedCollection.Add(result);
                }
            }
            latest = result;
            searchSpace = result.Children;
        }
        
        if (latest is null)
        {
            throw new ArgumentException("Passed empty enumerable to trie.");
        }
        Console.WriteLine($"Total in collection: {_Collection.Count()} Total in restricted collection: {_RestrictedCollection.Count()}");
        latest.IncrementCount();
        TotalCount++;
    }
    // There must be at least one instance of the query in the trie
    public bool Search(IEnumerable<T> word, bool allowRestricted = false)
    {
        var searchSpace = _root.Children;
        using var enumerator = word.GetEnumerator();
        Node<T>? latest = null;
        
        while (enumerator.MoveNext())
        {
            var current = enumerator.Current;
            if (!searchSpace.TryGetValue(current, out var result))
            {
                return false;
            }

            latest = result;
            searchSpace = result.Children;
        }

        if (!allowRestricted && _RestrictedCollection.Contains(latest))
        {
            return false;
        }
        
        return latest is not null && latest.Count > 0;
    }
    // This method will return the node and string* that matches a certain prefix  
    // TODO:  Refactor a way to use the default values of T to return the entire collection of words in the trie.
    public Tuple<LinkedList<T>, Node<T>>? StartsWithGetNode(
        IEnumerable<T> prefix)
    {
        // var searchSpace = _firstLayer;
        var searchSpace = _root.Children;
        using var enumerator = prefix.GetEnumerator();

        LinkedList<T> retList = new();
        Node<T>? retVal = null;
        var length = 0;
        while (enumerator.MoveNext())
        {
            length++;
            var current = enumerator.Current; // Handle this case -> [ '\0' , ..]
            if (!searchSpace.TryGetValue(current, out var result))
            {
                return null;
            }
            
            retList.AddLast(result.Value);
            retVal = result;
            searchSpace = result.Children;
        }

        if (length == 0)
        {
            Console.WriteLine("Received empty prefix.");
            retList.AddLast(_root.Value);
            return Tuple.Create(retList, _root);
        }

        return retVal is null ? null : Tuple.Create(retList, retVal);
    }
    
    /*
     * TODO: Make test suite for this method and dependant methods
    *  Traverse and StartWithGetNode
    */ 
    public List<T[]> GetWordsWithPrefix(
    IEnumerable<T> prefix,
    long? maxCount = null,
    bool allowRestricted = false)
    {
        maxCount ??= TotalCount;
        if (maxCount <= 0)
        {
            return new List<T[]>();
        }
        // This method is null if accessing restricted content
        // or if the word does not exists
        var startTuple = StartsWithGetNode(prefix);
        if (startTuple is null)
        {
            return new List<T[]>();
        }
        (var currentWord, var startNode) = startTuple;
        return Traverse(startNode, currentWord, maxCount, allowRestricted);
    }
    
    // If there's a word with the following prefix
    public bool StartWith(IEnumerable<T> prefix)
    {
        // var searchSpace = _firstLayer;
        var searchSpace = _root.Children;
        using var enumerator = prefix.GetEnumerator();
        while (enumerator.MoveNext())
        {
            var current = enumerator.Current;
            if (!searchSpace.TryGetValue(current, out var result))
            {
                return false;
            }

            searchSpace = result.Children;
        }
        return true;
    }

    public List<T[]> Traverse(
        Node<T>? start=null,
        LinkedList<T>? curWord=null,
        long? wordsToReturn=null,
        bool allowRestricted = false)
    {
        if (wordsToReturn < 0)
        {
            throw new ArgumentException("Expected positive number.");
        }
    
        List<T[]> allWords = new();
        HashSet<Node<T>> explored = new();
        // This should be a parameter
        start ??= _root;
        curWord ??= new LinkedList<T>();
        wordsToReturn ??= TotalCount;
        // This is meant to pop the default value from the prefix
        if (start == _root && curWord.Count > 0)
        {
            curWord.RemoveFirst();
        }

        void Dfs(Node<T> root)
        {
            foreach (var child in root.Children.Values)
            {
                // TODO; This logic is untested.
                if (!explored.Contains(child) 
                    && allWords.Count < wordsToReturn 
                    && (allowRestricted || (!allowRestricted && !_RestrictedCollection.Contains(child))
                    ))
                {
                    curWord.AddLast(child.Value);
                    explored.Add(root);
                    Dfs(child);
                }
            }

            if (root.Count > 0)
            {
                allWords.Add(curWord.ToArray());
            }
            if (curWord.Count > 0)
            {
                curWord.RemoveLast();
            }
        }

        Dfs(start);
        return allWords;
    }
}

public class CaseInsensitiveCharComparer : IEqualityComparer<char>
{
    public bool Equals(char x, char y)
    {
        return char.ToLowerInvariant(x).Equals(char.ToLowerInvariant(y));
    }

    public int GetHashCode(char obj)
    {
        return char.ToLowerInvariant(obj).GetHashCode();
    }
}

public interface IAutoCompleteService
{
    long Count();
    // void InsertWord(string word);
    bool SearchWord(string word, bool allowRestricted = false);
    bool StartsWith(string prefix, bool allowRestricted = false);
    List<char[]> GetAllWordsWithPrefix(string prefix="", long? maxCount=null, bool allowRestricted = false);
}

// TODO: Keep track of metadata to keep track of what restriction are placed.
public class AutoCompleteService : IAutoCompleteService
{
    private readonly Trie<char> _trie;
    
    private readonly Expression<Func<Studies, bool>> _validLicenseExp = study => 
        study.LicenseType == "CC_0" || study.LicenseType == "CC_BY" || study.LicenseType == "CC_BY_NC";
    
    private readonly Expression<Func<Studies, bool>> _hasDownloadAccess = study => study.IHaveDownloadAccess;
    
    private IServiceScopeFactory _serviceScopeFactory;
    // Singleton services need a manually create scope.
    public AutoCompleteService(
        IServiceScopeFactory serviceScopeFactory)
    { 
        // type parameter denotes the key type 
        // Func<string, bool> validLicense = word => word 
        var comparer = new CaseInsensitiveCharComparer();
        _trie = new Trie<char>(comparer);
        
        _serviceScopeFactory = serviceScopeFactory;
        var scope = _serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetService<ApplicationDbContext>();
        
        var source = dbContext?.Studies
            .AsNoTracking()
            .Where(study => study.IHaveDownloadAccess);
        
        if (source is null)
        {
            Console.WriteLine("Database context is unavailable in AutoCompleteService initialization.");
            return;
        }
        // var watch = System.Diagnostics.Stopwatch.StartNew();
        var hasValidLicense = _validLicenseExp.Compile();
        var hasDownloadAccess = _hasDownloadAccess.Compile();
        foreach (var study in source)
        {
            if (hasValidLicense(study) && hasDownloadAccess(study))
            {
                _trie.Insert(study.Name, false);
            }
            else
            {
                _trie.Insert(study.Name, true);
            }
        }
    }

    public long Count()
    {
        return _trie.Count();
    }

    private void InsertWord(string word)
    {
        // _trie.Insert(word);
        throw new NotImplementedException("Insertion not supported");
    }

    public bool SearchWord(string word, bool allowRestricted = false)
    {
        return _trie.Search(word);
    }

    public bool StartsWith(string prefix, bool allowRestricted = false)
    {
        return _trie.StartWith(prefix);
    }

    public List<char[]> GetAllWordsWithPrefix(string prefix="", long? maxCount = null, bool allowRestricted = false)
    {
        return _trie.GetWordsWithPrefix(prefix, maxCount, allowRestricted);
    }

    public int RemoveWord(string word)
    {
        throw new NotImplementedException();
    }

}
