import { BaseIntegration } from '../base/BaseIntegration';
import { 
  IntegrationCapabilities, 
  ImportResult, 
  ExportOptions, 
  YouTubeTranscript,
  BaseIntegration as IBaseIntegration
} from '../types';

// Types will be imported from the main app
type Item = any;
type ItemType = 'todo' | 'note' | 'event' | 'goal' | 'routine';

export class YouTubeIntegration extends BaseIntegration {
  private readonly youtubeApiUrl = 'https://www.googleapis.com/youtube/v3';
  // Use environment variable for API key (secure approach)
  private readonly embeddedApiKey = process.env.REACT_APP_YOUTUBE_API_KEY || '';

  constructor(config: IBaseIntegration) {
    super(config);
    // Use embedded API key from environment variable
    this.accessToken = this.embeddedApiKey;
  }

  getCapabilities(): IntegrationCapabilities {
    return {
      canImport: true,
      canExport: false,
      canSync: false,
      supportsRealtime: false,
      supportedItemTypes: ['notes'],
      maxBatchSize: 50,
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerHour: 10000,
        requestsPerDay: 1000000
      }
    };
  }

  async authenticate(): Promise<void> {
    // Check if API key is configured
    if (!this.accessToken || this.accessToken === '') {
      throw this.createError('NO_API_KEY', 'YouTube API key not configured. Please set REACT_APP_YOUTUBE_API_KEY in your .env file.');
    }

    // Using embedded API key, so authentication is automatic
    const isValid = await this.testConnection();
    if (!isValid) {
      throw this.createError('INVALID_API_KEY', 'YouTube API key is not working. Please check your API key configuration.');
    }

    this.setStatus('connected');
  }

  async refreshAccessToken(): Promise<void> {
    // YouTube API keys don't expire, just test validity
    const isValid = await this.testConnection();
    if (!isValid) {
      this.setStatus('error');
      throw this.createError('TOKEN_INVALID', 'YouTube API key is no longer valid');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.accessToken) {
        console.error('YouTube API key not configured');
        return false;
      }
      
      const url = `${this.youtubeApiUrl}/search?part=snippet&maxResults=1&key=${this.accessToken}`;
      
      // Use direct fetch to avoid any base class issues
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('YouTube API error:', response.status, errorText);
        return false;
      }
      
      const data = await response.json();
      return data?.kind === 'youtube#searchListResponse';
    } catch (error) {
      console.error('YouTube connection test failed:', error);
      return false;
    }
  }

  async importData(categoryId?: string): Promise<ImportResult> {
    // YouTube integration doesn't import in bulk, it's used for individual video transcripts
    return {
      provider: 'youtube',
      totalItems: 0,
      importedItems: 0,
      failedItems: 0,
      errors: ['YouTube integration is used for individual video transcript imports'],
      summary: {
        notes: 0
      }
    };
  }

  async exportData(options: ExportOptions): Promise<void> {
    throw new Error('Export to YouTube not supported');
  }

  // YouTube-specific methods
  private async getVideoTranscript(videoId: string): Promise<Array<{ text: string; start: number; duration: number }> | null> {
    console.log(`🔍 Attempting to get transcript for video: ${videoId}`);
    
    try {
      // Method 1: Try to get transcript through YouTube's internal API
      const transcript = await this.getTranscriptFromInternalAPI(videoId);
      if (transcript && transcript.length > 0) {
        console.log(`✅ Successfully extracted transcript using internal API for video: ${videoId}`);
        return transcript;
      }
    } catch (error) {
      console.warn('Internal API failed:', error);
    }

    try {
      // Method 2: Try to extract transcript from video page HTML
      const transcript = await this.getTranscriptFromVideoPage(videoId);
      if (transcript && transcript.length > 0) {
        console.log(`✅ Successfully extracted transcript from video page for video: ${videoId}`);
        return transcript;
      }
    } catch (error) {
      console.warn('Video page extraction failed:', error);
    }

    console.log(`❌ No transcript available for video: ${videoId}`);
    return null;
  }

  private async getTranscriptFromInternalAPI(videoId: string): Promise<Array<{ text: string; start: number; duration: number }>> {
    // First, get the video page to extract necessary parameters
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    try {
      // Use a CORS proxy to fetch the video page
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(videoPageUrl)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video page: ${response.status}`);
      }
      
      const data = await response.json();
      const html = data.contents;
      
      // Extract the necessary parameters from the page
      const playerResponseMatch = html.match(/"playerResponse":"([^"]+)"/);
      if (!playerResponseMatch) {
        throw new Error('Could not find playerResponse in video page');
      }
      
      const playerResponseStr = playerResponseMatch[1].replace(/\\"/g, '"').replace(/\\u0026/g, '&');
      const playerResponse = JSON.parse(playerResponseStr);
      
      // Look for captions in the player response
      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captions || captions.length === 0) {
        throw new Error('No captions found in player response');
      }
      
      // Find English captions (prefer manual over auto-generated)
      let captionTrack = captions.find((track: any) => 
        track.languageCode === 'en' && track.kind !== 'asr'
      );
      
      if (!captionTrack) {
        // Fallback to auto-generated English captions
        captionTrack = captions.find((track: any) => 
          track.languageCode === 'en'
        );
      }
      
      if (!captionTrack) {
        // Fallback to any available captions
        captionTrack = captions[0];
      }
      
      // Fetch the transcript from the caption URL
      const transcriptUrl = captionTrack.baseUrl;
      const transcriptProxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(transcriptUrl)}`;
      
      const transcriptResponse = await fetch(transcriptProxyUrl);
      if (!transcriptResponse.ok) {
        throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`);
      }
      
      const transcriptData = await transcriptResponse.json();
      const transcriptXml = transcriptData.contents;
      
      // Parse the XML transcript
      return this.parseTranscriptXml(transcriptXml);
      
    } catch (error) {
      throw new Error(`Internal API extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTranscriptFromVideoPage(videoId: string): Promise<Array<{ text: string; start: number; duration: number }>> {
    try {
      // Alternative approach: try different CORS proxy
      const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(videoPageUrl)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video page: ${response.status}`);
      }
      
      const html = await response.text();
      
      // Look for transcript data in the HTML
      const scriptTags = html.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
      
      for (const script of scriptTags) {
        if (script.includes('captionTracks')) {
          // Extract caption tracks from the script
          const captionTracksMatch = script.match(/"captionTracks":(\[.*?\])/);
          if (captionTracksMatch) {
            const captionTracks = JSON.parse(captionTracksMatch[1]);
            
            if (captionTracks.length > 0) {
              // Use the first available caption track
              const transcriptUrl = captionTracks[0].baseUrl;
              const transcriptProxyUrl = `https://corsproxy.io/?${encodeURIComponent(transcriptUrl)}`;
              
              const transcriptResponse = await fetch(transcriptProxyUrl);
              if (transcriptResponse.ok) {
                const transcriptXml = await transcriptResponse.text();
                return this.parseTranscriptXml(transcriptXml);
              }
            }
          }
        }
      }
      
      throw new Error('No transcript data found in video page');
      
    } catch (error) {
      throw new Error(`Video page extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async importVideoTranscript(videoUrl: string, categoryId?: string): Promise<any> {
    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) {
      throw this.createError('INVALID_URL', 'Invalid YouTube video URL');
    }

    try {
      // Get video metadata
      const videoData = await this.getVideoMetadata(videoId);
      
      // Try to get transcript (will return null due to API limitations)
      const transcriptData = await this.getVideoTranscript(videoId);
      
      let transcriptText: string;
      
      if (transcriptData && transcriptData.length > 0) {
        // We successfully got transcript data! Format it properly
        const transcriptSegments = transcriptData.map(segment => 
          `[${Math.floor(segment.start / 60)}:${(segment.start % 60).toFixed(0).padStart(2, '0')}] ${segment.text}`
        ).join('\n');
        
        transcriptText = `📺 **Video imported from YouTube**

**Title:** ${videoData.title}
**Channel:** ${videoData.channelTitle}
**Duration:** ${Math.floor(this.parseDuration(videoData.duration) / 60)}:${(this.parseDuration(videoData.duration) % 60).toString().padStart(2, '0')}
**Views:** ${parseInt(videoData.viewCount || '0').toLocaleString()}
**Published:** ${new Date(videoData.publishedAt).toLocaleDateString()}

**Description:**
${videoData.description || 'No description available'}

## 📝 Full Transcript

${transcriptSegments}

🔗 **Watch:** https://www.youtube.com/watch?v=${videoId}`;
      } else {
        // Create rich metadata content since transcript is not available
        transcriptText = `📺 **Video imported from YouTube**

**Title:** ${videoData.title}
**Channel:** ${videoData.channelTitle}
**Duration:** ${Math.floor(this.parseDuration(videoData.duration) / 60)}:${(this.parseDuration(videoData.duration) % 60).toString().padStart(2, '0')}
**Views:** ${parseInt(videoData.viewCount || '0').toLocaleString()}
**Published:** ${new Date(videoData.publishedAt).toLocaleDateString()}

**Description:**
${videoData.description || 'No description available'}

⚠️ **Transcript not available:** This video either doesn't have captions enabled or the transcript extraction failed.

💡 **Tip:** You can manually add your notes about this video below.

🔗 **Watch:** https://www.youtube.com/watch?v=${videoId}`;
      }

      // Return the item object that can be imported into the app
      return {
        id: `youtube-${videoId}`,
        type: 'note',
        title: `YouTube: ${videoData.title}`,
        description: `Go to https://www.youtube.com/watch?v=${videoId} to watch this video`,
        content: transcriptText,
        categoryId: categoryId || 'YouTube',
        tags: ['youtube', 'video', 'imported'],
        metadata: {
          source: 'YouTube',
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: videoData.publishedAt,
          viewCount: parseInt(videoData.viewCount || '0'),
          channelTitle: videoData.channelTitle,
          duration: this.parseDuration(videoData.duration)
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      throw this.createError(
        'IMPORT_FAILED',
        `Failed to import YouTube video: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  private async getVideoMetadata(videoId: string): Promise<any> {
    const response = await this.makeRequest<{ items: any[] }>(
      `${this.youtubeApiUrl}/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${this.accessToken}`
    );

    if (!response.items || response.items.length === 0) {
      throw new Error('Video not found');
    }

    const video = response.items[0];
    return {
      title: video.snippet.title,
      description: video.snippet.description,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      duration: video.contentDetails.duration,
      viewCount: video.statistics.viewCount
    };
  }



  private parseTranscriptXml(xmlContent: string): Array<{ text: string; start: number; duration: number }> {
    const segments: Array<{ text: string; start: number; duration: number }> = [];
    
    // Parse XML manually since we don't have a DOM parser in this environment
    const textMatches = xmlContent.match(/<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([^<]*)<\/text>/g);
    
    if (!textMatches) {
      throw new Error('Invalid transcript XML format');
    }
    
    textMatches.forEach(match => {
      const startMatch = match.match(/start="([^"]*)"/);
      const durMatch = match.match(/dur="([^"]*)"/);
      const textMatch = match.match(/>([^<]*)</);
      
      if (startMatch && durMatch && textMatch) {
        const start = parseFloat(startMatch[1]);
        const duration = parseFloat(durMatch[1]);
        const text = textMatch[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
        
        if (text) {
          segments.push({ text, start, duration });
        }
      }
    });
    
    return segments;
  }

  private parseCaptionContent(content: string): Array<{ text: string; start: number; duration: number }> {
    // Parse WebVTT or other caption formats
    // This is a simplified implementation
    const lines = content.split('\n');
    const segments: Array<{ text: string; start: number; duration: number }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for timestamp lines (WebVTT format)
      if (line.includes('-->')) {
        const [startTime, endTime] = line.split(' --> ');
        const start = this.parseTimestamp(startTime);
        const end = this.parseTimestamp(endTime);
        const duration = end - start;
        
        // Next line should be the text
        if (i + 1 < lines.length) {
          const text = lines[i + 1].trim();
          if (text) {
            segments.push({ text, start, duration });
          }
        }
      }
    }
    
    return segments;
  }

  private parseTimestamp(timestamp: string): number {
    // Parse timestamp like "00:01:23.456" to seconds
    const parts = timestamp.split(':');
    const seconds = parseFloat(parts.pop() || '0');
    const minutes = parseInt(parts.pop() || '0');
    const hours = parseInt(parts.pop() || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  }

  private parseDuration(duration: string): number {
    // Parse ISO 8601 duration like "PT4M13S" to seconds
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Batch import multiple videos
  async importMultipleVideos(videoUrls: string[], categoryId?: string): Promise<ImportResult> {
    const results: Item[] = [];
    const errors: string[] = [];

    for (const url of videoUrls) {
      try {
        const item = await this.importVideoTranscript(url, categoryId);
        results.push(item);
      } catch (error) {
        errors.push(`Failed to import ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      provider: 'youtube',
      totalItems: videoUrls.length,
      importedItems: results.length,
      failedItems: videoUrls.length - results.length,
      errors,
      summary: {
        notes: results.length
      }
    };
  }

  // Search YouTube videos (requires OAuth for some features)
  async searchVideos(query: string, maxResults: number = 10): Promise<Array<{
    videoId: string;
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: any;
  }>> {
    const response = await this.makeRequest<{ items: any[] }>(
      `${this.youtubeApiUrl}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${this.accessToken}`
    );

    return response.items.map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnails: item.snippet.thumbnails
    }));
  }

  // Override auth headers for YouTube API
  protected getAuthHeaders(): Record<string, string> {
    // YouTube API uses key parameter instead of Authorization header for API key
    return {};
  }

  private parseVTTContent(vttContent: string): Array<{ text: string; start: number; duration: number }> {
    const segments: Array<{ text: string; start: number; duration: number }> = [];
    const lines = vttContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for timestamp lines (format: "00:00:00.000 --> 00:00:05.000")
      if (line.includes(' --> ')) {
        const [startTime, endTime] = line.split(' --> ');
        const start = this.parseVTTTimestamp(startTime);
        const end = this.parseVTTTimestamp(endTime);
        const duration = end - start;
        
        // Next non-empty line should be the text
        let textLines: string[] = [];
        for (let j = i + 1; j < lines.length; j++) {
          const textLine = lines[j].trim();
          if (textLine === '') {
            break; // Empty line marks end of this caption
          }
          if (!textLine.includes(' --> ')) {
            // Remove VTT formatting tags like <c.colorname>text</c>
            const cleanText = textLine.replace(/<[^>]*>/g, '');
            textLines.push(cleanText);
          }
        }
        
        if (textLines.length > 0) {
          segments.push({
            text: textLines.join(' ').trim(),
            start,
            duration
          });
        }
      }
    }
    
    return segments;
  }

  private parseVTTTimestamp(timestamp: string): number {
    // Parse VTT timestamp format: "00:01:23.456" to seconds
    const parts = timestamp.split(':');
    const seconds = parseFloat(parts.pop() || '0');
    const minutes = parseInt(parts.pop() || '0');
    const hours = parseInt(parts.pop() || '0');
    
    return hours * 3600 + minutes * 60 + seconds;
  }
} 