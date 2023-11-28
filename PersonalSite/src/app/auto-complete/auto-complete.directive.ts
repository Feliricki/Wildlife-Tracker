import { Directive, ElementRef, Input } from '@angular/core';
import { StudyDTO } from '../studies/study';
// import { StudyDTO } from '../studies/study';

@Directive({
  selector: '[appAutoComplete]',
  standalone: true,
  host: {
    '[example]': 'testValue',
  }
})
export class AutoCompleteDirective {
  targetEl?: HTMLElement;
  autoComplete?: AutoComplete;
  testValue: string = "test Value";

  constructor(private element: ElementRef) {
    console.log("constructor in autoCompleteDirective");
    this.targetEl = this.element.nativeElement as HTMLElement;
    if (this.targetEl.className === "auto-complete"){
      console.log("directive test");
      return;
    }
  }

  @Input()
  set appAutoComplete(words: Map<bigint, StudyDTO> | undefined){
    console.log(words);
    if (this.autoComplete !== undefined || words === undefined){
      return;
    }
    const studyNames: string[] = Array.from(words.values()).map(value => value.name);
    this.autoComplete = new AutoComplete(studyNames);
  }
}

// String of length 1
type char = string;

class Node {
  public count: number;
  public children: Map<char, Node>;
  constructor(private value: char) {
    this.count = 0;
    this.children = new Map<char, Node>();
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

  Insert(word: string): void {
    let searchSpace = this._rootNode.children;
    let latest: Node | undefined;

    for (let i = 0; i < word.length; i++) {

      const curChar: char = word[i];
      latest = searchSpace.get(curChar);
      if (latest === undefined){
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
    if (prefix.length === 0){
      return [[this._rootNode.Value], this._rootNode];
    }
    let retVal: Node | null = null;
    const retList: char[] = [];
    for (let i = 0; i < prefix.length; i++){
      const curChar: char = prefix[i];
      const result = searchSpace.get(curChar);
      if (result === undefined){
        return null;
      }
      retList.push(curChar);
      retVal = result;
      searchSpace = result.children;
    }

    return retVal === null ? null : [retList, retVal];
  }

  getWordsWithPrefix(prefix: string, maxCount: number = 10): string[] {
    if (maxCount <= 0){
      return [];
    }

    const startTuple = this.startWithGetNode(prefix);
    if (startTuple == null){
      return [];
    }
    const [currentWord, startNode] = startTuple;
    return this.traverse(startNode, currentWord, maxCount);
  }

  traverse(start: Node, curWord?: char[], wordsToReturn?: number): string[] {
    if (wordsToReturn !== undefined && wordsToReturn < 0){
      console.error("Invalid input in traverse method in Trie");
      return [];
    }

    const allWords: string[] = [];
    const explored = new Set<Node>();

    start = start ?? this._rootNode;
    curWord = curWord ?? [];
    wordsToReturn = wordsToReturn ?? this.totalCount;

    const dfs = (root: Node) => {

      for (const child of root.children.values()){
        if (!explored.has(child) && allWords.length < wordsToReturn!){
          curWord!.push(child.Value);
        }
      }
      if (root.Count > 0){
        allWords.push(curWord!.join(""));
      }

      if (curWord!.length > 0){
        curWord!.pop();
      }
    }

    dfs(start);
    return allWords;
  }
}

class AutoComplete {
  private trie: Trie;
  public words: string[];
  constructor(readonly collection: string[]){
    console.log("initializing collection in autocomplete class");
    this.trie = new Trie();
    this.words = [];
    for (const word of collection){
      this.trie.Insert(word);
      this.words.push(word);
    }
  }

  getWordsWithPrefix(prefix: string, maxCount: number){
    return this.trie.getWordsWithPrefix(prefix, maxCount);
  }

  get Words(): string[] {
    return this.words;
  }
}
