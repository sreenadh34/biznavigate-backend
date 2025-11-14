import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';

/**
 * Template Engine Service
 * Handles template compilation and rendering using Handlebars
 */
@Injectable()
export class TemplateEngineService {
  private readonly logger = new Logger(TemplateEngineService.name);

  constructor() {
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers() {
    // Format currency
    Handlebars.registerHelper('currency', (value: number) => {
      return `₹${value.toFixed(2)}`;
    });

    // Format date
    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Format time
    Handlebars.registerHelper('formatTime', (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    // Uppercase
    Handlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    // Lowercase
    Handlebars.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    // Conditional equals
    Handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    // Truncate text
    Handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    });
  }

  /**
   * Render template with context data
   */
  render(template: string, context: Record<string, any>): string {
    try {
      const compiled = Handlebars.compile(template);
      return compiled(context);
    } catch (error) {
      this.logger.error(`Template rendering failed: ${error.message}`, error.stack);
      throw new Error(`Template rendering error: ${error.message}`);
    }
  }

  /**
   * Validate template syntax
   */
  validate(template: string): { valid: boolean; error?: string } {
    try {
      Handlebars.compile(template);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Extract variables from template
   */
  extractVariables(template: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = regex.exec(template)) !== null) {
      // Remove helper functions and get the variable name
      const variable = match[1]
        .trim()
        .split(' ')[0] // Get first word (variable name)
        .replace(/[()]/g, ''); // Remove parentheses if any

      if (!this.isHelperFunction(variable)) {
        variables.add(variable);
      }
    }

    return Array.from(variables);
  }

  /**
   * Check if a string is a Handlebars helper function
   */
  private isHelperFunction(str: string): boolean {
    const helpers = ['currency', 'formatDate', 'formatTime', 'uppercase', 'lowercase', 'eq', 'truncate', 'if', 'unless', 'each', 'with'];
    return helpers.includes(str);
  }

  /**
   * Render multiple templates with same context
   */
  renderMultiple(
    templates: Record<string, string>,
    context: Record<string, any>,
  ): Record<string, string> {
    const rendered: Record<string, string> = {};

    for (const [key, template] of Object.entries(templates)) {
      if (template) {
        rendered[key] = this.render(template, context);
      }
    }

    return rendered;
  }
}
