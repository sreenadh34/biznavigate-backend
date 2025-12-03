import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export enum OnboardingStep {
  NONE = 'none',
  WELCOME = 'welcome',
  AWAITING_NAME = 'awaiting_name',
  AWAITING_LOCATION = 'awaiting_location',
  COMPLETED = 'completed',
}

export interface ConversationState {
  step: OnboardingStep;
  data: {
    name?: string;
    location?: string;
    city?: string;
    area?: string;
  };
  lastUpdated: Date;
}

@Injectable()
export class ConversationStateService {
  private readonly logger = new Logger(ConversationStateService.name);
  private readonly states = new Map<string, ConversationState>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get conversation state for a lead
   */
  async getState(leadId: string): Promise<ConversationState> {
    // Check in-memory cache first
    if (this.states.has(leadId)) {
      return this.states.get(leadId)!;
    }

    // Check if lead exists and has completed onboarding
    const lead = await this.prisma.leads.findUnique({
      where: { lead_id: leadId },
      select: {
        first_name: true,
        last_name: true,
        city: true,
        state: true,
        onboarding_completed: true,
      },
    });

    if (!lead) {
      return this.createState(leadId, OnboardingStep.WELCOME);
    }

    // If lead has name and location, onboarding is complete
    if (lead.onboarding_completed || (lead.first_name && lead.city)) {
      return this.createState(leadId, OnboardingStep.COMPLETED, {
        name: `${lead.first_name} ${lead.last_name || ''}`.trim(),
        city: lead.city || undefined,
        area: lead.state || undefined,
      });
    }

    // Determine current step based on what data exists
    if (!lead.first_name) {
      return this.createState(leadId, OnboardingStep.AWAITING_NAME);
    } else if (!lead.city) {
      return this.createState(leadId, OnboardingStep.AWAITING_LOCATION, {
        name: lead.first_name,
      });
    }

    return this.createState(leadId, OnboardingStep.COMPLETED);
  }

  /**
   * Update conversation state
   */
  async updateState(
    leadId: string,
    step: OnboardingStep,
    data?: Partial<ConversationState['data']>,
  ): Promise<ConversationState> {
    const currentState = await this.getState(leadId);

    const newState: ConversationState = {
      step,
      data: { ...currentState.data, ...data },
      lastUpdated: new Date(),
    };

    this.states.set(leadId, newState);

    // Auto-cleanup after 1 hour of inactivity
    setTimeout(() => {
      this.states.delete(leadId);
    }, 3600000);

    return newState;
  }

  /**
   * Save user data to database
   */
  async saveUserData(
    leadId: string,
    data: { name?: string; location?: string; city?: string; area?: string },
  ): Promise<void> {
    try {
      const updateData: any = {};

      if (data.name) {
        const nameParts = data.name.trim().split(' ');
        updateData.first_name = nameParts[0];
        if (nameParts.length > 1) {
          updateData.last_name = nameParts.slice(1).join(' ');
        }
      }

      if (data.city) {
        updateData.city = data.city;
      }

      if (data.area) {
        updateData.state = data.area;
      }

      if (data.location) {
        // Try to parse location into city and area
        const locationParts = data.location.split(',').map((p) => p.trim());
        if (locationParts.length >= 1) {
          updateData.city = locationParts[0];
        }
        if (locationParts.length >= 2) {
          updateData.state = locationParts[1];
        }
      }

      await this.prisma.leads.update({
        where: { lead_id: leadId },
        data: updateData,
      });

      this.logger.log(`Saved user data for lead ${leadId}`);
    } catch (error) {
      this.logger.error(`Failed to save user data for lead ${leadId}:`, error);
      throw error;
    }
  }

  /**
   * Mark onboarding as complete
   */
  async completeOnboarding(leadId: string): Promise<void> {
    try {
      await this.prisma.leads.update({
        where: { lead_id: leadId },
        data: { onboarding_completed: true },
      });

      await this.updateState(leadId, OnboardingStep.COMPLETED);

      this.logger.log(`Onboarding completed for lead ${leadId}`);
    } catch (error) {
      this.logger.error(`Failed to complete onboarding for lead ${leadId}:`, error);
    }
  }

