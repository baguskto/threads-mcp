export interface ThreadsUser {
  id: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
}

export interface ThreadsMedia {
  id: string;
  media_type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  text?: string;
  timestamp: string;
  permalink?: string;
  username?: string;
  is_quote_post?: boolean;
  children?: ThreadsMedia[];
  owner?: ThreadsUser;
}

export interface ThreadsReply {
  id: string;
  text?: string;
  username?: string;
  timestamp: string;
  media_type?: string;
  media_url?: string;
  hide_status?: 'NOT_HUSHED' | 'UNHUSHED' | 'HIDDEN' | 'COVERED' | 'BLOCKED';
}

export interface ThreadsInsight {
  name: string;
  period: string;
  values: Array<{
    value: number;
    end_time?: string;
  }>;
  title?: string;
  description?: string;
  id: string;
}

export interface ThreadsMetric {
  metric: string;
  value: number;
  timestamp?: string;
}

export interface ThreadsPublishingLimit {
  quota_usage: number;
  config: {
    quota_duration: number;
    quota_total: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
}

export interface ThreadsAPIError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}