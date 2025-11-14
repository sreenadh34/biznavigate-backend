import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum InsightPeriod {
  DAY = 'day',
  WEEK = 'week',
  DAYS_28 = 'days_28',
  LIFETIME = 'lifetime',
}

export enum AccountMetric {
  // Core metrics
  REACH = 'reach',
  FOLLOWER_COUNT = 'follower_count',
  WEBSITE_CLICKS = 'website_clicks',
  PROFILE_VIEWS = 'profile_views',

  // Engagement metrics
  ONLINE_FOLLOWERS = 'online_followers',
  ACCOUNTS_ENGAGED = 'accounts_engaged',
  TOTAL_INTERACTIONS = 'total_interactions',
  LIKES = 'likes',
  COMMENTS = 'comments',
  SHARES = 'shares',
  SAVES = 'saves',
  REPLIES = 'replies',

  // Demographics
  ENGAGED_AUDIENCE_DEMOGRAPHICS = 'engaged_audience_demographics',
  REACHED_AUDIENCE_DEMOGRAPHICS = 'reached_audience_demographics',
  FOLLOWER_DEMOGRAPHICS = 'follower_demographics',

  // Profile actions
  FOLLOWS_AND_UNFOLLOWS = 'follows_and_unfollows',
  PROFILE_LINKS_TAPS = 'profile_links_taps',

  // Content metrics
  VIEWS = 'views',

  // Threads metrics (if using Instagram Threads)
  THREADS_LIKES = 'threads_likes',
  THREADS_REPLIES = 'threads_replies',
  REPOSTS = 'reposts',
  QUOTES = 'quotes',
  THREADS_FOLLOWERS = 'threads_followers',
  THREADS_FOLLOWER_DEMOGRAPHICS = 'threads_follower_demographics',
  CONTENT_VIEWS = 'content_views',
  THREADS_VIEWS = 'threads_views',
  THREADS_CLICKS = 'threads_clicks',
  THREADS_REPOSTS = 'threads_reposts',
}

export enum MediaMetric {
  ENGAGEMENT = 'engagement',
  IMPRESSIONS = 'impressions',
  REACH = 'reach',
  SAVED = 'saved',
  VIDEO_VIEWS = 'video_views',
  SHARES = 'shares',
  COMMENTS = 'comments',
  LIKES = 'likes',
}

export class GetAccountInsightsDto {
  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;

  @ApiProperty({ description: 'Metrics to fetch', enum: AccountMetric, isArray: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(v => v.trim());
    }
    return value;
  })
  @IsArray()
  @IsEnum(AccountMetric, { each: true })
  metrics: AccountMetric[];

  @ApiProperty({ description: 'Period for insights', enum: InsightPeriod })
  @IsEnum(InsightPeriod)
  period: InsightPeriod;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  since?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  until?: string;
}

export class GetMediaInsightsDto {
  @ApiProperty({ description: 'Media ID (Instagram post/video)' })
  @IsString()
  mediaId: string;

  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;

  @ApiProperty({ description: 'Metrics to fetch', enum: MediaMetric, isArray: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(v => v.trim());
    }
    return value;
  })
  @IsArray()
  @IsEnum(MediaMetric, { each: true })
  metrics: MediaMetric[];
}

export class GetMediaListDto {
  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;

  @ApiPropertyOptional({ description: 'Limit number of media items' })
  @IsString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ description: 'Pagination cursor' })
  @IsString()
  @IsOptional()
  after?: string;

  @ApiPropertyOptional({ description: 'Fields to include' })
  @IsString()
  @IsOptional()
  fields?: string;
}

export class GetMediaDetailsDto {
  @ApiProperty({ description: 'Media ID (Instagram post/video)' })
  @IsString()
  mediaId: string;

  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;

  @ApiPropertyOptional({ description: 'Fields to include' })
  @IsString()
  @IsOptional()
  fields?: string;
}

export class GetMediaCommentsDto {
  @ApiProperty({ description: 'Media ID (Instagram post/video)' })
  @IsString()
  mediaId: string;

  @ApiProperty({ description: 'Account ID (Instagram account)' })
  @IsString()
  accountId: string;

  @ApiPropertyOptional({ description: 'Limit number of comments' })
  @IsString()
  @IsOptional()
  limit?: string;

  @ApiPropertyOptional({ description: 'Pagination cursor' })
  @IsString()
  @IsOptional()
  after?: string;
}
