import axios from 'axios';

export interface UsernameResolutionResult {
  success: boolean;
  userId?: string;
  username?: string;
  name?: string;
  method: string;
  error?: string;
  note: string;
  suggestions?: string[];
}

export class UsernameResolver {
  private baseURL = 'https://www.threads.net';
  
  /**
   * Attempt to resolve username to user ID using multiple methods
   */
  async resolveUsername(username: string): Promise<UsernameResolutionResult> {
    // Clean username (remove @ if present)
    const cleanUsername = username.replace(/^@/, '');
    
    // Method 1: Try Threads web profile page
    try {
      const profileResult = await this.tryWebProfileLookup(cleanUsername);
      if (profileResult.success) {
        return profileResult;
      }
    } catch (error) {
      console.error('Web profile lookup failed:', error);
    }

    // Method 2: Try common patterns
    try {
      const patternResult = await this.tryCommonPatterns(cleanUsername);
      if (patternResult.success) {
        return patternResult;
      }
    } catch (error) {
      console.error('Pattern matching failed:', error);
    }

    // All methods failed
    return {
      success: false,
      username: cleanUsername,
      method: 'all_methods_failed',
      error: 'Unable to resolve username to user ID',
      note: 'Threads API and fallback methods could not resolve this username',
      suggestions: [
        'Verify the username is correct and exists on Threads',
        'Try getting the numerical user ID directly from the user',
        'Check if the profile is public',
        'User might need to authorize your app first'
      ]
    };
  }

  /**
   * Try to extract user ID from Threads web profile page
   */
  private async tryWebProfileLookup(username: string): Promise<UsernameResolutionResult> {
    try {
      const profileUrl = `${this.baseURL}/@${username}`;
      
      const response = await axios.get(profileUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
        },
        timeout: 10000,
        validateStatus: (status) => status === 200,
      });

      // Look for user ID patterns in the HTML
      const html = response.data;
      
      // Pattern 1: Look for "user_id" in JSON-LD or meta tags
      const userIdPatterns = [
        /"user_id":"(\d+)"/,
        /"userId":"(\d+)"/,
        /user_id["\s]*:["\s]*(\d+)/,
        /"ig_user_id":"(\d+)"/,
        /data-user-id="(\d+)"/,
      ];

      for (const pattern of userIdPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          return {
            success: true,
            userId: match[1],
            username: username,
            method: 'web_profile_scraping',
            note: `Successfully extracted user ID from Threads web profile`
          };
        }
      }

      // Pattern 2: Look for profile data in script tags
      const scriptMatches = html.match(/<script[^>]*>(.*?)<\/script>/gs);
      if (scriptMatches) {
        for (const script of scriptMatches) {
          const idMatch = script.match(/["'](\d{15,20})["']/); // Threads IDs are typically 15-20 digits
          if (idMatch && idMatch[1]) {
            // Validate it looks like a user ID (not timestamp, etc.)
            const possibleId = idMatch[1];
            if (possibleId.length >= 15 && possibleId.length <= 20) {
              return {
                success: true,
                userId: possibleId,
                username: username,
                method: 'script_extraction',
                note: `Extracted potential user ID from profile page scripts`
              };
            }
          }
        }
      }

      return {
        success: false,
        username: username,
        method: 'web_profile_scraping',
        error: 'User ID not found in profile page',
        note: 'Profile page loaded but could not extract user ID'
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return {
            success: false,
            username: username,
            method: 'web_profile_scraping',
            error: 'Profile not found',
            note: 'Username does not exist or profile is not public'
          };
        } else if (error.response?.status === 429) {
          return {
            success: false,
            username: username,
            method: 'web_profile_scraping',
            error: 'Rate limited',
            note: 'Too many requests to Threads. Try again later.'
          };
        }
      }

      return {
        success: false,
        username: username,
        method: 'web_profile_scraping',
        error: error instanceof Error ? error.message : 'Unknown error',
        note: 'Failed to fetch or parse profile page'
      };
    }
  }

  /**
   * Try common ID patterns based on username
   */
  private async tryCommonPatterns(username: string): Promise<UsernameResolutionResult> {
    // This is a fallback method that could try predictable patterns
    // However, Threads user IDs are not predictable from usernames
    
    return {
      success: false,
      username: username,
      method: 'pattern_matching',
      error: 'No predictable patterns found',
      note: 'Threads user IDs cannot be predicted from usernames'
    };
  }
}

export const usernameResolver = new UsernameResolver();