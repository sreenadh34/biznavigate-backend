import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { SendWhatsAppMessageDto, MarkAsReadDto } from '../dto/whatsapp-message.dto';

@Injectable()
export class WhatsAppApiClientService {
  private readonly logger = new Logger(WhatsAppApiClientService.name);
  private readonly apiClient: AxiosInstance;
  private readonly apiVersion: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiVersion = this.configService.get<string>('whatsapp.apiVersion', 'v21.0');
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;

    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.apiClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => {
        return response;
      },
      (error: AxiosError) => {
        this.handleApiError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Send a message
   */
  async sendMessage(
    phoneNumberId: string,
    accessToken: string,
    message: SendWhatsAppMessageDto
  ): Promise<any> {
    try {
      const response = await this.apiClient.post(
        `/${phoneNumberId}/messages`,
        message,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      this.logger.log(`Message sent successfully: ${response.data.messages?.[0]?.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(
    phoneNumberId: string,
    accessToken: string,
    messageId: string
  ): Promise<any> {
    try {
      const payload: MarkAsReadDto = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      };

      const response = await this.apiClient.post(
        `/${phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      this.logger.debug(`Message ${messageId} marked as read`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to mark message as read:', error);
      throw error;
    }
  }

  /**
   * Upload media
   */
  async uploadMedia(
    phoneNumberId: string,
    accessToken: string,
    file: Buffer,
    mimeType: string
  ): Promise<string> {
    try {
      const formData = new FormData();
      const blob = new Blob([file], { type: mimeType });
      formData.append('file', blob);
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', mimeType);

      const response = await this.apiClient.post(
        `/${phoneNumberId}/media`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const mediaId = response.data.id;
      this.logger.log(`Media uploaded successfully: ${mediaId}`);
      return mediaId;
    } catch (error) {
      this.logger.error('Failed to upload media:', error);
      throw error;
    }
  }

  /**
   * Get media URL
   */
  async getMediaUrl(
    mediaId: string,
    accessToken: string
  ): Promise<string> {
    try {
      const response = await this.apiClient.get(`/${mediaId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data.url;
    } catch (error) {
      this.logger.error('Failed to get media URL:', error);
      throw error;
    }
  }

  /**
   * Download media
   */
  async downloadMedia(
    mediaUrl: string,
    accessToken: string
  ): Promise<Buffer> {
    try {
      const response = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Failed to download media:', error);
      throw error;
    }
  }

  /**
   * Get message templates
   */
  async getTemplates(
    whatsappBusinessAccountId: string,
    accessToken: string
  ): Promise<any[]> {
    try {
      const response = await this.apiClient.get(
        `/${whatsappBusinessAccountId}/message_templates`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to get templates:', error);
      throw error;
    }
  }

  /**
   * Create message template
   */
  async createTemplate(
    whatsappBusinessAccountId: string,
    accessToken: string,
    template: any
  ): Promise<any> {
    try {
      const response = await this.apiClient.post(
        `/${whatsappBusinessAccountId}/message_templates`,
        template,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      this.logger.log(`Template created: ${template.name}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create template:', error);
      throw error;
    }
  }

  /**
   * Delete message template
   */
  async deleteTemplate(
    whatsappBusinessAccountId: string,
    accessToken: string,
    templateName: string
  ): Promise<any> {
    try {
      const response = await this.apiClient.delete(
        `/${whatsappBusinessAccountId}/message_templates`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            name: templateName,
          },
        }
      );

      this.logger.log(`Template deleted: ${templateName}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to delete template:', error);
      throw error;
    }
  }

  /**
   * Get phone number details
   */
  async getPhoneNumberDetails(
    phoneNumberId: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await this.apiClient.get(`/${phoneNumberId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: 'verified_name,display_phone_number,quality_rating,id',
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get phone number details:', error);
      throw error;
    }
  }

  /**
   * Get WhatsApp Business Account details
   */
  async getBusinessAccountDetails(
    whatsappBusinessAccountId: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await this.apiClient.get(
        `/${whatsappBusinessAccountId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            fields: 'id,name,timezone_id,message_template_namespace,account_review_status',
          },
        }
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get business account details:', error);
      throw error;
    }
  }

  /**
   * Create or update product in WhatsApp Catalog
   */
  async syncCatalogProduct(
    catalogId: string,
    accessToken: string,
    productData: {
      retailer_id: string;
      name: string;
      description?: string;
      price: number;
      currency: string;
      availability: 'in stock' | 'out of stock';
      image_url?: string;
      url?: string;
    },
    existingProductId?: string
  ): Promise<{ id: string }> {
    try {
      const endpoint = existingProductId
        ? `/${existingProductId}`
        : `/${catalogId}/products`;

      const response = await this.apiClient.post(
        endpoint,
        productData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const productId = response.data.id || existingProductId;
      this.logger.log(`Product ${existingProductId ? 'updated' : 'created'} in catalog: ${productId}`);

      return { id: productId };
    } catch (error) {
      this.logger.error('Failed to sync product to catalog:', error);
      throw error;
    }
  }

  /**
   * Delete product from WhatsApp Catalog
   */
  async deleteCatalogProduct(
    productId: string,
    accessToken: string
  ): Promise<{ success: boolean }> {
    try {
      await this.apiClient.delete(`/${productId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      this.logger.log(`Product deleted from catalog: ${productId}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to delete product from catalog:', error);
      throw error;
    }
  }

  /**
   * Get catalog details
   */
  async getCatalog(
    catalogId: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await this.apiClient.get(`/${catalogId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: 'id,name,vertical,product_count',
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get catalog:', error);
      throw error;
    }
  }

  /**
   * Get products from catalog
   */
  async getCatalogProducts(
    catalogId: string,
    accessToken: string,
    limit = 100
  ): Promise<any[]> {
    try {
      const response = await this.apiClient.get(`/${catalogId}/products`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: 'id,retailer_id,name,description,price,currency,availability,image_url',
          limit,
        },
      });

      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to get catalog products:', error);
      throw error;
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: AxiosError): void {
    if (error.response) {
      const status = error.response.status;
      const data: any = error.response.data;

      this.logger.error(`WhatsApp API Error (${status}):`, {
        error: data.error,
        message: data.error?.message,
        code: data.error?.code,
        errorSubcode: data.error?.error_subcode,
        fbtraceId: data.error?.fbtrace_id,
      });

      // Handle specific error codes
      switch (status) {
        case 400:
          this.logger.warn('Bad Request - Check message format');
          break;
        case 401:
          this.logger.error('Unauthorized - Invalid access token');
          break;
        case 403:
          this.logger.error('Forbidden - Insufficient permissions');
          break;
        case 404:
          this.logger.error('Not Found - Resource does not exist');
          break;
        case 429:
          this.logger.warn('Rate Limit Exceeded - Backing off');
          break;
        case 500:
        case 502:
        case 503:
          this.logger.error('WhatsApp API Server Error - Retry later');
          break;
      }
    } else if (error.request) {
      this.logger.error('No response received from WhatsApp API:', error.message);
    } else {
      this.logger.error('Error setting up request:', error.message);
    }
  }
}
