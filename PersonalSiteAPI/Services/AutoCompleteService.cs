using System.Collections;
using System.Collections.Concurrent;
using System.Linq.Expressions;
using System.Text;
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
public class Trie<T> where T : IEquatable<T>
{
    private readonly Node<T> _root;
    private readonly IEqualityComparer<T>? _equalityComparer;
    private readonly ConcurrentDictionary<T, Node<T>>  _firstLayer;
    
    // TODO: Store the equality comparer here and reuse it every time a new node is created 
    public long TotalCount;
    public Trie(IEqualityComparer<T>? equalityComparer=null)
    {
        _equalityComparer = equalityComparer ?? EqualityComparer<T>.Default;
        _root = new Node<T>(default(T)!, _equalityComparer);
        TotalCount = 1;
        
        _firstLayer = new ConcurrentDictionary<T, Node<T>>()
        {
            [_root.Value] = _root
        };
    }

    public long Count()
    {
        return Interlocked.Read(ref TotalCount) - 1;
    }

    public void Insert(IEnumerable<T> word)
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
            }
            // index++;
            latest = result;
            searchSpace = result.Children;
        }
        
        if (latest is null)
        {
            throw new ArgumentException("Passed empty enumerable to trie.");
        }
        
        latest.IncrementCount();
        TotalCount++;
        Console.WriteLine($"latest count is now {latest.Count}");
    }
    // There must be at least one instance of the query in the trie
    public bool Search(IEnumerable<T> word)
    {
        // var searchSpace = _firstLayer;
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
        
        return latest is not null && latest.Count > 0;
    }
    // This method will return the node and string* that matches a certain prefix  
    // TODO:  Refactor a way to use the default values of T to return the entire collection of words in the trie.
    public Tuple<LinkedList<T>, Node<T>>? StartsWithGetNode(IEnumerable<T> prefix)
    {
        // var searchSpace = _firstLayer;
        var searchSpace = _root.Children;
        using var enumerator = prefix.GetEnumerator();

        LinkedList<T> retList = new();
        Node<T>? retVal = null;
        // int index = 0;
        while (enumerator.MoveNext())
        {
            var current = enumerator.Current; // Handle this case -> [ '\0' , ..]
            if (!searchSpace.TryGetValue(current, out var result))
            {
                return null;
            }
            
            retList.AddLast(result.Value);
            retVal = result;
            searchSpace = result.Children;
            // index++;
        }

        if (retVal is null)
        {
            return null;
        }
        
        return Tuple.Create(retList, retVal);
    }
    
    /*
     * TODO: Make test suite for this method and dependant methods
    *  Traverse and StartWithGetNode
    */ 
    public List<T[]> GetWordsWithPrefix(
    IEnumerable<T> prefix,
    long? maxCount = null)
    {
        maxCount ??= TotalCount;
        if (maxCount <= 0)
        {
            return new List<T[]>();
        }

        var startTuple = StartsWithGetNode(prefix);
        if (startTuple is null)
        {
            return new List<T[]>();
        }
        (var currentWord, var startNode) = startTuple;
        return Traverse(startNode, currentWord);
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
        int? wordsToReturn=null)
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
        // if (curWord.Count == 0)
        // {
        //     curWord.AddLast(_root.Value);
        // }

        void Dfs(Node<T> root)
        {
            // The root is always excluded from the final result.
            // if (!root.Value.Equals(_root.Value))
            // {
            //     curWord.AddLast(root.Value);
            //     explored.Add(root);   
            // }

            foreach (var child in root.Children.Values)
            {
                if (!explored.Contains(child) && (wordsToReturn == null || allWords.Count < wordsToReturn))
                {
                    curWord.AddLast(root.Value);
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
            // curWord.RemoveLast();
        }

        Dfs(start);
        return allWords;
    }
    
    
    // Used to print the graph
    public void BfsTraversal()
    {
        Node<T> rootNode = _root;
        HashSet<Node<T>> explored = new();
        Queue<Node<T>> queue = new();
        
        queue.Enqueue(_root);
        explored.Add(rootNode);
        Console.WriteLine($"Level 0: Node = {rootNode.Value}");
        var level = 0;
        while (queue.Count > 0)
        {
            var levelLength = queue.Count;
            for (var i = 0; i < levelLength; i++)
            {
                var cur = queue.Dequeue();
                if (!explored.Contains(cur))
                {
                    Console.WriteLine($"Level {level+1}: Node = {cur.Value}");
                    queue.Enqueue(cur);
                    explored.Add(cur);
                }
            }
            level++;
        }
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
    void InsertWord(string word);
    bool SearchWord(string word);
    bool StartsWith(string prefix);
    List<char[]> GetAllWordsWithPrefix(string prefix, long? maxCount=null);
}

// To be used as a singleton or scoped service.
// Add a special filter for unauthorized users
public class AutoCompleteService : IAutoCompleteService
{
    private readonly Trie<char> _trie;
    
    private readonly Expression<Func<Studies, bool>> _validLicenseExp = study => study.LicenseType == "CC_0" || study.LicenseType == "CC_BY" || study.LicenseType == "CC_BY_NC";

    private IServiceScopeFactory _serviceScopeFactory;
    // Singleton services need a manually create scope.
    public AutoCompleteService(
        IServiceScopeFactory serviceScopeFactory)
    { 
        // type parameter denotes the key type 
        var comparer = new CaseInsensitiveCharComparer();
        _trie = new Trie<char>(comparer);
        
        _serviceScopeFactory = serviceScopeFactory;
        var scope = _serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetService<ApplicationDbContext>();
        
        var source = dbContext.Studies
            .AsNoTracking()
            .Where(study => study.IHaveDownloadAccess);

        var watch = System.Diagnostics.Stopwatch.StartNew();
        foreach (var study in source)
        {
            _trie.Insert(study.Name);
        }
        watch.Stop();
        var elapsed = watch.ElapsedMilliseconds;
        Console.WriteLine($"Initialization of trie took {elapsed} milliseconds");
    }

    public long Count()
    {
        return _trie.Count();
    }

    public void InsertWord(string word)
    {
        _trie.Insert(word);
    }

    public bool SearchWord(string word)
    {
        return _trie.Search(word);
    }

    public bool StartsWith(string prefix)
    {
        return _trie.StartWith(prefix);
    }

    public List<char[]> GetAllWordsWithPrefix(string prefix, long? maxCount = null)
    {
        return _trie.GetWordsWithPrefix(prefix, maxCount);
    }

    public int RemoveWord(string word)
    {
        throw new NotImplementedException();
    }

}
