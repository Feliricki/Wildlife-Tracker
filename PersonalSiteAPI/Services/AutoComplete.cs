using System.Diagnostics.Eventing.Reader;
using System.Globalization;

namespace PersonalSiteAPI.Services;

public class Node<T> where T : IEquatable<T>
{
    public T Value { get; set; }
    public int Count { get; set; }
    public Dictionary<T, Node<T>> Children;

    public Node(T value=default!, EqualityComparer<T>? equalityComparer=null)
    {
        Value = value;
        Children = new Dictionary<T, Node<T>>();
        if (equalityComparer is not null)
        {
            Children = new Dictionary<T, Node<T>>(equalityComparer);
        }
        
    }
    public int IncrementCount()
    {
        Count++;
        return Count;
    }

    public int DecrementCount()
    {
        if (Count > 0) Count--;
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
    
    public int TotalCount;
    public Trie(IEqualityComparer<T>? equalityComparer=null)
    {
        _root = new Node<T>();
        TotalCount = 1;
        _root.Children = new Dictionary<T, Node<T>>();
        if (equalityComparer is not null)
        {
            _root.Children = new Dictionary<T, Node<T>>(equalityComparer);
        }
    }

    public void Insert(IEnumerable<T> word)
    {
        var searchSpace = _root.Children;
        using var enumerator = word.GetEnumerator();
        Node<T>? latest = null;
        // NOTE: The enumerator begins before the start of the list
        while (enumerator.MoveNext())
        {
            var current = enumerator.Current;
            if (!searchSpace.TryGetValue(current, out var result))
            {
                result = new Node<T>(current);
                searchSpace.Add(current, result);
            }
            latest = result;
            searchSpace = result.Children;
        }
        
        if (latest is not null)
        {
            latest.IncrementCount();
            TotalCount++;
            Console.WriteLine($"latest count is now {latest.Count}");
        }
    }
    // There must be at least one instance of the query in the trie
    public bool Search(IEnumerable<T> word)
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
        
        return latest is not null && latest.Count > 0;
    }
    // If there's a word with the following prefix
    public bool StartWith(IEnumerable<T> prefix)
    {
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
        return char.ToUpperInvariant(obj).GetHashCode();
    }
}

// To be used as a singleton or scoped service.
public class AutoComplete
{
    private readonly Trie<char> _trie;

    public AutoComplete()
    { 
        // type parameter denotes the key type 
        var comparer = new CaseInsensitiveCharComparer();
        _trie = new Trie<char>(comparer);
    }

    public int Count()
    {
        return _trie.TotalCount;
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

    public int RemoveWord(string word)
    {
        throw new NotImplementedException();
    }

}