  /**
   * Check if user is a returning user
   */
  async isReturningUser(leadId: string): Promise<boolean> {
    const state = await this.getState(leadId);
    return state.step === OnboardingStep.COMPLETED;
  }

  /**
   * Get welcome message for user
   */
  async getWelcomeMessage(
    leadId: string,
    storeName: string = 'our store',
  ): Promise<string> {
    const state = await this.getState(leadId);

    if (state.step === OnboardingStep.COMPLETED && state.data.name) {
      return `Welcome back, ${state.data.name}! 👋\n${
        state.data.city ? `(${state.data.city} location detected)` : ''
      }`;
    }

    return `👋 Hi! Welcome to ${storeName}.\nTo help you better, may I know your name?`;
  }

  /**
   * Process user response based on current state
   */
  async processResponse(
    leadId: string,
    message: string,
    storeName: string = 'our store',
  ): Promise<{ nextMessage: string; completed: boolean; buttons?: any[] }> {
    const state = await this.getState(leadId);
    const lowerMessage = message.toLowerCase().trim();

    // Handle skip
    if (lowerMessage === 'skip') {
      if (state.step === OnboardingStep.AWAITING_NAME) {
        await this.updateState(leadId, OnboardingStep.AWAITING_LOCATION);
        return {
          nextMessage: 'No problem! 😊\nPlease share your location (City / Area) for delivery?',
          completed: false,
        };
      } else if (state.step === OnboardingStep.AWAITING_LOCATION) {
        await this.completeOnboarding(leadId);
        return {
          nextMessage: this.getMenuMessage(),
          completed: true,
        };
      }
    }

    // Process based on current step
    switch (state.step) {
      case OnboardingStep.WELCOME:
        // First time user - send welcome message and ask for name
        await this.updateState(leadId, OnboardingStep.AWAITING_NAME);
        return {
          nextMessage: `👋 Hi! Welcome to ${storeName}.\nTo help you better, may I know your name?`,
          completed: false,
        };

      case OnboardingStep.AWAITING_NAME:
        // Save name and ask for location
        await this.saveUserData(leadId, { name: message });
        await this.updateState(leadId, OnboardingStep.AWAITING_LOCATION, {
          name: message,
        });

        return {
          nextMessage: `Nice to meet you, ${message} 😊\nPlease share your location (City / Area) for delivery?`,
          completed: false,
        };

      case OnboardingStep.AWAITING_LOCATION:
        // Save location and complete onboarding
        await this.saveUserData(leadId, { location: message });
        await this.completeOnboarding(leadId);

        return {
          nextMessage: `Great! You're all set ✔️
How can I assist you today?`,
          completed: true,
          buttons: [
            {
              type: 'reply',
              reply: {
                id: 'browse_products',
                title: 'Browse products',
              },
            },
            {
              type: 'reply',
              reply: {
                id: 'track_order',
                title: 'Track order',
              },
            },
            {
              type: 'reply',
              reply: {
                id: 'talk_support',
                title: 'Talk to support',
              },
            },
          ],
        };

      case OnboardingStep.COMPLETED:
        // User is already onboarded, process as regular message
        return {
          nextMessage: '', // Will be handled by AI/NLU
          completed: true,
        };

      default:
        return {
          nextMessage: await this.getWelcomeMessage(leadId, storeName),
          completed: false,
        };
    }
  }

  /**
   * Get menu options message
   */
  private getMenuMessage(): string {
    return `What would you like to do next?
1️⃣ Browse products
2️⃣ Track order
3️⃣ Talk to support`;
  }

  /**
   * Create a new state
   */
  private createState(
    leadId: string,
    step: OnboardingStep,
    data: Partial<ConversationState['data']> = {},
  ): ConversationState {
    const state: ConversationState = {
      step,
      data,
      lastUpdated: new Date(),
    };

    this.states.set(leadId, state);
    return state;
  }

  /**
   * Clear state (for testing)
   */
  clearState(leadId: string): void {
    this.states.delete(leadId);
  }
}
