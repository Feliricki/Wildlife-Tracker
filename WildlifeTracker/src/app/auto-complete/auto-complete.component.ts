import { Component, Input, OnChanges, SimpleChanges, WritableSignal, signal } from '@angular/core';
import { MatOptionModule } from '@angular/material/core';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-autocomplete',
  standalone: true,
  template: `
  @for (option of currentOptions(); track option){
    <mat-option>{{ option }}</mat-option>
  }`,
  imports: [MatOptionModule]
})
export class AutoCompleteComponent implements OnChanges {
  autoComplete?: AutoComplete;
  @Input() allOptions: string[] = [];
  @Input() currentPrefix: string = "";
  @Input() filterChange$: Observable<string> = of("");
  // currentOptions: string[] = [];
  currentOptions: WritableSignal<string[]> = signal([]);

  constructor() {
  }

  // TODO: Create a method to react to filterchange events
  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {

      const currentValue = changes[propertyName].currentValue;
      if (currentValue === undefined) {
        continue;
      }
      switch (propertyName) {
        case "allOptions":
          console.log('Recieved currentOptions in AutoCompleteComponent')
          this.allOptions = currentValue as string[];
          this.initializeTrie(this.allOptions);
          console.log(this.autoComplete);
          break;

        case "currentPrefix":
          console.log(`Updating prefix with: ${this.currentPrefix}`);
          this.currentPrefix = currentValue as string;
          this.wordsWithPrefix(5);
          break;

        default:
          break;
      }
    }
  }

  wordsWithPrefix(maxCount: number = 5): void {
    console.log("Calling wordsWithPrefix");
    const words = this.autoComplete?.getWordsWithPrefix(this.currentPrefix, maxCount) ?? [];
    this.currentOptions.set(words);
  }
  initializeTrie(words: string[]): void {
    this.autoComplete = new AutoComplete(words);
    // this.wordsWithPrefix();
  }
}


// String of length 1
type char = string;

class CaseInsensitiveMap<T, U> extends Map<T, U> {
  override set(key: T, value: U): this {
    if (typeof key === 'string') {
      key = key.toLowerCase() as T;
    }
    return super.set(key, value);
  }

  override get(key: T): U | undefined {
    if (typeof key === 'string') {
      key = key.toLowerCase() as T;
    }
    return super.get(key);
  }

  override has(key: T): boolean {
    if (typeof key === 'string') {
      key = key.toLowerCase() as T;
    }
    return super.has(key);
  }
}

class Node {
  public count: number;
  public children: CaseInsensitiveMap<char, Node>;
  constructor(private value: char) {
    this.count = 0;
    this.children = new CaseInsensitiveMap<char, Node>();
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
  incrementCount(): void {
    this.count++;
  }
}

class Trie {
  private readonly _rootNode: Node;
  public totalCount: number;
  constructor() {
    this._rootNode = new Node('\0');
    this.totalCount = 0;
  }

  Count(): number {
    return this.totalCount;
  }

  // Searches must be case insensitive
  Insert(word: string): void {
    let searchSpace = this._rootNode.children;
    let latest: Node | undefined;

    for (let i = 0; i < word.length; i++) {

      const curChar: char = word[i];
      latest = searchSpace.get(curChar);

      if (latest === undefined) {
        latest = new Node(curChar);
        searchSpace.set(curChar, latest);
      }
      searchSpace = latest.children;
    }
    latest?.incrementCount();
    this.totalCount++;
  }

  startWithGetNode(prefix: string): [char[], Node] | null {
    let searchSpace = this._rootNode.children;
    if (prefix.length === 0) {
      return [[this._rootNode.Value], this._rootNode];
    }
    let retVal: Node | null = null;
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

  traverse(start: Node, curWord?: char[], wordsToReturn?: number): string[] {
    if (wordsToReturn !== undefined && wordsToReturn < 0) {
      console.error("Invalid input in traverse method in Trie");
      return [];
    }

    const allWords: string[] = [];
    const explored = new Set<Node>();

    start = start ?? this._rootNode;
    curWord = curWord ?? [];
    wordsToReturn = wordsToReturn ?? this.totalCount;
    if (start === this._rootNode){
      curWord.pop();
    }

    const dfs = (root: Node) => {

      for (const child of root.children.values()) {
        if (!explored.has(child) && allWords.length < wordsToReturn!) {
          explored.add(child);
          curWord!.push(child.Value);
          dfs(child);
        }
      }
      if (root.Count > 0) {
        allWords.push(curWord!.join(""));
      }

      if (curWord!.length > 0) {
        curWord!.pop();
      }
    }

    dfs(start);
    console.log(allWords);
    return allWords;
  }
}

class AutoComplete {
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
