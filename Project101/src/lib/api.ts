/* ---------------------------------------------------------------------------
   Network client layer for the FastAPI analysis engine.

   One base-URL primitive (VITE_API_BASE_URL, defaulting to the local loopback
   interface the backend binds to) and one typed function per endpoint. All
   responses are the backend's exact Pydantic wire schemas — no reshaping here.
--------------------------------------------------------------------------- */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

/* --- Wire schemas (mirror backend/app/schemas) -------------------------------- */

export interface TopologyNode {
  id: string;
  cyclomaticComplexity: number;
  commitFrequencyCount: number;
  fileSizeLines: number;
}

export interface TopologyLink {
  source: string;
  target: string;
  dependencyType: string;
}

export interface TopologyResponse {
  nodes: TopologyNode[];
  links: TopologyLink[];
}

export interface FileAnalytics {
  commitFrequencyPerMonth: number;
  averageCommitSizeLines: number;
}

export interface TimelineEntry {
  commitHash: string;
  dateString: string; // YYYY-MM-DD
  author: string;
  summary: string;
}

export interface FileHistoryResponse {
  filePath: string;
  rawLegacyString: string;
  modernizedString: string;
  analytics: FileAnalytics;
  refactorTimeline: TimelineEntry[];
}

export interface BlameLineEntry {
  lineIndex: number;
  authorName: string;
  commitHash: string;
  commitMessage: string;
  sourceLineContent: string;
}

export interface ContextualBlameResponse {
  replyText: string;
  parsedBlameUsed: BlameLineEntry[];
}

export interface HealthResponse {
  status: string;
  repository: string;
  repositoryName: string;
  branch: string;
  llmEnabled: boolean;
}

/* --- Client ---------------------------------------------------------------------- */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiError(
      `Analysis engine unreachable at ${API_BASE_URL} — is the FastAPI server running?`,
    );
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* non-JSON error body — keep statusText */
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export const fetchHealth = (): Promise<HealthResponse> => request("/api/v1/health");

export const fetchTopology = (): Promise<TopologyResponse> =>
  request("/api/v1/repository/topology");

export const fetchFileHistory = (path: string): Promise<FileHistoryResponse> =>
  request(`/api/v1/file/history?path=${encodeURIComponent(path)}`);

export const postContextualBlame = (
  targetFilePath: string,
  userInquiry: string,
): Promise<ContextualBlameResponse> =>
  request("/api/v1/chat/contextual-blame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetFilePath, userInquiry }),
  });
