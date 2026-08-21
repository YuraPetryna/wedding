export type ItemStatus = "queued" | "uploading" | "done" | "error";

export type QueueItem = {
  id: string;
  file: File;
  /** object URL для локального прев'ю; звільняється при видаленні */
  previewUrl?: string;
  status: ItemStatus;
  /** 0..1 */
  progress: number;
  error?: string;
  driveName?: string;
};

export type SessionResponse = {
  sessions: { name: string; driveName: string; uploadUrl: string }[];
};
