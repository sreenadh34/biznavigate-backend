import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KafkaModule } from '../kafka/kafka.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

// Core Services
import { WorkflowResolverService } from './core/workflow-resolver.service';
import { WorkflowExecutorService } from './core/workflow-executor.service';
import { WorkflowOrchestratorService } from './core/workflow-orchestrator.service';

// Action Handlers
import { ActionRegistryService } from './actions/action-registry.service';
import { SendMessageAction } from './actions/send-message.action';
import { DbOperationAction } from './actions/db-operation.action';
import { ScriptAction } from './actions/script.action';
import { NotifyTeamAction } from './actions/notify-team.action';
import { FetchCategoriesAction } from './actions/fetch-categories.action';
import { FetchProductsAction } from './actions/fetch-products.action';
import { SendCatalogAction } from './actions/send-catalog.action';
import { HandleCategorySelectionAction } from './actions/handle-category-selection.action';

// Consumers
import { AiResultConsumerService } from './consumers/ai-result-consumer.service';

@Module({
  imports: [PrismaModule, KafkaModule, WhatsAppModule],
  providers: [
    // Core
    WorkflowResolverService,
    WorkflowExecutorService,
    WorkflowOrchestratorService,

    // Registry
    ActionRegistryService,

    // Actions
    SendMessageAction,
    DbOperationAction,
    ScriptAction,
    NotifyTeamAction,
    FetchCategoriesAction,
    FetchProductsAction,
    SendCatalogAction,
    HandleCategorySelectionAction,

    // Consumers
    AiResultConsumerService,
  ],
  exports: [
    WorkflowResolverService,
    WorkflowExecutorService,
    WorkflowOrchestratorService,
  ],
})
export class OrchestrationModule implements OnModuleInit {
  constructor(
    private readonly actionRegistry: ActionRegistryService,
    private readonly sendMessageAction: SendMessageAction,
    private readonly dbOperationAction: DbOperationAction,
    private readonly scriptAction: ScriptAction,
    private readonly notifyTeamAction: NotifyTeamAction,
    private readonly fetchCategoriesAction: FetchCategoriesAction,
    private readonly fetchProductsAction: FetchProductsAction,
    private readonly sendCatalogAction: SendCatalogAction,
    private readonly handleCategorySelectionAction: HandleCategorySelectionAction,
  ) {}

  onModuleInit() {
    // Register all action handlers
    this.actionRegistry.registerHandler(this.sendMessageAction);
    this.actionRegistry.registerHandler(this.dbOperationAction);
    this.actionRegistry.registerHandler(this.scriptAction);
    this.actionRegistry.registerHandler(this.notifyTeamAction);
    this.actionRegistry.registerHandler(this.fetchCategoriesAction);
    this.actionRegistry.registerHandler(this.fetchProductsAction);
    this.actionRegistry.registerHandler(this.sendCatalogAction);
    this.actionRegistry.registerHandler(this.handleCategorySelectionAction);
  }
}
