import { Injectable } from '@nestjs/common';
import {
  TemplateVariableDto,
  TemplateValidationResultDto,
  NotificationChannel,
} from '../dto/template.dto';

/**
 * Template Validation Service
 * Validates templates for variable consistency, syntax, and best practices
 */
@Injectable()
export class TemplateValidationService {
  /**
   * Regular expression to detect variables in template content
   * Matches {{variableName}} patterns
   */
  private readonly VARIABLE_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

  /**
   * Validate a complete template
   */
  validateTemplate(
    emailSubject?: string,
    emailBody?: string,
    emailHtml?: string,
    smsBody?: string,
    whatsappBody?: string,
    pushTitle?: string,
    pushBody?: string,
    variables?: TemplateVariableDto[],
    enabledChannels?: NotificationChannel[],
  ): TemplateValidationResultDto {
    const result: TemplateValidationResultDto = {
      isValid: true,
      errors: [],
      warnings: [],
      detectedVariables: [],
      missingDefinitions: [],
    };

    // Collect all content based on enabled channels
    const contents: { channel: string; content: string }[] = [];

    if (enabledChannels?.includes(NotificationChannel.EMAIL)) {
      if (emailSubject) contents.push({ channel: 'Email Subject', content: emailSubject });
      if (emailBody) contents.push({ channel: 'Email Body', content: emailBody });
      if (emailHtml) contents.push({ channel: 'Email HTML', content: emailHtml });
    }

    if (enabledChannels?.includes(NotificationChannel.SMS)) {
      if (smsBody) contents.push({ channel: 'SMS', content: smsBody });
    }

    if (enabledChannels?.includes(NotificationChannel.WHATSAPP)) {
      if (whatsappBody) contents.push({ channel: 'WhatsApp', content: whatsappBody });
    }

    if (enabledChannels?.includes(NotificationChannel.PUSH)) {
      if (pushTitle) contents.push({ channel: 'Push Title', content: pushTitle });
      if (pushBody) contents.push({ channel: 'Push Body', content: pushBody });
    }

    // Detect all variables used in content
    const detectedVars = new Set<string>();
    contents.forEach(({ channel, content }) => {
      const vars = this.extractVariables(content);
      vars.forEach((v) => detectedVars.add(v));
    });

    result.detectedVariables = Array.from(detectedVars);

    // Create map of defined variables
    const definedVars = new Map<string, TemplateVariableDto>();
    (variables || []).forEach((v) => {
      definedVars.set(v.key, v);
    });

    // Check for missing variable definitions
    detectedVars.forEach((varName) => {
      if (!definedVars.has(varName)) {
        result.missingDefinitions.push(varName);
        result.errors.push(
          `Variable '{{${varName}}}' is used in template but not defined in variables array`,
        );
      }
    });

    // Check for unused variable definitions
    Array.from(definedVars.keys()).forEach((varName) => {
      if (!detectedVars.has(varName)) {
        result.warnings.push(
          `Variable '{{${varName}}}' is defined but not used in any template content`,
        );
      }
    });

    // Validate enabled channels have content
    enabledChannels?.forEach((channel) => {
      if (channel === NotificationChannel.EMAIL) {
        if (!emailSubject && !emailBody && !emailHtml) {
          result.errors.push('Email channel is enabled but no email content provided');
        }
      } else if (channel === NotificationChannel.SMS) {
        if (!smsBody) {
          result.errors.push('SMS channel is enabled but no SMS body provided');
        } else if (smsBody.length > 1600) {
          result.errors.push(`SMS body exceeds 1600 characters (current: ${smsBody.length})`);
        }
      } else if (channel === NotificationChannel.WHATSAPP) {
        if (!whatsappBody) {
          result.errors.push('WhatsApp channel is enabled but no WhatsApp body provided');
        }
      } else if (channel === NotificationChannel.PUSH) {
        if (!pushTitle && !pushBody) {
          result.errors.push('Push channel is enabled but no push notification content provided');
        }
      }
    });

    // Validate required variables have default values or are marked as required
    Array.from(definedVars.values()).forEach((variable) => {
      if (variable.required && !variable.defaultValue) {
        // This is fine - required variables don't need defaults
      } else if (!variable.required && !variable.defaultValue) {
        result.warnings.push(
          `Variable '{{${variable.key}}}' is not required but has no default value. Consider adding one.`,
        );
      }
    });

    // Check for common issues
    contents.forEach(({ channel, content }) => {
      // Check for malformed variables
      const malformed = content.match(/\{[^{]|[^}]\}/g);
      if (malformed) {
        result.errors.push(`${channel} contains malformed variable syntax: ${malformed.join(', ')}`);
      }

      // Check for nested variables (not supported)
      if (content.includes('{{{')) {
        result.errors.push(`${channel} contains nested variables which are not supported`);
      }
    });

    // SMS-specific validations
    if (smsBody) {
      if (smsBody.length > 1600) {
        result.errors.push(`SMS body is too long: ${smsBody.length} chars (max 1600)`);
      }

      // Estimate actual length after variable replacement
      const estimatedLength = this.estimateSmsLength(smsBody, Array.from(definedVars.values()));
      if (estimatedLength > 1600) {
        result.warnings.push(
          `SMS body may exceed 1600 chars after variable replacement (estimated: ${estimatedLength})`,
        );
      }

      // Check for multiple segments (SMS gets split after 160 chars)
      if (estimatedLength > 160) {
        const segments = Math.ceil(estimatedLength / 153); // 153 chars for multi-part SMS
        result.warnings.push(
          `SMS will be sent as ${segments} segments (${estimatedLength} chars estimated)`,
        );
      }
    }

    // Update isValid based on errors
    result.isValid = result.errors.length === 0;

    return result;
  }

