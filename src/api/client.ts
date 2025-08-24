import axios, { AxiosInstance, AxiosError } from 'axios';
import { z } from 'zod';
import { ThreadsAPIError, PaginatedResponse } from './types';

export class ThreadsAPIClient {
  private client: AxiosInstance;
  private accessToken: string;
  private baseURL = 'https://graph.threads.net/v1.0';
  private requiredScopes = ['threads_basic', 'threads_content_publish', 'threads_manage_insights', 'threads_read_replies'];

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      config.params = {
        ...config.params,
        access_token: this.accessToken,
      };
      return config;
    });

    // Remove the response interceptor to handle errors in get method
    // this.client.interceptors.response.use(
    //   (response) => response,
    //   (error: AxiosError<ThreadsAPIError>) => {
    //     if (error.response?.data?.error) {
    //       const apiError = error.response.data.error;
    //       throw new Error(`Threads API Error: ${apiError.message} (Code: ${apiError.code})`);
    //     }
    //     throw error;
    //   }
    // );
  }

  async get<T>(endpoint: string, params?: Record<string, any>, retries = 3): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.get<T>(endpoint, { params });
        return response.data;
      } catch (error: any) {
        const apiError = error.response?.data?.error;
        const isTransientError = apiError?.is_transient === true;
        const isCode2Error = apiError?.code === 2;
        const isLastAttempt = attempt === retries;
        
        if ((isTransientError || isCode2Error) && !isLastAttempt) {
          console.error(`Attempt ${attempt} failed with error code ${apiError?.code}, retrying in ${attempt * 1000}ms...`);
          await this.sleep(attempt * 1000);
          continue;
        }
        
        // Use enhanced error handling
        throw this.handleAPIError(error);
      }
    }
    throw new Error('Max retries exceeded');
  }

  async post<T>(endpoint: string, data?: Record<string, any>): Promise<T> {
    try {
      const response = await this.client.post<T>(endpoint, data);
      return response.data;
    } catch (error: any) {
      throw this.handleAPIError(error);
    }
  }

  async delete<T>(endpoint: string, retries = 3): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.delete<T>(endpoint);
        return response.data;
      } catch (error: any) {
        const apiError = error.response?.data?.error;
        const isTransientError = apiError?.is_transient === true;
        const isCode2Error = apiError?.code === 2;
        const isLastAttempt = attempt === retries;
        
        if ((isTransientError || isCode2Error) && !isLastAttempt) {
          console.error(`Delete attempt ${attempt} failed with error code ${apiError?.code}, retrying in ${attempt * 1000}ms...`);
          await this.sleep(attempt * 1000);
          continue;
        }
        
        throw this.handleAPIError(error);
      }
    }
    throw new Error('Max retries exceeded');
  }

  async paginate<T>(
    endpoint: string,
    params?: Record<string, any>,
    maxPages = 10
  ): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | undefined = undefined;
    let pages = 0;

    do {
      const response: PaginatedResponse<T> = await this.get<PaginatedResponse<T>>(
        nextUrl || endpoint,
        nextUrl ? {} : params
      );
      
      results.push(...response.data);
      nextUrl = response.paging?.next;
      pages++;
    } while (nextUrl && pages < maxPages);

    return results;
  }

  updateAccessToken(token: string) {
    this.accessToken = token;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // NEW: Validate access token and scopes
  async validateToken(): Promise<{ valid: boolean; scopes?: string[]; error?: string }> {
    try {
      // Use the debug_token endpoint to check token validity and scopes
      const response = await this.client.get('/debug_token', {
        params: {
          input_token: this.accessToken,
          access_token: this.accessToken
        }
      });
      
      return {
        valid: true,
        scopes: response.data?.data?.scopes || [],
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      return {
        valid: false,
        error: `Token validation failed: ${errorMessage}`
      };
    }
  }

  // NEW: Check if required scopes are available
  async checkScopes(requiredScopes: string[] = this.requiredScopes): Promise<{ hasRequired: boolean; missing: string[] }> {
    const tokenInfo = await this.validateToken();
    
    if (!tokenInfo.valid || !tokenInfo.scopes) {
      return { hasRequired: false, missing: requiredScopes };
    }

    const missing = requiredScopes.filter(scope => !tokenInfo.scopes!.includes(scope));
    
    return {
      hasRequired: missing.length === 0,
      missing
    };
  }

  // NEW: Enhanced error handling with helpful messages
  private handleAPIError(error: any): Error {
    const apiError = error.response?.data?.error;
    
    if (!apiError) {
      return error;
    }

    const { code, message, error_subcode, fbtrace_id } = apiError;
    
    // Provide helpful error messages for common issues
    if (code === 190) {
      return new Error(`Authentication failed: ${message}. Please check your access token and ensure it has proper scopes: ${this.requiredScopes.join(', ')}`);
    }
    
    if (code === 200 && error_subcode === 1360028) {
      return new Error(`Business account required: ${message}. Convert your Instagram account to a business account and complete Meta Business verification.`);
    }
    
    if (code === 100) {
      return new Error(`Invalid parameter: ${message}. Check your request format and ensure media URLs are publicly accessible.`);
    }
    
    if (code === 10 && message.includes('scope')) {
      return new Error(`Permission denied: ${message}. Your access token is missing required scopes. Required: ${this.requiredScopes.join(', ')}`);
    }
    
    if (code === 4) {
      return new Error(`Rate limit exceeded: ${message}. Please wait before making more requests.`);
    }

    // Generic error with trace ID for debugging
    const traceInfo = fbtrace_id ? ` (Trace ID: ${fbtrace_id})` : '';
    return new Error(`Threads API Error (${code}): ${message}${traceInfo}`);
  }
}