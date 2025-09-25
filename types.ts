
export interface EpubData {
  title: string;
  coverUrl: string | null;
  chapters: string[];
  filename: string;
}

export interface PlaybackProgress {
  currentChapterIndex: number;
  currentChunkIndex: number;
}
