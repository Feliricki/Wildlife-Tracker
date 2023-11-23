import { StudyDTO } from "../studies/study";

class Node {

  count: number = 0;
  children: Map<string, Node> = new Map<string, Node>();
  constructor(public value: string) {
    return;
  }

  incrementCount() {
    this.count++;
  }
}

class Trie {

  root = new Node('\0');
  totalCount = 0;

  constructor(private collection: string[]) {
    this.collection.forEach(word => {
      this.insert(word);
    });
  }

  get TotalCount(): number {
    return this.totalCount;
  }

  insert(value: string): void {

    let searchSpace = this.root.children;
    let inserted: Node | undefined;

    for (let i = 0; i < value.length; i++) {

      const curChar = value[i];

      const nextNode = searchSpace.get(curChar);
      inserted = nextNode;
      if (nextNode !== undefined) {
        searchSpace = nextNode.children;
      } else {
        const newNode = new Node(curChar);
        inserted = newNode;
        searchSpace = newNode.children;
      }
    }

    if (inserted === undefined) {
      return;
    }
    inserted.incrementCount();
    this.totalCount += 1;
  }

  //NOTE: This function is called privately within this class only
  private startWithGetNode(prefix: string): [string[], Node] | null {
    if (prefix.length === 0) {
      return [[], this.root];
    }
    let searchSpace = this.root.children;

    const retList: string[] = [];
    let retVal: Node | undefined;

    for (let i = 0; i < prefix.length; i++) {
      const curChar = prefix[i];
      const foundNode = searchSpace.get(curChar);

      if (foundNode === undefined) {
        return null;
      }

      retList.push(foundNode.value);
      retVal = foundNode;
      searchSpace = foundNode.children;
    }
    if (retList.length === 0) {
      retList.push(this.root.value);
      return [retList, this.root];
    }
    return retVal === undefined ? null : [retList, retVal];
  }

  getWordsWithPrefix(prefix: string, maxCount: number | undefined): string[] {
    maxCount = maxCount === undefined ? this.totalCount : maxCount;
    if (maxCount <= 0) {
      return [];
    }

    const startTuple = this.startWithGetNode(prefix);
    if (startTuple === null) {
      return [];
    }
    const [curWord, startNode] = startTuple;
    return this.traverse(startNode, curWord, 10);
  }

  traverse(
    startNode: Node | undefined,
    curWord: string[] | undefined,
    wordsToReturn = this.totalCount): string[] {

    const allWords: string[] = [];
    const explored: Set<Node> = new Set<Node>();

    startNode = startNode ?? this.root;
    curWord = curWord ?? [];
    if (startNode === this.root && curWord.length > 0) {
      curWord.splice(0, 1);
    }

    const dfs = (root: Node) => {
      for (const child of root.children.values()) {

        if (!explored.has(child) && allWords.length < wordsToReturn) {

          curWord?.push(child.value);
          explored.add(root);
          dfs(child);
        }
      }

      if (root.count > 0) {
        allWords.push(curWord!.join(""));
      }
      if (curWord!.length > 0) {
        curWord!.pop();
      }

    }
    dfs(startNode);
    return allWords;
  }
}

export class AutoComplete {
  trie: Trie | undefined;
  constructor(private collection: StudyDTO[]) {
    this.trie = new Trie(this.collection.map(study => study.name));
  }

  get TotalCount(): number {
    return this.trie?.totalCount ?? 0;
  }

  insert(value: string): void {
    this.trie?.insert(value);
  }

  getWordsWithPrefix(prefix: string, maxCount: number): string[] {
    return this.trie?.getWordsWithPrefix(prefix, maxCount) ?? [];
  }
}
