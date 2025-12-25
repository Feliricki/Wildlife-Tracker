
export interface Pages {
  pages: PageInfo[];
}

export interface PageInfo {
  id: bigint;
  key: string;
  title: string;
  excerpt: string;
  matched_title: string | null;
  description: string;
  thumbnail: Thumbnail;
}

export interface Thumbnail {
  mimetype: string;
  width: number;
  height: number;
  duration: string | null;
  url: string;
}


export type SearchResult = [string, string[], string[], string[]];