  /**
   * Extract variable names from template content
   */
  extractVariables(content: string): string[] {
    const matches = content.matchAll(this.VARIABLE_REGEX);
    const variables = new Set<string>();

    for (const match of matches) {
      variables.add(match[1]); // match[1] is the captured variable name
    }

    return Array.from(variables);
  }

  /**
   * Estimate SMS length after variable replacement
   */
  private estimateSmsLength(content: string, variables: TemplateVariableDto[]): number {
    let estimatedContent = content;

    variables.forEach((variable) => {
      const placeholder = `{{${variable.key}}}`;
      const exampleValue = variable.exampleValue || variable.defaultValue || '';
      const valueLength = String(exampleValue).length;

      // Replace placeholder with estimated length
      estimatedContent = estimatedContent.replace(
        new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g'),
        'X'.repeat(valueLength || 10), // Default to 10 chars if no example
      );
    });

    return estimatedContent.length;
  }

  /**
   * Replace variables in content with actual values
   */
  replaceVariables(
    content: string,
    variables: Record<string, any>,
    definedVariables?: TemplateVariableDto[],
  ): string {
    let result = content;

    // Create map of defined variables with defaults
    const varMap = new Map<string, any>();
    (definedVariables || []).forEach((v) => {
      if (v.defaultValue !== undefined) {
        varMap.set(v.key, v.defaultValue);
      }
    });

    // Override with provided values
    Object.keys(variables).forEach((key) => {
      varMap.set(key, variables[key]);
    });

    // Replace all variables
    result = result.replace(this.VARIABLE_REGEX, (match, varName) => {
      if (varMap.has(varName)) {
        return String(varMap.get(varName));
      }
      // Return original if variable not found
      return match;
    });

    return result;
  }

  /**
   * Check if template has required variables
   */
  hasAllRequiredVariables(
    providedVariables: Record<string, any>,
    definedVariables: TemplateVariableDto[],
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    definedVariables.forEach((variable) => {
      if (variable.required) {
        if (!(variable.key in providedVariables)) {
          missing.push(variable.key);
        }
      }
    });

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Sanitize HTML content (basic XSS prevention)
   */
  sanitizeHtml(html: string): string {
    // Remove script tags
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

    // Remove javascript: protocols
    sanitized = sanitized.replace(/javascript:/gi, '');

    return sanitized;
  }

  /**
   * Validate variable value based on type
   */
  validateVariableValue(value: any, variable: TemplateVariableDto): { valid: boolean; error?: string } {
    if (value === null || value === undefined) {
      if (variable.required && !variable.defaultValue) {
        return { valid: false, error: `Variable '${variable.key}' is required` };
      }
      return { valid: true };
    }

    switch (variable.type) {
      case 'text':
        if (typeof value !== 'string') {
          return { valid: false, error: `Variable '${variable.key}' must be a string` };
        }
        break;

      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return { valid: false, error: `Variable '${variable.key}' must be a number` };
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          return { valid: false, error: `Variable '${variable.key}' must be a valid email` };
        }
        break;

      case 'phone':
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(String(value).replace(/\s/g, ''))) {
          return { valid: false, error: `Variable '${variable.key}' must be a valid phone number` };
        }
        break;

      case 'url':
        try {
          new URL(String(value));
        } catch {
          return { valid: false, error: `Variable '${variable.key}' must be a valid URL` };
        }
        break;

      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { valid: false, error: `Variable '${variable.key}' must be a valid date` };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Validate all provided variables
   */
  validateAllVariables(
    providedVariables: Record<string, any>,
    definedVariables: TemplateVariableDto[],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required variables
    const requiredCheck = this.hasAllRequiredVariables(providedVariables, definedVariables);
    if (!requiredCheck.valid) {
      errors.push(`Missing required variables: ${requiredCheck.missing.join(', ')}`);
    }

    // Validate each provided variable
    Object.keys(providedVariables).forEach((key) => {
      const variable = definedVariables.find((v) => v.key === key);
      if (!variable) {
        errors.push(`Unknown variable '${key}' provided`);
        return;
      }

      const validation = this.validateVariableValue(providedVariables[key], variable);
      if (!validation.valid) {
        errors.push(validation.error!);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
