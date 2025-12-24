/**
 * Workflow Orchestration Type Definitions
 */

export interface WorkflowDefinition {
  initialState: string;
  states: Record<string, WorkflowState>;
  errorHandling?: ErrorHandlingConfig;
}

export interface WorkflowState {
  name?: string;
  type: 'action' | 'decision' | 'parallel' | 'wait' | 'end';
  actions?: WorkflowAction[];
  transitions?: WorkflowTransition[];
  timeout?: {
    duration: number;
    nextState: string;
  };
  onError?: {
    nextState: string;
    retryPolicy?: RetryPolicy;
  };
}

export interface WorkflowAction {
  actionId: string;
  type: string; // 'send_message', 'db_operation', 'script', 'notify_team', etc.
  params: Record<string, any>;
  outputVariable?: string;
  condition?: WorkflowCondition;
  async?: boolean;
  timeout?: number;
}

export interface WorkflowTransition {
  to: string;
  condition?: WorkflowCondition;
  priority?: number;
}

export interface WorkflowCondition {
  type: 'expression' | 'script' | 'always';
  expression?: string;
  script?: string;
}

export interface ErrorHandlingConfig {
  defaultHandler: string;
  handlers?: Record<string, string>;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
}

// ============================================================================
// Execution Context
// ============================================================================

export interface WorkflowExecutionContext {
  // AI Results
  intent?: string;
  intentConfidence?: number;
  entities?: Record<string, any>;
  suggestedActions?: string[];
  suggestedResponse?: string;

  // Lead & Business Info
  leadId: string;
  businessId: string;
  tenantId: string;
  leadName?: string;
  leadPhone?: string;

  // Conversation Info
  conversationId?: string;
  channel: string; // 'whatsapp', 'instagram', etc.
  messageId?: string;

  // Message Info
  message?: {
    content: {
      type: string;
      text?: string;
    };
  };

  // Channel Config
  channelConfig?: any;

  // Business Info
  business?: {
    name?: string;
    type?: string;
  };

  // Dynamic variables set by workflow actions
  [key: string]: any;
}

export interface WorkflowExecutionResult {
  executionId: string;
  workflowId: string;
  status: 'completed' | 'failed' | 'waiting';
  finalState: string;
  context: WorkflowExecutionContext;
  error?: string;
}

// ============================================================================
// AI Result from Kafka
// ============================================================================

export interface AiProcessResult {
  lead_id: string;
  business_id: string;
  tenant_id: string;
  processing_id: string;
  intent: {
    intent: string;
    confidence: number;
    category?: string;
  };
  entities: Record<string, any>;
  structured_data?: Record<string, any>;
  suggested_actions: string[];
  suggested_response?: string;
  processing_time_ms: number;
  metadata: {
    message_id: string;
    channel: string;
    conversation_id?: string;
    interactive_selection?: string; // ID from button/list selection
  };
}

// ============================================================================
// Action Handler Interface
// ============================================================================

export interface ActionHandler {
  readonly type: string;
  execute(
    params: any,
    context: WorkflowExecutionContext,
  ): Promise<any>;
}
