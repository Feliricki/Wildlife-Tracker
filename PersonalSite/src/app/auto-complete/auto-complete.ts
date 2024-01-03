// String of length 1
type char = string;

class CaseInsensitiveMap<T, U> extends Map<T, U> {
  override set(key: T, value: U): this {
    if (typeof key === 'string') {
      key = this.normalizeAccents(key).toLocaleLowerCase() as T;
    }
    return super.set(key, value);
  }

  override get(key: T): U | undefined {
    if (typeof key === 'string') {
      key = this.normalizeAccents(key).toLocaleLowerCase() as T;
    }
    return super.get(key);
  }

  override has(key: T): boolean {
    if (typeof key === 'string') {
      // key = key.toLocaleLowerCase() as T;
      // key = this.normalizeAccents(key) as T;
      key = this.normalizeAccents(key).toLocaleLowerCase() as T;
    }
    return super.has(key);
  }

  normalizeAccents(word: string): string {
    return word.normalize("NFD").replace(/[\u0300-\u036f]/g, '');
  }
}

class TreeNode {
  private word: string;

  public count: number;
  public children: CaseInsensitiveMap<char, TreeNode>;
  constructor(private value: char, word?: string) {

    this.count = 0;
    this.children = new CaseInsensitiveMap<char, TreeNode>();
    this.word = word ?? "";

  }
  get Value(): char {
    return this.value;
  }
  get Count(): number {
    return this.count;
  }
  set Count(newCount: number) {
    this.count = newCount;
  }
  set Word(newWord: string) {
    this.word = newWord;
  }
  get Word() {
    return this.word;
  }
  incrementCount(): void {
    this.count++;
  }
}

class Trie {
  private readonly _rootNode: TreeNode;
  public totalCount: number;
  constructor() {
    this._rootNode = new TreeNode('\0');
    this.totalCount = 0;
  }

  Count(): number {
    return this.totalCount;
  }

  // Searches must be case insensitive
  Insert(word: string): void {
    let searchSpace = this._rootNode.children;
    let latest: TreeNode | undefined;

    for (let i = 0; i < word.length; i++) {

      const curChar: char = word[i];
      latest = searchSpace.get(curChar);

      if (latest === undefined) {
        latest = new TreeNode(curChar);
        searchSpace.set(curChar, latest);
      }
      searchSpace = latest.children;
    }
    if (!latest){
      return;
    }
    latest.incrementCount();
    latest.Word = word;
    this.totalCount++;
  }

  startWithGetNode(prefix: string): [char[], TreeNode] | null {
    let searchSpace = this._rootNode.children;
    if (prefix.length === 0) {
      return [[this._rootNode.Value], this._rootNode];
    }
    let retVal: TreeNode | null = null;
    const retList: char[] = [];
    for (let i = 0; i < prefix.length; i++) {

      const curChar: char = prefix[i];
      const result = searchSpace.get(curChar);

      if (result === undefined) {
        return null;
      }

      retList.push(prefix[i]);
      retVal = result;
      searchSpace = result.children;
    }

    return retVal === null ? null : [retList, retVal];
  }

  getWordsWithPrefix(prefix: string, maxCount: number = 10): string[] {
    if (maxCount <= 0) {
      return [];
    }

    const startTuple = this.startWithGetNode(prefix);
    if (startTuple == null) {
      return [];
    }
    const [currentWord, startNode] = startTuple;
    return this.traverse(startNode, currentWord, maxCount);
  }

  traverse(start: TreeNode, curWord?: char[], wordsToReturn?: number): string[] {
    if (wordsToReturn !== undefined && wordsToReturn < 0) {
      console.error("Invalid input in traverse method in Trie");
      return [];
    }

    const allWords: string[] = [];
    const explored = new Set<TreeNode>();

    start = start ?? this._rootNode;
    curWord = curWord ?? [];
    wordsToReturn = wordsToReturn ?? this.totalCount;
    if (start === this._rootNode) {
      curWord.pop();
    }

    const dfs = (root: TreeNode) => {

      for (const child of root.children.values()) {
        if (!explored.has(child) && allWords.length < wordsToReturn!) {
          explored.add(child);
          curWord!.push(child.Value);
          dfs(child);
        }
      }
      if (root.Count > 0) {
        allWords.push(root.Word);
        // allWords.push(curWord!.join(""));
      }

      if (curWord!.length > 0) {
        curWord?.pop();
      }
    }

    dfs(start);
    console.log(allWords);
    return allWords;
  }
}

export class AutoComplete {
  private trie: Trie;
  public words: string[];
  constructor(readonly collection: string[]) {
    this.trie = new Trie();
    this.words = [];
    for (const word of collection) {
      this.trie.Insert(word);
      this.words.push(word);
    }
  }

  getWordsWithPrefix(prefix: string, maxCount: number): string[] {
    return this.trie.getWordsWithPrefix(prefix, maxCount);
  }

  get Words(): string[] {
    return this.words;
  }
}
