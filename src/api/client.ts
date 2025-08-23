import axios, { AxiosInstance, AxiosError } from 'axios';
import { z } from 'zod';
import { ThreadsAPIError, PaginatedResponse } from './types';

export class ThreadsAPIClient {
  private client: AxiosInstance;
  private accessToken: string;
  private baseURL = 'https://graph.threads.net/v1.0';

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
        
        // Re-throw the original axios error so the calling code can handle it
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }

  async post<T>(endpoint: string, data?: Record<string, any>): Promise<T> {
    const response = await this.client.post<T>(endpoint, data);
    return response.data;
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
        
        throw error;
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
}